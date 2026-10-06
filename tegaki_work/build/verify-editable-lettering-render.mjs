import assert from 'node:assert/strict';
import { parseSvgPath, shapeLettering } from '../system/lettering-font-engine.js';
import { renderLettering } from '../system/lettering-vector-renderer.js';

const FONT_ID = 'synthetic-square-hole';
const UPEM = 1000;

function u16(view, offset, value) { view.setUint16(offset, value & 0xffff, false); }
function i16(view, offset, value) { view.setInt16(offset, value, false); }
function u32(view, offset, value) { view.setUint32(offset, value >>> 0, false); }
function tag(bytes, offset, value) {
    for (let index = 0; index < 4; index += 1) bytes[offset + index] = value.charCodeAt(index) || 0;
}
function align4(value) { return (value + 3) & ~3; }

function makeHead() {
    const bytes = new Uint8Array(54);
    const view = new DataView(bytes.buffer);
    u32(view, 0, 0x00010000);
    u32(view, 4, 0x00010000);
    u32(view, 12, 0x5f0f3cf5);
    u16(view, 16, 0);
    u16(view, 18, UPEM);
    i16(view, 36, 0);
    i16(view, 38, 0);
    i16(view, 40, 600);
    i16(view, 42, 800);
    u16(view, 44, 0);
    u16(view, 46, 8);
    i16(view, 48, 2);
    i16(view, 50, 0);
    i16(view, 52, 0);
    return bytes;
}

function makeMaxp() {
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    u32(view, 0, 0x00010000);
    u16(view, 4, 2);
    u16(view, 6, 8);
    u16(view, 8, 2);
    u16(view, 10, 0);
    u16(view, 12, 0);
    u16(view, 14, 2);
    u16(view, 16, 0);
    u16(view, 18, 0);
    u16(view, 20, 0);
    u16(view, 22, 0);
    u16(view, 24, 0);
    u16(view, 26, 0);
    u16(view, 28, 0);
    u16(view, 30, 0);
    return bytes;
}

function makeHhea() {
    const bytes = new Uint8Array(36);
    const view = new DataView(bytes.buffer);
    u32(view, 0, 0x00010000);
    i16(view, 4, 800);
    i16(view, 6, -200);
    i16(view, 8, 0);
    u16(view, 10, 650);
    i16(view, 12, 0);
    i16(view, 14, 50);
    i16(view, 16, 600);
    i16(view, 18, 1);
    i16(view, 20, 0);
    i16(view, 22, 0);
    i16(view, 24, 0);
    i16(view, 26, 0);
    i16(view, 28, 0);
    i16(view, 30, 0);
    i16(view, 32, 0);
    u16(view, 34, 2);
    return bytes;
}

function makeHmtx() {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    u16(view, 0, 600); i16(view, 2, 0);
    u16(view, 4, 650); i16(view, 6, 0);
    return bytes;
}

function writeSimpleGlyph(view, offset) {
    // Two four-point contours. Outer is clockwise in font coordinates and the
    // inner contour is opposite winding, producing a nonzero-rule hole.
    i16(view, offset, 2);
    i16(view, offset + 2, 0); i16(view, offset + 4, 0);
    i16(view, offset + 6, 600); i16(view, offset + 8, 800);
    u16(view, offset + 10, 3); u16(view, offset + 12, 7);
    u16(view, offset + 14, 0);
    const flagsOffset = offset + 16;
    for (let index = 0; index < 8; index += 1) view.setUint8(flagsOffset + index, 1);
    // Coordinates are deltas from the preceding point, including across
    // contour boundaries; the inner contour starts back at x=150.
    const xDeltas = [0, 0, 600, 0, -450, 300, 0, -300];
    const yDeltas = [0, 800, 0, -800, 150, 0, 500, 0];
    let cursor = flagsOffset + 8;
    for (const delta of xDeltas) { i16(view, cursor, delta); cursor += 2; }
    for (const delta of yDeltas) { i16(view, cursor, delta); cursor += 2; }
    return cursor - offset;
}

