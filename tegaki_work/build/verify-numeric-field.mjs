import assert from 'node:assert/strict';

class TestEvent {
    constructor(type, init = {}) {
        this.type = type;
        this.bubbles = Boolean(init.bubbles);
        this.cancelable = Boolean(init.cancelable);
        Object.assign(this, init);
        this.defaultPrevented = false;
    }

    preventDefault() {
        this.defaultPrevented = true;
    }

    stopPropagation() {
        this.propagationStopped = true;
    }
}

class FakeElement {
    constructor(kind = 'div') {
        this.kind = kind;
        this.listeners = new Map();
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.dataset = {};
        this.value = '';
        this.min = '';
        this.max = '';
        this.step = '';
        this.textContent = '';
        this.title = '';
        this.disabled = false;
        this.readOnly = false;
    }

    addEventListener(type, listener) {
        const current = this.listeners.get(type) || [];
        current.push(listener);
        this.listeners.set(type, current);
    }

    removeEventListener(type, listener) {
        const current = this.listeners.get(type) || [];
        this.listeners.set(type, current.filter(candidate => candidate !== listener));
    }

    dispatchEvent(event) {
        if (!event.target) event.target = this;
        event.currentTarget = this;
        for (const listener of [...(this.listeners.get(event.type) || [])]) listener.call(this, event);
        return !event.defaultPrevented;
    }

    appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        return child;
    }

    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }

    querySelector(selector) {
        if (selector === 'input') {
            return this.children.find(child => child.kind === 'input') || null;
        }
        return null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    focus() {}

    select() {}
}

globalThis.Event = TestEvent;
globalThis.document = {
    createElement: kind => new FakeElement(kind)
};

const { attachNumericField } = await import('../ui/numeric-field.js');

function wheel(target, deltaY, init = {}) {
    const event = {
        type: 'wheel',
        deltaY,
        shiftKey: Boolean(init.shiftKey),
        altKey: Boolean(init.altKey),
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; }
    };
    target.dispatchEvent(event);
    return event;
}

function inputEvent() {
    return new TestEvent('input', { bubbles: true });
}

// Existing range + valueEl callers keep their wheel, modifier, bounds, and detach behavior.
{
    const range = new FakeElement('input');
    range.min = '0';
    range.max = '10';
    range.step = '0.5';
    range.value = '5';
    const valueEl = new FakeElement();
    valueEl.textContent = '5';
    let rangeInputs = 0;
    range.addEventListener('input', () => { rangeInputs += 1; });
    const detach = attachNumericField({
        range,
        valueEl,
        toDisplay: raw => raw * 10,
        fromDisplay: shown => shown / 10
    });

    let event = wheel(range, -1);
    assert.equal(range.value, '5.5');
    assert.equal(rangeInputs, 1);
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);

    event = wheel(valueEl, 1, { shiftKey: true });
    assert.equal(range.value, '0.5');
    assert.equal(rangeInputs, 2);
    assert.equal(event.defaultPrevented, true);

    event = wheel(range, 0);
    assert.equal(range.value, '0.5');
    assert.equal(rangeInputs, 2);
    assert.equal(event.defaultPrevented, false);

    range.value = 'not-a-number';
    event = wheel(range, -1);
    assert.equal(rangeInputs, 2);
    assert.equal(event.defaultPrevented, false);
    range.value = '5';
    range.disabled = true;
    event = wheel(valueEl, -1);
    assert.equal(range.value, '5');
    assert.equal(event.defaultPrevented, false);
    range.disabled = false;

    // Existing valueEl dblclick conversion remains display-unit aware.
    valueEl.dispatchEvent({ type: 'dblclick', preventDefault() {} });
    const editor = valueEl.querySelector('input');
    assert.ok(editor);
    editor.value = '65';
    editor.dispatchEvent(new TestEvent('keydown', { key: 'Enter' }));
    assert.equal(range.value, '6.5');
    assert.equal(rangeInputs, 3);
    assert.equal(valueEl.dataset.editing, undefined);

    detach();
    event = wheel(range, -1);
    assert.equal(range.value, '6.5');
    assert.equal(event.defaultPrevented, false);
}

