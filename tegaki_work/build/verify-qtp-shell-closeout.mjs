import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storage = new Map();
globalThis.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
};

const body = {
    appendChild(element) {
        element.parentNode = this;
    }
};
const qButton = {
    style: { left: '', top: '' },
    offsetWidth: 28,
    offsetHeight: 32,
    parentNode: body,
    classList: { add() {} },
    getBoundingClientRect() { return { left: 8, top: 50, width: 28, height: 32 }; }
};
globalThis.window = { innerWidth: 260, innerHeight: 800 };
globalThis.document = {
    body,
    getElementById(id) { return id === 'quick-access-tool' ? qButton : null; }
};

const [
    { EventBus },
    { SettingsManager },
    { QuickAccessPopup },
    qtpSource,
    settingsPopupSource,
    settingsManagerSource
] = await Promise.all([
    import('../system/event-bus.js'),
    import('../system/settings-manager.js'),
    import('../ui/quick-access-popup.js'),
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/settings-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../system/settings-manager.js', import.meta.url), 'utf8')
]);

const eventBus = new EventBus();
const settingsManager = new SettingsManager(eventBus, {});
const visibilityEvents = [];
eventBus.on('settings:floating-q-visible', payload => visibilityEvents.push(payload.value));

assert.equal(settingsManager.kebabCase('floatingQVisible'), 'floating-q-visible');
assert.equal(settingsManager.set('floatingQVisible', false), true);
assert.deepEqual(visibilityEvents, [false], 'one SettingsManager mutation emits one semantic visibility event');
assert.equal(JSON.parse(storage.get('tegaki_settings')).floatingQVisible, false);
visibilityEvents.length = 0;
assert.equal(settingsManager.set('floatingQVisible', true), true);
assert.deepEqual(visibilityEvents, [true], 'the reverse transition also emits one event');
assert.equal(JSON.parse(storage.get('tegaki_settings')).floatingQVisible, true);

const settingKeysBody = settingsManagerSource.match(/const settingKeys = \[([\s\S]*?)\];/)?.[1] || '';
const settingKeys = [...settingKeysBody.matchAll(/'([^']+)'/g)].map(match => match[1]);
const legacyKebabCase = value => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const correctedKebabCase = value => value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
const changedSettingEventNames = settingKeys.filter(key => legacyKebabCase(key) !== correctedKebabCase(key));
assert.deepEqual(changedSettingEventNames, ['floatingQVisible'], 'existing settings event names remain unchanged');
assert.equal((qtpSource.match(/this\.eventBus\.on\('settings:floating-q-visible'/g) || []).length, 1);
assert.match(settingsPopupSource, /settingsManager\?\.set\('floatingQVisible', this\.elements\.floatingQVisible\.checked\)/);
assert.doesNotMatch(settingsPopupSource, /emit\('settings:floating-q-visible'/);

const panel = {
    style: { left: '', top: '' },
    offsetWidth: 400,
    offsetHeight: 300,
    getBoundingClientRect() { return { left: 0, top: 0, width: this.offsetWidth, height: this.offsetHeight }; }
};
const qtp = Object.create(QuickAccessPopup.prototype);
Object.assign(qtp, {
    panel,
    qButtonHomePosition: { x: 8, y: 50 },
    qButtonOriginalParent: body,
    qButtonOriginalInlinePosition: { left: '', top: '' },
    isAtHomePosition: true,
    _saveCalls: 0
});
qtp._savePosition = function () { this._saveCalls += 1; };

const toneHomePanel = qtp._getDefaultPosition();
assert.equal(toneHomePanel.x, 0, 'wide Tone panel is clamped to the viewport');
qtp._applySharedPosition(toneHomePanel.x, toneHomePanel.y, { source: 'home', persist: 'if-changed' });
assert.equal(Number.parseFloat(qButton.style.left), 8, 'Home keeps collapsed Q at its original Sidebar coordinate');
assert.equal(Number.parseFloat(qButton.style.top), 50);
assert.equal(Number.parseFloat(panel.style.left), 0);
assert.equal(qtp._saveCalls, 0, 'opening a clamped Home panel does not create an explicit saved position');

panel.offsetWidth = 220;
qtp._applySharedPosition(120, 90, { source: 'stored' });
assert.equal(
    Number.parseFloat(qButton.style.left) + qButton.offsetWidth / 2,
    Number.parseFloat(panel.style.left) + panel.offsetWidth / 2,
    'explicit moved positions retain Q/QTP center projection'
);

storage.set('quick-access-position', JSON.stringify({ x: 120, y: 90 }));
qtp.resetToDefaultPosition();
assert.equal(storage.has('quick-access-position'), false, 'Home removes the explicit position key');
assert.equal(qtp.isAtHomePosition, true);
assert.equal(Number.parseFloat(qButton.style.left), 8);
assert.equal(Number.parseFloat(qButton.style.top), 50);

const reloadedPosition = qtp._loadPosition();
qtp._applySharedPosition(reloadedPosition.x, reloadedPosition.y, {
    source: qtp.isAtHomePosition ? 'home' : 'stored'
});
assert.equal(qtp.isAtHomePosition, true, 'no saved position reloads into Home mode');
assert.equal(Number.parseFloat(qButton.style.left), 8, 'reload restores original collapsed Q home');

console.log('verify-qtp-shell-closeout: exact Home projection, no clamp persistence, explicit center projection and single visibility event route OK');
