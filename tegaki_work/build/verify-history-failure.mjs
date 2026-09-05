/** WP-001: execute the real HistoryManager; faults are injected only into commands/notification. */
import assert from 'node:assert/strict';

globalThis.window = { TEGAKI_CONFIG: { debug: false } };
const { HistoryManager } = await import('../system/history.js');

const errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args);
try {
    // Record means already applied: the test state starts with A, B and C present.
    for (const startIndex of [0, -1, 1]) {
        const history = new HistoryManager();
        const state = ['A', 'B', 'C'];
        let fail = true;
        const commands = state.map((name, index) => ({
            name,
            byteSize: 32 * (index + 1),
            do() {
                assert.equal(history.isApplying, true);
                if (index === startIndex + 1 && fail) throw new Error('injected do failure');
                state.push(name);
            },
            undo() { assert.equal(state.pop(), name); }
        }));
        commands.forEach(command => history.record(command));
        while (history.index > startIndex) history.undo();
        const stack = history.stack;
        const usage = history.getUsage();
        const before = [...state];
        let notifications = 0;
        const notify = history._notifyHistoryChanged.bind(history);
        history._notifyHistoryChanged = (...args) => { notifications++; notify(...args); };

        for (let attempt = 0; attempt < 3; attempt++) {
            history.redo();
            assert.equal(history.index, startIndex, 'failed redo must preserve the starting index');
            assert.equal(history.isApplying, false);
            assert.equal(history.stack, stack);
            assert.equal(history.stack.length, commands.length);
            commands.forEach((command, i) => assert.equal(history.stack[i], command));
            assert.deepEqual(history.getUsage(), usage);
            assert.deepEqual(state, before);
            assert.equal(history.canUndo(), startIndex >= 0);
            assert.equal(history.canRedo(), true);
            assert.equal(notifications, 0, 'failed do must not emit a success notification');
        }

        // Prior applied commands remain undoable after a failed redo (A/B reproduction).
        if (startIndex >= 0) {
            history.undo();
            assert.deepEqual(state, before.slice(0, -1));
            history.redo();
            assert.deepEqual(state, before);
            assert.equal(history.index, startIndex);
        }
        fail = false;
        history.redo();
        assert.equal(history.index, startIndex + 1, 'successful retry advances exactly once');
        assert.deepEqual(state, [...before, commands[startIndex + 1].name]);
        assert.equal(history.isApplying, false);
        history.undo();
        assert.deepEqual(state, before);
        history.redo();
        assert.equal(history.index, startIndex + 1);
    }

    // A successful command must not be replayed merely because notification failed.
    const history = new HistoryManager();
    let value = 1;
    const command = { name: 'notify-failure', byteSize: 64, do() { value++; }, undo() { value--; } };
    history.record(command);
    history.undo();
    const notify = history._notifyHistoryChanged;
    history._notifyHistoryChanged = () => { throw new Error('injected notification failure'); };
    history.redo();
    assert.equal(value, 1);
    assert.equal(history.index, 0, 'successful do remains applied when notification throws');
    assert.equal(history.isApplying, false);
    assert.equal(history.stack[0], command);
    assert.equal(history.canRedo(), false);
    history.redo();
    assert.equal(value, 1, 'completed command must not execute twice');
    history._notifyHistoryChanged = notify;
    history.undo();
    assert.equal(value, 0);
    history.redo();
    assert.equal(value, 1);

    // Manager bookkeeping cannot undo arbitrary partial mutation inside a throwing command.
    const partial = new HistoryManager();
    let touched = false;
    partial.record({ name: 'partial', do() { touched = true; throw new Error('partial mutation'); }, undo() {} });
    partial.undo();
    partial.redo();
    assert.equal(partial.index, -1);
    assert.equal(partial.isApplying, false);
    assert.equal(touched, true, 'WP-001 does not promise command-level atomic rollback');
    assert(errors.length > 0, 'failure paths were exercised');
} finally {
    console.error = originalError;
}
console.log('verify-history-failure: first/middle/last redo, repeated failure, prior undo, retry, notification failure and partial-mutation boundary OK');
