/** Pure fingerprint for the editable-lettering / committed-raster pair (WP-025). */
export function letteringRasterFingerprint(snapshot) {
    if (!snapshot?.pixels || snapshot.pixels.length !== snapshot.width * snapshot.height * 4) return null;
    let hash = 2166136261;
    const mix = value => { hash = Math.imul(hash ^ value, 16777619) >>> 0; };
    const bytes = snapshot.pixels;
    for (let i = 0; i < bytes.length; i += 4) {
        const a = bytes[i + 3];
        mix(Math.round(bytes[i] * a / 255)); mix(Math.round(bytes[i + 1] * a / 255));
        mix(Math.round(bytes[i + 2] * a / 255)); mix(a);
    }
    const b = snapshot.rasterBounds || { x: 0, y: 0, width: snapshot.width, height: snapshot.height };
    return { hash: hash.toString(16).padStart(8, '0'), width: snapshot.width, height: snapshot.height,
        rasterBounds: { x: b.x, y: b.y, width: b.width, height: b.height } };
}
export function letteringFingerprintMatches(a, b) {
    return !!a && !!b && a.hash === b.hash && a.width === b.width && a.height === b.height
        && ['x', 'y', 'width', 'height'].every(key => a.rasterBounds?.[key] === b.rasterBounds?.[key]);
}
