import assert from 'node:assert/strict';

let idleCallback = null;
let cancelledIdleHandle = null;
globalThis.window = {
    BrushCore: { isDrawing: false },
    drawingEngine: { isDrawing: false },
    requestIdleCallback(callback) {
        idleCallback = callback;
        return 17;
    },
    cancelIdleCallback(handle) {
        cancelledIdleHandle = handle;
    }
};

const { EmergencyRecoveryStore } = await import('../system/emergency-recovery-store.js');

const idleStore = new EmergencyRecoveryStore();
let idleAttempts = 0;
idleStore._trySave = async () => {
    idleAttempts++;
};
idleStore._scheduleIdleAttempt();
assert.equal(idleStore._idleHandle, 17);
assert.equal(typeof idleCallback, 'function');
idleCallback();
await Promise.resolve();
assert.equal(idleAttempts, 1);
assert.equal(idleStore._idleHandle, null);

idleStore._scheduleIdleAttempt();
idleStore._cancelIdleAttempt();
assert.equal(cancelledIdleHandle, 17);
assert.equal(idleStore._idleHandle, null);

const drawingStore = new EmergencyRecoveryStore();
let retryDelay = null;
let saveAttempts = 0;
drawingStore._scheduleRetry = delay => {
    retryDelay = delay;
};
drawingStore.performSave = async () => {
    saveAttempts++;
};
window.BrushCore.isDrawing = true;
await drawingStore._trySave();
assert.equal(saveAttempts, 0);
assert.equal(drawingStore._pendingSave, true);
assert.equal(retryDelay, drawingStore._drawingRetryDelay);

window.BrushCore.isDrawing = false;
drawingStore._lastSaveTime = 0;
await drawingStore._trySave();
assert.equal(saveAttempts, 1);

const forceStore = new EmergencyRecoveryStore();
let forceOptions = null;
forceStore.performSave = async options => {
    forceOptions = options;
};
window.BrushCore.isDrawing = true;
forceStore.forceCheckpointSoon();
await Promise.resolve();
assert.deepEqual(forceOptions, { force: true });

const saveStore = new EmergencyRecoveryStore();
let savedCheckpoint = null;
let previewCalls = 0;
window.BrushCore.isDrawing = false;
window.projectManager = {
    async exportProject() {
        return { app: 'tegaki', animation: { lanes: [] } };
    }
};
window.exportManager = {
    async generatePreview() {
        previewCalls++;
        throw new Error('Emergency checkpoint must not generate a preview');
    }
};
saveStore.init = async () => {
    saveStore.db = {
        transaction() {
            return {
                objectStore() {
                    return {
                        put(data) {
                            savedCheckpoint = data;
                            const request = {};
                            queueMicrotask(() => request.onsuccess?.());
                            return request;
                        }
                    };
                }
            };
        }
    };
};
await saveStore.performSave({ force: true });
assert.equal(previewCalls, 0);
assert.equal(savedCheckpoint?.thumbnail, null);
assert.deepEqual(savedCheckpoint?.projectData, { app: 'tegaki', animation: { lanes: [] } });

console.log('verify-emergency-recovery-scheduling: idle start, drawing defer, forced checkpoint bypass, project-only checkpoint OK');
