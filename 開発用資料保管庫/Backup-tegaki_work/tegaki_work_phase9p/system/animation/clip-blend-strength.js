export function clampBlendStrength(value, fallback = 1) {
    const resolved = Number.isFinite(value) ? value : fallback;
    return Math.max(0, Math.min(1, resolved));
}

export function blendClipChannel(backdrop, source, mode) {
    const back = Math.max(0, Math.min(255, backdrop));
    const front = Math.max(0, Math.min(255, source));
    if (mode === 'add') return Math.min(255, back + front);
    if (mode === 'subtract') return Math.max(0, back - front);
    if (mode === 'multiply') return back * front / 255;
    if (mode === 'overlay') {
        return back < 127.5
            ? 2 * back * front / 255
            : 255 - 2 * (255 - back) * (255 - front) / 255;
    }
    return front;
}

export function compositeClipPixel(backdrop, source, mode, strength = 1) {
    const sourceAlpha = Math.max(0, Math.min(1, source[3] / 255));
    const destinationAlpha = Math.max(0, Math.min(1, backdrop[3] / 255));
    const amount = clampBlendStrength(strength);
    const effectiveAlpha = sourceAlpha * amount;
    const output = [0, 0, 0, 0];
    for (let channel = 0; channel < 3; channel += 1) {
        const back = backdrop[channel];
        output[channel] = Math.round(
            blendClipChannel(back, source[channel], mode) * effectiveAlpha
            + back * (1 - effectiveAlpha)
        );
    }
    output[3] = Math.round((effectiveAlpha + destinationAlpha * (1 - effectiveAlpha)) * 255);
    return output;
}