function makeGlyf() {
    const bytes = new Uint8Array(66);
    const view = new DataView(bytes.buffer);
    // Glyph 0 is a valid empty .notdef header; glyph 1 starts at offset 10.
    i16(view, 0, 0);
    i16(view, 10, 2);
    const length = writeSimpleGlyph(view, 10);
    assert.equal(length, 56);
    return bytes;
}

function makeLoca() {
    const bytes = new Uint8Array(6);
    const view = new DataView(bytes.buffer);
    // Short loca offsets are divided by two: glyph0 [0,10), glyph1 [10,66).
    u16(view, 0, 0); u16(view, 2, 5); u16(view, 4, 33);
    return bytes;
}

function makeCmap() {
    const bytes = new Uint8Array(52);
    const view = new DataView(bytes.buffer);
    u16(view, 0, 0);
    u16(view, 2, 1);
    u16(view, 4, 3); u16(view, 6, 1); u32(view, 8, 12);
    const offset = 12;
    const segmentCount = 3;
    u16(view, offset, 4);
    u16(view, offset + 2, 40);
    u16(view, offset + 4, 0);
    u16(view, offset + 6, segmentCount * 2);
    u16(view, offset + 8, 4);
    u16(view, offset + 10, 1);
    u16(view, offset + 12, 2);
    const endCodes = [0x0041, 0x3042, 0xffff];
    const startCodes = [0x0041, 0x3042, 0xffff];
    const idDeltas = [(1 - 0x0041 + 0x10000) & 0xffff, (1 - 0x3042 + 0x10000) & 0xffff, 1];
    let cursor = offset + 14;
    for (const value of endCodes) { u16(view, cursor, value); cursor += 2; }
    u16(view, cursor, 0); cursor += 2;
    for (const value of startCodes) { u16(view, cursor, value); cursor += 2; }
    for (const value of idDeltas) { u16(view, cursor, value); cursor += 2; }
    for (let index = 0; index < segmentCount; index += 1) { u16(view, cursor, 0); cursor += 2; }
    return bytes;
}

/** A tiny checksums-free SFNT containing glyph 0 and one square-with-hole glyph. */
function syntheticFontBytes() {
    const tables = [
        ['cmap', makeCmap()],
        ['glyf', makeGlyf()],
        ['head', makeHead()],
        ['hhea', makeHhea()],
        ['hmtx', makeHmtx()],
        ['loca', makeLoca()],
        ['maxp', makeMaxp()]
    ].sort((left, right) => left[0].localeCompare(right[0]));
    const directoryEnd = 12 + tables.length * 16;
    let offset = align4(directoryEnd);
    const placements = tables.map(([name, bytes]) => {
        const placement = { name, bytes, offset };
        offset = align4(offset + bytes.length);
        return placement;
    });
    const output = new Uint8Array(offset);
    const view = new DataView(output.buffer);
    u32(view, 0, 0x00010000);
    u16(view, 4, tables.length);
    u16(view, 6, 64);
    u16(view, 8, 2);
    u16(view, 10, tables.length * 16 - 64);
    placements.forEach((placement, index) => {
        const record = 12 + index * 16;
        tag(output, record, placement.name);
        // HarfBuzz accepts zero checksums for this isolated fixture.
        u32(view, record + 4, 0);
        u32(view, record + 8, placement.offset);
        u32(view, record + 12, placement.bytes.length);
        output.set(placement.bytes, placement.offset);
    });
    return output;
}

function libraryFor(data) {
    const state = { loads: 0 };
    return {
        state,
        async ensureLoaded(id) {
            state.loads += 1;
            return { id, data: new Uint8Array(data) };
        }
    };
}

