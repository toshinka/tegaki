import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
    getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
        storage.set(key, String(value));
    }
};
globalThis.window = {};

const listeners = new Map();
const emitted = [];
const eventBus = {
    on(name, handler) {
        const list = listeners.get(name) || [];
        list.push(handler);
        listeners.set(name, list);
    },
    emit(name, payload) {
        emitted.push({ name, payload });
        (listeners.get(name) || []).forEach(handler => handler(payload));
    }
};

const { SettingsManager } = await import('../system/settings-manager.js');
const settings = new SettingsManager(eventBus, {});

assert.equal(settings.get('emergencyRecoveryEnabled'), true);
assert.equal(settings.get('emergencyRecoveryIntervalSeconds'), 60);
assert.equal(settings.get('emergencyRecoveryOnHide'), true);

assert.equal(settings.set('emergencyRecoveryEnabled', false), true);
assert.equal(settings.get('emergencyRecoveryEnabled'), false);
assert.equal(settings.set('emergencyRecoveryIntervalSeconds', 30), true);
assert.equal(settings.get('emergencyRecoveryIntervalSeconds'), 30);
assert.equal(settings.set('emergencyRecoveryIntervalSeconds', 45), false);
assert.equal(settings.get('emergencyRecoveryIntervalSeconds'), 30);
assert.equal(settings.set('emergencyRecoveryOnHide', false), true);
assert.equal(settings.get('emergencyRecoveryOnHide'), false);

eventBus.emit('settings:emergency-recovery-interval-seconds', { value: 180 });
assert.equal(settings.get('emergencyRecoveryIntervalSeconds'), 180);
assert.equal(
    emitted.some(entry => entry.name === 'settings:emergency-recovery-enabled'),
    true
);

const stored = JSON.parse(storage.get('tegaki_settings'));
assert.equal(stored.emergencyRecoveryEnabled, false);
assert.equal(stored.emergencyRecoveryIntervalSeconds, 180);
assert.equal(stored.emergencyRecoveryOnHide, false);

console.log('verify-emergency-recovery-settings: defaults, validation, persistence, EventBus OK');
