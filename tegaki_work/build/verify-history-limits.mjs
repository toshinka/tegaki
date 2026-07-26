import assert from 'node:assert/strict';

globalThis.window = {
    TEGAKI_CONFIG: { debug: false }
};

const { HistoryManager } = await import('../system/history.js');

function createCommand(id, byteSize = 1) {
    return {
        name: `command-${id}`,
        byteSize,
        do() {},
        undo() {},
        meta: { id }
    };
}

const countHistory = new HistoryManager();
countHistory.configureLimits({ maxEntries: 500, maxMemoryMB: 1024 });

for (let index = 0; index < 499; index++) {
    countHistory.record(createCommand(index));
}
assert.equal(countHistory.getUsage().entries, 499);
assert.equal(countHistory.getLimitDiagnostics().evictedEntries, 0);

countHistory.record(createCommand(499));
assert.equal(countHistory.getUsage().entries, 500);
assert.equal(countHistory.getLimitDiagnostics().evictedEntries, 0);

countHistory.record(createCommand(500));
assert.equal(countHistory.getUsage().entries, 500);
assert.equal(countHistory.index, 499);
assert.equal(countHistory.stack[0].meta.id, 1);
assert.deepEqual(countHistory.getLimitDiagnostics().last.reasons, ['count']);
assert.equal(countHistory.getLimitDiagnostics().evictedEntries, 1);

const byteHistory = new HistoryManager();
byteHistory.configureLimits({ maxEntries: 500, maxMemoryMB: 1 });
byteHistory.record(createCommand('a', 600 * 1024));
byteHistory.record(createCommand('b', 600 * 1024));
assert.equal(byteHistory.getUsage().entries, 1);
assert.equal(byteHistory.stack[0].meta.id, 'b');
assert.deepEqual(byteHistory.getLimitDiagnostics().last.reasons, ['bytes']);
assert.equal(byteHistory.getLimitDiagnostics().last.removedBytes, 600 * 1024);

const unaccountedHistory = new HistoryManager();
unaccountedHistory.record(createCommand('declared', 128));
unaccountedHistory.record({ ...createCommand('unknown'), byteSize: undefined });
assert.equal(unaccountedHistory.getUsage().unaccountedEntries, 1);
assert.deepEqual(unaccountedHistory.getUsage().byType, {
    'command-declared': { entries: 1, bytes: 128, unaccountedEntries: 0 },
    'command-unknown': { entries: 1, bytes: 0, unaccountedEntries: 1 }
});

console.log('verify-history-limits: 499 / 500 / 501 count boundary, byte eviction, type diagnostics OK');
