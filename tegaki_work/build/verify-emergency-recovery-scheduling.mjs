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

const configuredStore = new EmergencyRecoveryStore();
assert.deepEqual(configuredStore.getStatus(), {
    periodicEnabled: true,
    saveOnHide: true,
    intervalSeconds: 60,
    lastSaveTime: null,
    lastSaveReason: null,
    isSaving: false,
    pending: false
});
assert.equal(configuredStore.scheduleCheckpoint(), true);
assert.notEqual(configuredStore._debounceTimer, null);
configuredStore.configure({ periodicEnabled: false, intervalSeconds: 30, saveOnHide: false });
assert.equal(configuredStore._debounceTimer, null);
assert.equal(configuredStore._pendingSave, false);
assert.equal(configuredStore.scheduleCheckpoint(), false);
assert.equal(configuredStore.getStatus().intervalSeconds, 30);
configuredStore.configure({ intervalSeconds: 17 });
assert.equal(configuredStore.getStatus().intervalSeconds, 30);
assert.equal(await configuredStore._trySave(), false);
assert.equal(await configuredStore.performSave(), false);

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
forceStore.configure({ saveOnHide: false });
assert.equal(forceStore.forceCheckpointSoon({ reason: 'visibility-hidden' }), false);
assert.equal(forceOptions, null);
forceStore.configure({ saveOnHide: true });
assert.equal(forceStore.forceCheckpointSoon({ reason: 'visibility-hidden' }), true);
await Promise.resolve();
assert.deepEqual(forceOptions, { force: true, reason: 'visibility-hidden' });

const saveStore = new EmergencyRecoveryStore();
let savedCheckpoint = null;
let previewCalls = 0;
let savedEvent = null;
saveStore.configure({
    eventBus: {
        emit(name, payload) {
            if (name === 'emergency-recovery:saved') savedEvent = payload;
        }
    }
});
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
assert.equal(await saveStore.performSave({ force: true }), true);
assert.equal(previewCalls, 0);
assert.equal(savedCheckpoint?.thumbnail, null);
assert.deepEqual(savedCheckpoint?.projectData, { app: 'tegaki', animation: { lanes: [] } });
assert.equal(savedEvent?.timestamp, savedCheckpoint?.timestamp);
assert.equal(savedEvent?.reason, 'forced');
assert.equal(saveStore.getStatus().lastSaveReason, 'forced');

console.log('verify-emergency-recovery-scheduling: settings, idle start, drawing defer, hide gate, project-only checkpoint OK');