// range + numberInput bridges display units and fires the existing range input once per change.
{
    const range = new FakeElement('input');
    range.min = '0';
    range.max = '2';
    range.step = '0.1';
    range.value = '1';
    const numberInput = new FakeElement('input');
    numberInput.min = '0';
    numberInput.max = '200';
    numberInput.step = '10';
    let rangeInputs = 0;
    range.addEventListener('input', () => { rangeInputs += 1; });
    const detach = attachNumericField({
        range,
        numberInput,
        toDisplay: raw => raw * 100,
        fromDisplay: shown => shown / 100
    });
    assert.equal(numberInput.value, '100');

    numberInput.value = '151';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(range.value, '1.5');
    assert.equal(numberInput.value, '150');
    assert.equal(rangeInputs, 1);

    numberInput.value = '150';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(rangeInputs, 1, 'same numberInput value does not duplicate range input');
    let event;

    numberInput.value = '';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(numberInput.value, '', 'empty paired input remains empty while typing');
    assert.equal(range.value, '1.5');
    assert.equal(rangeInputs, 1);
    event = wheel(numberInput, -1);
    assert.equal(event.defaultPrevented, false, 'empty paired input does not consume wheel');
    numberInput.value = '  ';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(numberInput.value, '  ', 'whitespace paired input remains untouched');
    assert.equal(rangeInputs, 1);
    event = wheel(numberInput, -1);
    assert.equal(event.defaultPrevented, false, 'whitespace paired input does not consume wheel');
    numberInput.value = '150';

    event = wheel(numberInput, -1);
    assert.equal(range.value, '1.6');
    assert.equal(numberInput.value, '160');
    assert.equal(rangeInputs, 2);
    assert.equal(event.defaultPrevented, true);

    event = wheel(numberInput, -1, { shiftKey: true });
    assert.equal(range.value, '2');
    assert.equal(numberInput.value, '200');
    assert.equal(rangeInputs, 3);

    range.value = '0.5';
    range.dispatchEvent(inputEvent());
    assert.equal(numberInput.value, '50');

    numberInput.value = 'abc';
    event = wheel(numberInput, -1);
    assert.equal(rangeInputs, 4);
    assert.equal(event.defaultPrevented, false);
    numberInput.value = '50';
    numberInput.readOnly = true;
    event = wheel(numberInput, -1);
    assert.equal(range.value, '0.5');
    assert.equal(event.defaultPrevented, false);
    numberInput.readOnly = false;

    detach();
    numberInput.value = '100';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(rangeInputs, 4);
}

// numberInput without range supports placement/grid-style values and emits its own input once.
{
    const numberInput = new FakeElement('input');
    numberInput.min = '-1';
    numberInput.max = '3';
    numberInput.step = '0.5';
    numberInput.value = '1';
    let inputCount = 0;
    numberInput.addEventListener('input', () => { inputCount += 1; });
    const detach = attachNumericField({ numberInput });

    let event = wheel(numberInput, -1);
    assert.equal(numberInput.value, '1.5');
    assert.equal(inputCount, 1);
    assert.equal(event.defaultPrevented, true);

    event = wheel(numberInput, -1, { shiftKey: true });
    assert.equal(numberInput.value, '3');
    assert.equal(inputCount, 2);

    numberInput.value = '';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(numberInput.value, '', 'empty standalone input remains under parent model control');
    assert.equal(inputCount, 3);
    event = wheel(numberInput, -1);
    assert.equal(event.defaultPrevented, false, 'empty standalone input does not consume wheel');

    numberInput.value = '  ';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(numberInput.value, '  ', 'whitespace standalone input remains untouched');
    assert.equal(inputCount, 4);
    event = wheel(numberInput, -1);
    assert.equal(event.defaultPrevented, false, 'whitespace standalone input does not consume wheel');

    numberInput.value = '-5';
    numberInput.dispatchEvent(inputEvent());
    assert.equal(numberInput.value, '-5', 'standalone typing is left to the parent model');
    assert.equal(inputCount, 5, 'typing does not redispatch a normalized input');

    numberInput.value = '1';
    numberInput.disabled = true;
    event = wheel(numberInput, -1);
    assert.equal(numberInput.value, '1');
    assert.equal(event.defaultPrevented, false);
    numberInput.disabled = false;
    numberInput.value = 'not-a-number';
    event = wheel(numberInput, -1);
    assert.equal(event.defaultPrevented, false);

    detach();
    numberInput.value = '1';
    event = wheel(numberInput, -1);
    assert.equal(numberInput.value, '1');
    assert.equal(event.defaultPrevented, false);
}

{
    const numberInput = new FakeElement('input');
    numberInput.value = '1';
    const detach = attachNumericField({ numberInput });
    const event = wheel(numberInput, -1);
    assert.equal(numberInput.value, '2', 'standalone input without optional bounds uses a unit step');
    assert.equal(event.defaultPrevented, true);
    detach();
}

assert.doesNotThrow(() => attachNumericField({})());
console.log('verify-numeric-field: range/value display, numberInput bridge, standalone wheel, guards, conversion, and detach ok');
