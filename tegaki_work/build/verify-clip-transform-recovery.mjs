/** WP-003: real recovery scheduler/save; only export/IndexedDB/timers are host fakes. */
import assert from 'node:assert/strict';
import { TRANSFORM_EDIT_TRANSACTION_TARGET as TARGET } from '../system/animation/transform-edit-transaction.js';
globalThis.window = {};
const { EmergencyRecoveryStore } = await import('../system/emergency-recovery-store.js');
for (const target of [TARGET.CLIP_TRANSFORM_KEY, TARGET.CLIP_LAYER_TRANSFORM_KEY]) {
    let activeTarget = target;
    let exports = 0;
    let writes = 0;
    const retries = [];
    window.projectManager = {
        layerSystem: { getActiveTransformEditTarget: () => activeTarget },
        async exportProject() { exports++; return { app: 'tegaki' }; }
    };
    const store = new EmergencyRecoveryStore();
    store._scheduleRetry = delay => retries.push(delay);
    store.db = { transaction: () => ({ objectStore: () => ({ put() {
        writes++;
        const request = {};
        queueMicrotask(() => request.onsuccess());
        return request;
    } }) }) };
    await store._trySave();
    await store.performSave(); // check again at the actual capture boundary
    assert.equal(exports, 0);
    assert.equal(writes, 0);
    assert.equal(store._pendingSave, true);
    assert.equal(store._isSaving, false);
    assert.deepEqual(retries, [500, 500]);
    activeTarget = TARGET.LAYER_SOURCE;
    assert.equal(await store._trySave(), true);
    assert.equal(exports, 1);
    assert.equal(writes, 1);
    assert.equal(store._pendingSave, false);
    activeTarget = target;
    assert.equal(await store.performSave({ force: true, reason: 'visibility-hidden' }), true);
    assert.equal(exports, 2, 'forced checkpoint retains its existing terminal');
    assert.equal(writes, 2);
    store.configure({ periodicEnabled: false });
    assert.equal(await store._trySave(), false);
    assert.equal(exports, 2);
}
console.log('WP-003 recovery: Timeline session deferral, pending retry, post-exit save, forced behavior passed.');
