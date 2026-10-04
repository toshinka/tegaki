/**
 * ROLE: WP-029 model/source/PNG の bounded verifier と cache evidence writer。
 * AUTHORITY: synthetic fixture と model output の検査だけ。製品 Project/History/renderer は変更しない。
 * INVARIANTS: PNG 制約、実寸 mesh bounds、4 vertices/2 triangles、角度/progress reject を確認する。
 * RELATED: advanced/rive-editor/model.mjs、run-editor.ps1、docs/work/WP-029-rive-editor-first-path.md。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    LIMITS,
    assertAngle,
    assertProgress,
    createRiveYaml,
    createSource,
    parseSourceMetadata,
    sha256Bytes,
    validatePngBytes,
    writeInitialFixture,
} from '../advanced/rive-editor/model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE = path.join(ROOT, '.cache', 'rive-editor');
const PROJECT = path.join(CACHE, 'project');

fs.mkdirSync(PROJECT, { recursive: true });
const fixturePath = writeInitialFixture(CACHE);
const fixture = fs.readFileSync(fixturePath);
const image = validatePngBytes(fixture);
if (!image.ok || image.width === 240 || image.height === 160 || image.width > LIMITS.maxPngDimension || image.height > LIMITS.maxPngDimension || image.width * image.height > LIMITS.maxPngPixels || image.bytes > LIMITS.maxPngBytes) {
    throw new Error(`unexpected editor fixture: ${JSON.stringify(image)}`);
}
fs.writeFileSync(path.join(PROJECT, 'fixture.png'), fixture);
fs.writeFileSync(path.join(PROJECT, 'rive.yaml'), createRiveYaml(image.width, image.height), 'utf8');
fs.writeFileSync(path.join(PROJECT, 'scene.rml'), createSource({ width: image.width, height: image.height, angle: LIMITS.restAngle }), 'utf8');

const sources = [-90, 30, 60, 90].map(angle => {
    const source = createSource({ width: image.width, height: image.height, angle });
    const metadata = parseSourceMetadata(source);
    const tolerance = 1e-6;
    const expectedBounds = {
        minX: -image.width / 2,
        maxX: image.width / 2,
        minY: -image.height / 2,
        maxY: image.height / 2,
    };
    const boundsMatch = metadata && Object.entries(expectedBounds).every(([key, value]) => Math.abs(metadata.meshBounds[key] - value) <= tolerance);
    const placementMatch = metadata && Math.abs(metadata.imageX - image.width / 2) <= tolerance
        && Math.abs(metadata.imageY - image.height / 2) <= tolerance
        && Math.abs(metadata.rootX) <= tolerance
        && Math.abs(metadata.rootY - image.height / 2) <= tolerance
        && Math.abs(metadata.boneLength - image.width / 2) <= tolerance;
    if (!metadata || metadata.width !== image.width || metadata.height !== image.height || metadata.vertices !== 4 || metadata.triangles !== 2 || metadata.angle !== angle || !boundsMatch || !placementMatch) {
        throw new Error(`source contract failed at ${angle}: ${JSON.stringify(metadata)}`);
    }
    return { angle, sourceHash: sha256Bytes(Buffer.from(source, 'utf8')), metadata };
});

for (const invalid of [Number.NaN, -91, 91, Infinity]) {
    let rejected = false;
    try { assertAngle(invalid); } catch { rejected = true; }
    if (!rejected) throw new Error(`invalid angle accepted: ${invalid}`);
}
for (const invalid of [-0.01, 1.01, Number.NaN]) {
    let rejected = false;
    try { assertProgress(invalid); } catch { rejected = true; }
    if (!rejected) throw new Error(`invalid progress accepted: ${invalid}`);
}

const report = {
    schema: 'tegaki.rive-editor.model-verification.v1',
    fixture: { path: fixturePath, ...image, sha256: sha256Bytes(fixture) },
    limits: LIMITS,
    sources,
    invalidAngleRejected: true,
    invalidProgressRejected: true,
};
fs.writeFileSync(path.join(CACHE, 'model-verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));