function params(overrides = {}) {
    return {
        text: 'Aあ',
        fontKind: 'imported',
        fontId: FONT_ID,
        fontFamily: 'sans-serif',
        fontSize: 64,
        endFontSize: null,
        bold: false,
        vertical: false,
        tracking: 0,
        lineHeight: 1.25,
        color: '#800000',
        strokeColor: '#ffffee',
        strokeWidth: 0,
        placement: { x: 240, y: 180, rotation: 0, scaleX: 1, scaleY: 1 },
        baseline: { kind: 'none', path: { closed: false, nodes: [] } },
        envelope: { kind: 'none', amount: 0, points: null },
        ...overrides
    };
}

function alphaCount(pixels) {
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) count += pixels[index] > 0 ? 1 : 0;
    return count;
}

function pathSubpaths(path) {
    const subpaths = [];
    let active = null;
    for (const command of parseSvgPath(path)) {
        const type = command.type.toUpperCase();
        if (type === 'M') {
            if (active) subpaths.push(active);
            active = [];
            if (command.values.length >= 2) active.push({ x: command.values[0], y: command.values[1] });
        } else if (active && (type === 'L' || type === 'Q' || type === 'C')) {
            for (let index = 0; index + 1 < command.values.length; index += 2) active.push({ x: command.values[index], y: command.values[index + 1] });
        }
    }
    if (active) subpaths.push(active);
    return subpaths.filter(points => points.length >= 3);
}

