/**
 * Pure verification for the new tapered focus flash and ratio presets.
 * This verifier intentionally does not start Vite, a browser, a server, or a
 * renderer.  Product/browser/Owner acceptance remains with the lead/Owner.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFocusFlash, normalizeFocusFlash } from '../system/focus-flash-geometry.js';
import { FOCUS_PRESETS, resolveFocusLinesPreset } from '../system/focus-lines-presets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const geometryPath = path.join(root, 'system', 'focus-flash-geometry.js');

function near(actual, expected, tolerance = 1e-6) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);
}

function finitePoint(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function ellipseRadius(rx, ry, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return 1 / Math.sqrt((c * c) / (rx * rx) + (s * s) / (ry * ry));
}

function hashGeometry(geometry) {
    return JSON.stringify(geometry);
}

function assertOrderedEllipse(points, center) {
    assert.ok(points.length === 128 || points.length === 256);
    for (const point of points) assert.ok(finitePoint(point));
    const angles = points.map(point => Math.atan2(point.y - center.y, point.x - center.x));
    let previous = angles[0];
    for (let index = 1; index < angles.length; index += 1) {
        let current = angles[index];
        while (current < previous) current += Math.PI * 2;
        assert.ok(current > previous - 0.1, 'ellipse points must be ordered');
        previous = current;
    }
}

function verifySanitizer() {
    assert.equal(normalizeFocusFlash(null), null);
    assert.equal(normalizeFocusFlash({ kind: 'tapered', depth: 999 }).depth, 3);
    assert.equal(normalizeFocusFlash({ kind: 'tapered', depth: 1.5 }).depth, 1.5);
    assert.equal(normalizeFocusFlash({}), null);
    assert.equal(normalizeFocusFlash({ kind: 'outline' }), null);
    assert.deepEqual(normalizeFocusFlash({ kind: 'tapered' }), {
        kind: 'tapered', depth: 0.45, fill: 'none', paperColor: '#f1e2d8', ellipse: 'none', ellipseWidth: 2
    });
    assert.deepEqual(normalizeFocusFlash({
        kind: 'tapered', depth: -100, fill: 'inside', paperColor: '#AABBCC', ellipse: 'outline', ellipseWidth: 999
    }), {
        kind: 'tapered', depth: 0.05, fill: 'inside', paperColor: '#AABBCC', ellipse: 'outline', ellipseWidth: 60
    });
    assert.deepEqual(normalizeFocusFlash({
        kind: 'tapered', depth: Number.NaN, fill: 'bad', paperColor: 'javascript:alert(1)', ellipse: 'bad', ellipseWidth: Infinity
    }), {
        kind: 'tapered', depth: 0.45, fill: 'none', paperColor: '#f1e2d8', ellipse: 'none', ellipseWidth: 2
    });
}

function verifyPresets() {
    assert.deepEqual(FOCUS_PRESETS.map(preset => preset.id), ['focus', 'uni', 'rough']);
    assert.equal(resolveFocusLinesPreset('unknown', { width: 400, height: 400 }), null);
    for (const canvas of [
        { width: 400, height: 400 },
        { width: 1700, height: 2400 },
        { width: 4960, height: 7016 }
    ]) {
        const shortCanvas = Math.min(canvas.width, canvas.height);
        const focus = resolveFocusLinesPreset('focus', canvas);
        const uni = resolveFocusLinesPreset('uni', canvas);
        const rough = resolveFocusLinesPreset('rough', canvas, { center: { x: 17, y: 29 }, seed: 77 });
        assert.equal(focus.count, 120);
        assert.equal(uni.count, 150);
        assert.equal(rough.count, 150);
        near(focus.innerRx, shortCanvas * 0.22);
        near(uni.innerRx, shortCanvas * 0.29);
        near(uni.widthMin, 4 * shortCanvas / 400);
        near(uni.widthMax, 8 * shortCanvas / 400);
        assert.deepEqual(rough.center, { x: 17, y: 29 });
        assert.equal(uni.flash.depth, 0.45);
        assert.equal(rough.angleJitter > uni.angleJitter, true);
        assert.equal(rough.lengthJitter > uni.lengthJitter, true);
    }
}

function verifyGeometry() {
    for (const canvas of [
        { width: 400, height: 400 },
        { width: 1700, height: 2400 },
        { width: 4960, height: 7016 }
    ]) {
        const params = resolveFocusLinesPreset('uni', canvas);
        const geometry = buildFocusFlash(params, canvas);
        assert.equal(geometry.kind, 'tapered');
        assert.equal(geometry.polygons.length, 150);
        assert.equal(geometry.boundary.length, 128);
        assert.equal(geometry.opening.length, 128);
        assert.equal(geometry.fill, 'none');
        assert.equal(geometry.paperColor, '#f1e2d8');
        assert.equal(geometry.ellipse, 'none');
        assertOrderedEllipse(geometry.boundary, params.center);
        assertOrderedEllipse(geometry.opening, params.center);
        const innerJitter = geometry.polygons.map(polygon => {
            const angle = Math.atan2(polygon[0].y - params.center.y, polygon[0].x - params.center.x);
            return distance(polygon[0], params.center) - ellipseRadius(params.innerRx, params.innerRy, angle);
        });
        assert.ok(innerJitter.some(value => Math.abs(value) > 1e-6), 'inner tips must jitter independently');
        assert.ok(innerJitter.some(value => value > 0) && innerJitter.some(value => value < 0), 'inner jitter should vary both ways');
        const shortestInnerTip = Math.min(...geometry.polygons.map(polygon => distance(polygon[0], params.center)));
        const longestOpening = Math.max(...geometry.opening.map(point => distance(point, params.center)));
        assert.ok(longestOpening < shortestInnerTip, 'opening must stay inside the shortest inner tip');
        const bandLengths = [];
        for (const polygon of geometry.polygons) {
            assert.equal(polygon.length, 4);
            for (const point of polygon) assert.ok(finitePoint(point));
            // The two tips are points; the centre pair creates the diamond band.
            assert.ok(distance(polygon[0], polygon[1]) > 0);
            assert.ok(distance(polygon[2], polygon[1]) > 0);
            assert.ok(distance(polygon[0], polygon[2]) > 0);
            assert.ok(distance(polygon[0], params.center) < distance(polygon[1], params.center), 'inner tip must stay below middle band');
            bandLengths.push(distance(polygon[0], polygon[2]));
        }
        assert.ok(Math.min(...bandLengths) > 0);
        assert.ok(Math.max(...bandLengths) / Math.min(...bandLengths) < 1.4);

        const full = buildFocusFlash({ ...params, flash: { ...params.flash, depth: 1 } }, canvas);
        const deeper = buildFocusFlash({ ...params, flash: { ...params.flash, depth: 3 } }, canvas);
        for (let i = 0; i < deeper.polygons.length; i++) {
            assert.ok(deeper.polygons[i].every(finitePoint));
            assert.ok(distance(deeper.polygons[i][0], deeper.polygons[i][2]) > distance(full.polygons[i][0], full.polygons[i][2]) * 2,
                'extended depth must actually lengthen the band');
        }

        const same = buildFocusFlash(params, canvas);
        assert.equal(hashGeometry(geometry), hashGeometry(same), 'same seed must reproduce geometry');
        const different = buildFocusFlash({ ...params, seed: params.seed + 1 }, canvas);
        assert.notEqual(hashGeometry(geometry), hashGeometry(different), 'seed must change geometry');
        const countChanged = buildFocusFlash({ ...params, count: 180 }, canvas);
        for (let index = 0; index < 20; index += 1) {
            near(
                distance(geometry.polygons[index][1], geometry.polygons[index][3]),
                distance(countChanged.polygons[index][1], countChanged.polygons[index][3])
            );
        }

        const rough = buildFocusFlash(resolveFocusLinesPreset('rough', canvas), canvas);
        assert.equal(rough.polygons.length, 150);
        assert.ok(hashGeometry(rough) !== hashGeometry(geometry));
    }
}

function verifyBoundsAndMaliciousInputs() {
    const malicious = buildFocusFlash({
        center: { x: Infinity, y: -Infinity },
        innerRx: Number.MAX_VALUE,
        innerRy: 'not-a-number',
        count: Number.MAX_VALUE,
        widthMin: -Infinity,
        widthMax: Number.MAX_VALUE,
        angleJitter: 'bad',
        lengthJitter: Infinity,
        seed: Symbol('bad'),
        color: 'url(javascript:bad)',
        flash: { kind: 'tapered', depth: -Infinity, ellipseWidth: Number.MAX_VALUE }
    }, { width: 1700, height: 2400 });
    assert.equal(malicious.polygons.length, 600);
    assert.equal(malicious.boundary.length, 128);
    for (const point of malicious.boundary.concat(malicious.opening, ...malicious.polygons)) {
        assert.ok(finitePoint(point));
        assert.ok(Math.abs(point.x) < 20_000_000);
        assert.ok(Math.abs(point.y) < 20_000_000);
    }
}

function verifyLegacyIsolation() {
    const source = fs.readFileSync(geometryPath, 'utf8');
    assert.equal(/from\s+['"].*focus-lines\.js['"]/.test(source), false);
    assert.equal(/\b(?:document|window|PIXI|CanvasRenderingContext2D)\b/.test(source), false);
}

verifySanitizer();
verifyPresets();
verifyGeometry();
verifyBoundsAndMaliciousInputs();
verifyLegacyIsolation();

console.log('verify-focus-flash: PASS');
console.log('  APIs: normalizeFocusFlash, buildFocusFlash, FOCUS_PRESETS, resolveFocusLinesPreset');
console.log('  examples: 400x400, 1700x2400, 4960x7016; uni/rough count=150; boundary/opening=128');
console.log('  checks: taper diamond, finite bounded geometry, seed repeatability, ratio presets, malicious input, legacy isolation');

