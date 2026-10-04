/**
 * ROLE: WP-034 Slice A の四隅 weight encoding/validation の純粋な共有 model。
 * AUTHORITY: source の Weight bytes。UI draft や公式 CLI の派生物を所有しない。
 * INVARIANTS: Root/End の二骨、各 vertex の weight sum=255、固定 vertex 順を維持する。
 * RELATED: model.mjs、weight-editor.js、WP-034-rive-weights-playback.md。
 */

export const VERTEX_NAMES = Object.freeze(['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']);
export const DEFAULT_END_WEIGHTS = Object.freeze([0, 255, 255, 0]);

const UINT8_MAX = 255;
const UINT16_MAX = 65535;

function fail(message) {
    throw new Error(message);
}

function assertByte(value, label) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > UINT8_MAX) {
        fail(`${label} must be an integer between 0 and 255.`);
    }
    return value;
}

function assertPacked(value, label) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > UINT16_MAX) {
        fail(`${label} must be an integer between 0 and 65535.`);
    }
    return value;
}

function copyArray(value) {
    return Array.from(value, entry => entry);
}

export function cloneEndWeights(value = DEFAULT_END_WEIGHTS) {
    return copyArray(assertEndWeights(value));
}

/** Validate the source-authoritative End byte for each fixed vertex. */
export function assertEndWeights(value, label = 'End weights') {
    if (!(Array.isArray(value) || value instanceof Uint8Array) || value.length !== VERTEX_NAMES.length) {
        fail(`${label} must be an array of four bytes.`);
    }
    return Array.from(value, (entry, index) => assertByte(entry, `${label}[${VERTEX_NAMES[index]}]`));
}

export const validateEndWeights = assertEndWeights;

/** Convert one user percentage to a byte exactly once at the UI boundary. */
export function endPercentToByte(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
        fail('End percentage must be a finite number between 0 and 100.');
    }
    return Math.round(value * UINT8_MAX / 100);
}

/** Return the actual percentage represented by a source byte. */
export function byteToEndPercent(value) {
    const byte = assertByte(value, 'End byte');
    return Number((byte * 100 / UINT8_MAX).toFixed(2));
}

export function percentagesToEndWeights(value, label = 'End percentages') {
    if (!(Array.isArray(value) || value instanceof Uint8Array) || value.length !== VERTEX_NAMES.length) {
        fail(`${label} must be an array of four percentages.`);
    }
    return Array.from(value, (entry, index) => endPercentToByte(entry, `${label}[${VERTEX_NAMES[index]}]`));
}

export function endWeightsToPercentages(value) {
    return assertEndWeights(value).map(byteToEndPercent);
}

/** Pack a two-tendon weight using the official one-based tendon indices. */
export function encodePackedWeight(endByte) {
    const end = assertByte(endByte, 'End byte');
    if (end === 0) return { values: 255, indices: 1 };
    if (end === 255) return { values: 255, indices: 2 };
    return {
        values: (255 - end) | (end << 8),
        indices: 1 | (2 << 8),
    };
}

/** Decode one official packed Weight and reject unsupported profiles. */
export function decodePackedWeight(values, indices) {
    const packedValues = assertPacked(values, 'Packed weight values');
    const packedIndices = assertPacked(indices, 'Packed weight indices');
    if (packedIndices === 1 && packedValues === 255) return 0;
    if (packedIndices === 2 && packedValues === 255) return 255;
    if (packedIndices !== 513) fail('Packed weight indices must be Root, End, or Root|End (513).');
    const root = packedValues & UINT8_MAX;
    const end = (packedValues >>> 8) & UINT8_MAX;
    if (root < 1 || end < 1 || root + end !== UINT8_MAX) {
        fail('Packed mixed weight values must contain positive Root and End bytes summing to 255.');
    }
    return end;
}

export function encodeWeightRecords(endWeights) {
    return assertEndWeights(endWeights).map((endByte, index) => ({
        name: VERTEX_NAMES[index],
        endByte,
        ...encodePackedWeight(endByte),
    }));
}

/** Decode exactly the four source vertex records in their required order. */
export function decodeWeightRecords(records) {
    if (!Array.isArray(records) || records.length !== VERTEX_NAMES.length) {
        fail('Source must contain exactly four Weight records.');
    }
    return records.map((record, index) => {
        if (!record || record.name !== VERTEX_NAMES[index]) {
            fail(`Source vertex ${VERTEX_NAMES[index]} is missing or out of order.`);
        }
        return decodePackedWeight(record.values, record.indices);
    });
}

export const encodeWeights = encodeWeightRecords;
export const decodeWeights = decodeWeightRecords;