function subpathBounds(points) {
    return points.reduce((bounds, point) => ({
        minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y), maxY: Math.max(bounds.maxY, point.y)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function pixelAt(result, point) {
    const x = Math.floor(point.x - result.rasterBounds.x);
    const y = Math.floor(point.y - result.rasterBounds.y);
    if (x < 0 || y < 0 || x >= result.width || y >= result.height) return 0;
    return result.pixels[(y * result.width + x) * 4 + 3];
}

const bytes = syntheticFontBytes();
assert.ok(bytes.byteLength < 512, 'synthetic fixture stays tiny');
const libraryA = libraryFor(bytes);
const libraryB = libraryFor(bytes);

const shapedA = await shapeLettering(params({ text: 'Aあ' }), { fontLibrary: libraryA });
assert.equal(shapedA.ok, true, shapedA.reason);
assert.equal(shapedA.glyphs.length, 2, 'BMP A and Japanese あ both shape');
assert.ok(shapedA.glyphs.every(glyph => glyph.path.includes('M') && glyph.path.includes('Z')), 'glyph paths contain contours');
const shapedB = await shapeLettering(params({ text: 'Aあ' }), { fontLibrary: libraryB });
assert.equal(shapedB.ok, true, shapedB.reason);
assert.equal(libraryA.state.loads, 1);
assert.equal(libraryB.state.loads, 1);
assert.notStrictEqual(shapedA.glyphs, shapedB.glyphs, 'shape cache is isolated per font library');
const cachedA = await shapeLettering(params({ text: 'Aあ' }), { fontLibrary: libraryA });
assert.equal(cachedA.ok, true, cachedA.reason);
assert.equal(cachedA.glyphs[0].path, shapedA.glyphs[0].path, 'cached shape is cloned');

// Exponent notation remains a number, not an SVG command letter.
const exponent = parseSvgPath('M1e2,2e1L3E1,4e0Z');
assert.deepEqual(exponent, [{ type: 'M', values: [100, 20] }, { type: 'L', values: [30, 4] }, { type: 'Z', values: [] }]);

const rendered = await renderLettering(params({ text: 'A' }), { fontLibrary: libraryA });
assert.equal(rendered.ok, true, rendered.reason);
assert.ok(rendered.pixels instanceof Uint8ClampedArray && alphaCount(rendered.pixels) > 0, 'CPU renderer emits nonempty pixels');
const contours = pathSubpaths(rendered.paths[0].d);
assert.equal(contours.length, 2, 'rendered outline keeps outer and hole contours');
const inner = contours.slice().sort((left, right) => {
    const a = subpathBounds(left); const b = subpathBounds(right);
    return ((a.maxX - a.minX) * (a.maxY - a.minY)) - ((b.maxX - b.minX) * (b.maxY - b.minY));
})[0];
const innerBox = subpathBounds(inner);
const renderPlacement = params().placement;
const holeCenter = {
    x: (innerBox.minX + innerBox.maxX) / 2 + renderPlacement.x,
    y: (innerBox.minY + innerBox.maxY) / 2 + renderPlacement.y
};
assert.equal(pixelAt(rendered, holeCenter), 0, 'opposite winding stays transparent at hole center');

const translatedBaseline = {
    kind: 'straight',
    path: {
        closed: false,
        nodes: [
            { id: 'a', x: -200, y: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false },
            { id: 'b', x: 200, y: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false }
        ]
    }
};
const movedBaseline = { ...translatedBaseline, path: { ...translatedBaseline.path, nodes: translatedBaseline.path.nodes.map(node => ({ ...node, x: node.x + 33, y: node.y + 27 })) } };
const baselineBase = await renderLettering(params({ text: 'A', baseline: translatedBaseline }), { fontLibrary: libraryA, previewOnly: true });
const baselineMoved = await renderLettering(params({ text: 'A', baseline: movedBaseline }), { fontLibrary: libraryA, previewOnly: true });
assert.equal(baselineBase.ok, true, baselineBase.reason);
assert.equal(baselineMoved.ok, true, baselineMoved.reason);
assert.equal(Math.round(baselineMoved.localBounds.x - baselineBase.localBounds.x), 33, 'curve translation moves local x bounds');
assert.equal(Math.round(baselineMoved.localBounds.y - baselineBase.localBounds.y), 27, 'curve translation moves local y bounds');

const identityPoints = Array.from({ length: 9 }, (_, index) => ({ x: (index % 3) / 2, y: Math.floor(index / 3) / 2 }));
const identity = await renderLettering(params({ text: 'A', envelope: { kind: 'none', amount: 0, points: null } }), { fontLibrary: libraryA });
const identityNine = await renderLettering(params({ text: 'A', envelope: { kind: 'points', amount: 0, points: identityPoints } }), { fontLibrary: libraryA });
assert.equal(identity.ok, true, identity.reason);
assert.equal(identityNine.ok, true, identityNine.reason);
assert.deepEqual(identityNine.pixels, identity.pixels, 'identity nine-point envelope preserves pixels');

const preview = await renderLettering(params({ text: 'A' }), { fontLibrary: libraryA, previewOnly: true });
assert.equal(preview.ok, true, preview.reason);
assert.equal(preview.pixels, undefined, 'previewOnly does not allocate pixels');
assert.match(preview.svg, /^<svg[\s\S]*<path[\s\S]*<\/svg>$/);
assert.ok(preview.localBounds.width > 0 && preview.rasterBounds.width > 0, 'preview returns finite bounds');

const oversized = await renderLettering(params({ text: 'A', placement: { x: 0, y: 0, rotation: 0, scaleX: 1000, scaleY: 1000 } }), { fontLibrary: libraryA });
assert.equal(oversized.ok, false);
assert.match(oversized.reason, /^render-too-large:/, 'oversized transformed output rejects before raster allocation');

const woffLibrary = libraryFor(new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0, 0, 0, 0]));
const woff = await shapeLettering(params(), { fontLibrary: woffLibrary });
assert.equal(woff.ok, false);
assert.match(woff.reason, /^font-format-unsupported:/);

const systemWarp = await renderLettering(params({
    fontKind: 'system',
    fontId: '',
    envelope: { kind: 'arc', amount: 0.2, points: null }
}), { fontLibrary: libraryA });
assert.equal(systemWarp.ok, false);
assert.match(systemWarp.reason, /^system-font-vector-unsupported:/);

// WP-028: only the alternate font run changes natural advance.
const wideBytes = bytes.slice();
const wideView = new DataView(wideBytes.buffer);
for (let i = 0; i < wideView.getUint16(4, false); i++) {
    const offset = 12 + i * 16;
    if (String.fromCharCode(...wideBytes.slice(offset,offset+4)) === 'hmtx') u16(wideView,wideView.getUint32(offset+8,false)+4,1000);
}
const mixedLibrary = { async ensureLoaded(id) { if(id==='missing') throw new Error('not-installed'); return {id,data:id==='wide'?wideBytes:bytes}; } };
for (const extra of [{}, {characterStyles:[{start:2,end:3,fontId:'wide'}]}, {sizeProfile:{mode:'ends',start:1,mid:1.5,end:2}}]) {
    const columns = await shapeLettering(params({text:'A\nA\nA',vertical:true,...extra}),{fontLibrary:mixedLibrary});
    assert.equal(columns.ok,true,columns.reason);
    assert.ok(columns.glyphs[0].x > columns.glyphs[1].x && columns.glyphs[1].x > columns.glyphs[2].x,'Japanese vertical paragraphs progress right to left');
    assert.ok(columns.glyphs[0].lineX > columns.glyphs[1].lineX && columns.glyphs[1].lineX > columns.glyphs[2].lineX,'each vertical column retains its own baseline for transforms');
}
const plainThree = await shapeLettering(params({text:'AAA',characterStyles:[{start:1,end:2,color:'#00ff00'}]}),{fontLibrary:mixedLibrary});
const mixedThree = await shapeLettering(params({text:'AAA',characterStyles:[{start:1,end:2,fontId:'wide',color:'#00ff00'}]}),{fontLibrary:mixedLibrary});
assert.equal(mixedThree.ok,true,mixedThree.reason);
assert.ok(mixedThree.width > plainThree.width,'alternate font advance participates in layout');
assert.deepEqual(mixedThree.glyphs.map(g=>[g.start,g.end]),[[0,1],[1,2],[2,3]]);
const shapedProfile = await shapeLettering(params({text:'AAA',sizeProfile:{mode:'three',start:1,mid:2,end:1}}),{fontLibrary:mixedLibrary});
assert.equal(shapedProfile.ok,true,shapedProfile.reason);
assert.ok(shapedProfile.glyphs[1].advance > shapedProfile.glyphs[0].advance*1.8,'middle profile scales advance');
const multiProfile = await shapeLettering(params({text:'AA\nA',sizeProfile:{mode:'ends',start:1,mid:1.5,end:2}}),{fontLibrary:mixedLibrary});
assert.equal(multiProfile.glyphs[2].advance,multiProfile.glyphs[0].advance,'profile restarts on each line, singleton uses start');
const missingRun = await renderLettering(params({text:'AAA',characterStyles:[{start:1,end:2,fontId:'missing'}]}),{fontLibrary:mixedLibrary});
assert.equal(missingRun.ok,false); assert.match(missingRun.reason,/^font-load-failed:/);
const styledParams = params({text:'AAA',tracking:-32,strokeWidth:4,outerStrokeWidth:3,outerStrokeColor:'#0000ff',color:'#ff0000',characterStyles:[{start:1,end:2,color:'#00ff00',rotation:0.2,offsetY:4,envelope:{kind:'skew',amount:0.2,points:null}}]});
const styled = await renderLettering(styledParams,{fontLibrary:mixedLibrary});
assert.equal(styled.ok,true,styled.reason);
assert.deepEqual(styled.paths.map(path=>path.fill),['#ff0000','#00ff00','#ff0000']);
assert.ok(styled.paths.every(path=>path.bounds&&path.anchor&&Number.isFinite(path.tangent.x)&&path.outerStrokeWidth===10));
assert.ok(Math.abs(styled.paths[1].tangent.x-1)<1e-8&&Math.abs(styled.paths[1].tangent.y)<1e-8,'individual rotation does not rotate baseline offset basis');
const diagonalBaseline = {...translatedBaseline,path:{...translatedBaseline.path,nodes:translatedBaseline.path.nodes.map(node=>({...node,x:node.x/Math.sqrt(2),y:node.x/Math.sqrt(2)}))}};
const rotatedOnLine = await renderLettering(params({text:'AAA',baseline:diagonalBaseline,characterStyles:[{start:1,end:2,rotation:1,scaleX:-2,scaleY:0.5}]}),{fontLibrary:mixedLibrary,previewOnly:true});
assert.equal(rotatedOnLine.ok,true,rotatedOnLine.reason);
assert.ok(Math.abs(rotatedOnLine.paths[1].tangent.x-Math.SQRT1_2)<1e-5&&Math.abs(rotatedOnLine.paths[1].tangent.y-Math.SQRT1_2)<1e-5,'rotated/flipped glyph keeps curve tangent offset basis');
assert.ok(styled.svg.indexOf('stroke="#0000ff"') < styled.svg.indexOf('stroke="#ffffee"'));
assert.ok(styled.svg.lastIndexOf('stroke="#ffffee"') < styled.svg.indexOf('fill="#ff0000"'),'every outline precedes every fill');
const rgbCounts = new Map();
for(let i=0;i<styled.pixels.length;i+=4) if(styled.pixels[i+3]===255) { const key=[...styled.pixels.slice(i,i+3)].join(','); rgbCounts.set(key,(rgbCounts.get(key)||0)+1); }
for(const expected of ['255,0,0','0,255,0','0,0,255','255,255,238']) assert.ok(rgbCounts.get(expected)>0,`CPU fallback includes ${expected}`);
const withoutOuter = await renderLettering({...styledParams,outerStrokeWidth:0},{fontLibrary:mixedLibrary,previewOnly:true});
assert.ok(Math.abs(styled.localBounds.width-withoutOuter.localBounds.width-6)<1e-8);
assert.ok(Math.abs(styled.localBounds.height-withoutOuter.localBounds.height-6)<1e-8);
const verticalStyles = await renderLettering({...styledParams,vertical:true,sizeProfile:{mode:'three',start:1,mid:2,end:1}},{fontLibrary:mixedLibrary,previewOnly:true});
assert.equal(verticalStyles.ok,true,verticalStyles.reason);
assert.ok(verticalStyles.paths.every(path=>Number.isFinite(path.bounds.x)&&Number.isFinite(path.anchor.y)));
assert.ok(Math.abs(verticalStyles.paths[1].offsetBasis.x.y-1)<1e-8&&Math.abs(verticalStyles.paths[1].offsetBasis.y.x-1)<1e-8,'straight vertical offset basis preserves positive canvas directions');
const systemStyled = await renderLettering(params({fontKind:'system',outerStrokeWidth:2}),{fontLibrary:mixedLibrary});
assert.equal(systemStyled.ok,false); assert.match(systemStyled.reason,/system-font-vector-unsupported/);
const legacyDefaultAttrs = await renderLettering(params({text:'Aあ',strokeWidth:3,endFontSize:20,outerStrokeWidth:0,outerStrokeColor:'#000000',sizeProfile:null,characterStyles:[]}),{fontLibrary:mixedLibrary});
const legacyMissingAttrs = await renderLettering(params({text:'Aあ',strokeWidth:3,endFontSize:20}),{fontLibrary:mixedLibrary});
assert.equal(legacyDefaultAttrs.svg,legacyMissingAttrs.svg,'default additive properties preserve legacy SVG');
assert.deepEqual(legacyDefaultAttrs.pixels,legacyMissingAttrs.pixels,'default additive properties preserve legacy CPU pixels');
console.log('verify-editable-lettering-render: synthetic SFNT, legacy pixels/holes/cache, mixed font advances, per-line profile, styled paths, whole-text double outline and CPU colors, bounds, vertical styles, failures OK');

// Per-character strokes share the same paths/pass order on SVG and CPU.
const offParams = params({text:'A',strokeWidth:8,outerStrokeWidth:5,characterStyles:[{start:0,end:1,strokeWidth:0,outerStrokeWidth:0}]});
const allOff = await renderLettering(offParams,{fontLibrary:mixedLibrary});
const plainStroke = await renderLettering(params({text:'A',strokeWidth:0,outerStrokeWidth:0,characterStyles:[{start:0,end:1,color:'#800000'}]}),{fontLibrary:mixedLibrary});
assert.equal(allOff.ok,true,allOff.reason);
assert.deepEqual(allOff.pixels,plainStroke.pixels,'explicit OFF removes both outlines in CPU pixels');
assert.deepEqual(allOff.localBounds,plainStroke.localBounds,'OFF removes inherited outline padding');
assert.ok(!allOff.svg.includes('stroke-width='),'explicit OFF removes both SVG strokes');
const strokeMixParams = params({text:'AAA',tracking:16,strokeWidth:4,outerStrokeWidth:3,outerStrokeColor:'#0000ff',characterStyles:[
    {start:1,end:2,strokeWidth:0,outerStrokeWidth:0},
    {start:2,end:3,fontId:'wide',strokeWidth:10,strokeColor:'#00ff00',outerStrokeWidth:5,outerStrokeColor:'#ffff00'}
]});
const strokeMix = await renderLettering(strokeMixParams,{fontLibrary:mixedLibrary});
assert.equal(strokeMix.ok,true,strokeMix.reason);
assert.deepEqual(strokeMix.paths.map(path=>path.strokeWidth||0),[4,0,10]);
assert.deepEqual(strokeMix.paths.map(path=>path.outerStrokeWidth||0),[10,0,20]);
assert.equal(strokeMix.paths[2].stroke,'#00ff00');assert.equal(strokeMix.paths[2].outerStroke,'#ffff00');
const widthsCleared = {...strokeMixParams,strokeWidth:0,outerStrokeWidth:0,characterStyles:strokeMixParams.characterStyles.map(style=>({...style,strokeWidth:0,outerStrokeWidth:0}))};
const noStrokeMix = await renderLettering(widthsCleared,{fontLibrary:mixedLibrary,previewOnly:true});
assert.ok(Math.abs(strokeMix.localBounds.width-noStrokeMix.localBounds.width-20)<1e-8,'largest individual outline fits bounds');
assert.ok(strokeMix.svg.lastIndexOf('stroke=') < strokeMix.svg.indexOf('fill="#800000"'),'all individual strokes precede all fills');
assert.ok(strokeMix.svg.indexOf('stroke="#ffff00"') < strokeMix.svg.indexOf('stroke="#ffffee"'),'all outer strokes precede inner strokes');
const mixedColors = new Set();for(let i=0;i<strokeMix.pixels.length;i+=4)if(strokeMix.pixels[i+3]===255)mixedColors.add([...strokeMix.pixels.slice(i,i+3)].join(','));
for(const rgb of ['128,0,0','255,255,238','0,0,255','0,255,0','255,255,0'])assert.ok(mixedColors.has(rgb),`individual CPU pass includes ${rgb}`);
const warmStroke = await renderLettering({...strokeMixParams,characterStyles:strokeMixParams.characterStyles.map(style=>style.start===2?{...style,strokeColor:'#ff00ff',strokeWidth:12}:style)},{fontLibrary:mixedLibrary,previewOnly:true});
assert.equal(warmStroke.paths[2].stroke,'#ff00ff');assert.equal(warmStroke.paths[2].strokeWidth,12,'warm shape receives current outline attributes');
console.log('per-character outlines: inherited/OFF/custom widths and colors, CPU pixels, pass order, max bounds, warm cache OK');

