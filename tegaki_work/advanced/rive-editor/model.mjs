/**
 * ROLE: legacy PNG/sourceとWP-039 chain sourceを接続するauthoring model/PNG境界/snapshot。
 * AUTHORITY: source と image が編集正本。`.riv` は公式 CLI の派生物で、製品 schema は所有しない。
 * INVARIANTS: RGBA PNG の境界、rest 30°/end -90..90°、既存quad source bytes、grid3の8 outline+1 centerを維持する。
 * RELATED: server.mjs、chain-model.mjs、weight-model.mjs、mesh-profile.mjs、pivot-model.mjs、WP-039 card。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { assertPivot } from './pivot-model.mjs';
import { createChainSource, parseChainSource } from './chain-model.mjs';
import {
    DEFAULT_END_WEIGHTS,
    assertEndWeights,
    cloneEndWeights,
    decodeWeightRecords,
    encodeWeightRecords,
} from './weight-model.mjs';
import {
    MESH_PROFILES,
    assertMeshProfile,
    assertMeshWeights,
    assertProfileTriangles,
    assertProfileVertices,
    assertTriangleIndices,
    createProfileVertices,
    decodeProfileWeightRecords,
    encodeProfileWeightRecords,
    getMeshProfileDefinition,
    gridWeightsFromQuad,
    triangleIndexBytesForProfile,
} from './mesh-profile.mjs';

export const SNAPSHOT_SCHEMA = 'tegaki.rive-editor.state.v1';
export const MODEL_SCHEMA = 'tegaki.rive-editor.model.v1';
export const LIMITS = Object.freeze({
    maxPngDimension: 1024,
    maxPngPixels: 1024 * 1024,
    maxPngBytes: 8 * 1024 * 1024,
    maxControlBytes: 64 * 1024,
    restAngle: 30,
    minAngle: -90,
    maxAngle: 90,
});

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function asBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (value instanceof ArrayBuffer) return Buffer.from(value);
    return Buffer.from(value || []);
}

function formatNumber(value) {
    return Number(value.toFixed(6)).toString();
}

function radians(degrees) {
    return degrees * Math.PI / 180;
}

function degrees(radiansValue) {
    return Math.round((radiansValue * 180 / Math.PI) * 1000) / 1000;
}

export function sha256Bytes(value) {
    return crypto.createHash('sha256').update(asBuffer(value)).digest('hex');
}

export function sha256Text(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function assertAngle(value) {
    const angle = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(angle) || angle < LIMITS.minAngle || angle > LIMITS.maxAngle) {
        throw new Error(`Angle must be a finite number between ${LIMITS.minAngle} and ${LIMITS.maxAngle} degrees.`);
    }
    return Number(angle.toFixed(3));
}

export function assertProgress(value) {
    const progress = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
        throw new Error('Progress must be a finite number between 0 and 1.');
    }
    return Number(progress.toFixed(4));
}

export function sanitizeImageName(value, fallback = 'image.png') {
    const base = path.basename(String(value || fallback)).replace(/[^a-z0-9._-]/gi, '_');
    if (!base.toLowerCase().endsWith('.png')) return `${base || 'image'}.png`;
    return base || fallback;
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const payload = Buffer.concat([typeBytes, data]);
    const output = Buffer.alloc(12 + data.length);
    output.writeUInt32BE(data.length, 0);
    payload.copy(output, 4);
    output.writeUInt32BE(crc32(payload), 8 + data.length);
    return output;
}

export function encodePng(width, height, rgbaPixels) {
    const pixels = asBuffer(rgbaPixels);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || pixels.length !== width * height * 4) {
        throw new Error('RGBA PNG encoder received invalid dimensions or pixel length.');
    }
    const scanlines = Buffer.alloc(height * (width * 4 + 1));
    for (let y = 0; y < height; y += 1) {
        const rowStart = y * (width * 4 + 1);
        scanlines[rowStart] = 0;
        pixels.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    return Buffer.concat([
        PNG_SIGNATURE,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 6 })),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

function pointInPolygon(x, y, points) {
    let inside = false;
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
        const currentPoint = points[index];
        const previousPoint = points[previous];
        const intersects = ((currentPoint.y > y) !== (previousPoint.y > y))
            && (x < (previousPoint.x - currentPoint.x) * (y - currentPoint.y) / (previousPoint.y - currentPoint.y) + currentPoint.x);
        if (intersects) inside = !inside;
    }
    return inside;
}

function fillPolygon(pixels, width, height, points, color) {
    const minX = Math.max(0, Math.floor(Math.min(...points.map(point => point.x))));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map(point => point.x))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map(point => point.y))));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map(point => point.y))));
    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            if (!pointInPolygon(x + 0.5, y + 0.5, points)) continue;
            const offset = (y * width + x) * 4;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = color[3];
        }
    }
}

function fillCircle(pixels, width, height, centerX, centerY, radius, color) {
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
    const radiusSquared = radius * radius;
    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const dx = x + 0.5 - centerX;
            const dy = y + 0.5 - centerY;
            if (dx * dx + dy * dy > radiusSquared) continue;
            const offset = (y * width + x) * 4;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
            pixels[offset + 3] = color[3];
        }
    }
}

export function createFixturePng(width = 320, height = 200) {
    const pixels = Buffer.alloc(width * height * 4);
    const maroon = [112, 34, 67, 255];
    const orange = [224, 87, 30, 255];
    const cream = [248, 220, 170, 255];
    const yellow = [255, 190, 55, 255];
    fillPolygon(pixels, width, height, [
        { x: 28, y: 38 }, { x: 268, y: 52 }, { x: 238, y: 168 }, { x: 40, y: 148 },
    ], maroon);
    fillPolygon(pixels, width, height, [
        { x: 66, y: 62 }, { x: 234, y: 74 }, { x: 214, y: 143 }, { x: 77, y: 130 },
    ], orange);
    fillPolygon(pixels, width, height, [
        { x: 72, y: 46 }, { x: 108, y: 52 }, { x: 83, y: 137 }, { x: 56, y: 130 },
    ], cream);
    fillPolygon(pixels, width, height, [
        { x: 112, y: 80 }, { x: 218, y: 87 }, { x: 202, y: 128 }, { x: 100, y: 120 },
    ], [35, 25, 42, 255]);
    fillCircle(pixels, width, height, 240, 142, 25, yellow);
    return encodePng(width, height, pixels);
}

export function validatePngBytes(input, options = {}) {
    const bytes = asBuffer(input);
    const maxBytes = options.maxBytes ?? LIMITS.maxPngBytes;
    if (bytes.length < 64 || bytes.length > maxBytes || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
        return { ok: false, reason: 'png-header-or-size', bytes: bytes.length };
    }
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = null;
    let colorType = null;
    let idat = [];
    let hasIend = false;
    try {
        while (offset + 12 <= bytes.length) {
            const length = bytes.readUInt32BE(offset);
            const type = bytes.toString('ascii', offset + 4, offset + 8);
            const dataStart = offset + 8;
            const dataEnd = dataStart + length;
            if (dataEnd + 4 > bytes.length) return { ok: false, reason: 'png-truncated', bytes: bytes.length };
            const data = bytes.subarray(dataStart, dataEnd);
            if (type === 'IHDR') {
                if (length !== 13 || offset !== 8) return { ok: false, reason: 'png-ihdr', bytes: bytes.length };
                width = data.readUInt32BE(0);
                height = data.readUInt32BE(4);
                bitDepth = data[8];
                colorType = data[9];
            } else if (type === 'IDAT') {
                idat.push(data);
            } else if (type === 'IEND') {
                hasIend = true;
                break;
            }
            offset = dataEnd + 4;
        }
        if (!hasIend || !width || !height || bitDepth !== 8 || colorType !== 6) {
            return { ok: false, reason: 'png-format', bytes: bytes.length };
        }
        if (width > LIMITS.maxPngDimension || height > LIMITS.maxPngDimension || width * height > LIMITS.maxPngPixels) {
            return { ok: false, reason: 'png-dimensions', bytes: bytes.length, width, height };
        }
        const expected = height * (1 + width * 4);
        const decoded = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
        if (decoded.length !== expected) return { ok: false, reason: 'png-pixel-stream', bytes: bytes.length, width, height };
        return { ok: true, bytes: bytes.length, width, height, bitDepth, colorType, pixels: width * height };
    } catch (error) {
        return { ok: false, reason: 'png-decode', message: error.message, bytes: bytes.length };
    }
}

export function createRiveYaml(width, height) {
    return `name: tegaki_rive_editor\nmain: RiveEditorProof\nartboard:\n  width: ${width}\n  height: ${height}\n  background: "#00000000"\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n`;
}

function createQuadSource({ width, height, angle = LIMITS.restAngle, meshWeights = DEFAULT_END_WEIGHTS, pivot }) {
    const safeAngle = assertAngle(angle);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Image dimensions are required.');
    const safeWeights = assertEndWeights(meshWeights);
    const weightRecords = encodeWeightRecords(safeWeights);
    const weightTag = name => {
        const record = weightRecords.find(entry => entry.name === name);
        return `<Weight values="${record.values}" indices="${record.indices}"/>`;
    };
    const safePivot = assertPivot(pivot, width, height);
    const rootX = safePivot.x - width / 2;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    const boneLength = width * 0.5;
    const rest = formatNumber(radians(LIMITS.restAngle));
    const end = formatNumber(radians(safeAngle));
    return `<Rive version="1" kind="fragment">
    <Artboard width="${width}" height="${height}" styleId="0:5" name="RiveEditorProof" id="0:2">
        <RootBone x="${formatNumber(rootX)}" y="${formatNumber(safePivot.y)}" length="${formatNumber(boneLength)}" rotation="0" name="Root" id="0:40">
            <Bone length="${formatNumber(boneLength)}" rotation="${rest}" name="End" id="0:41"/>
        </RootBone>

        <Image x="${formatNumber(centerX)}" y="${formatNumber(centerY)}" originX="0.5" originY="0.5" assetId="0:60" name="RiggedMark" id="0:20">
            <Mesh triangleIndexBytes="AAECAAID" name="QuadMesh" id="0:21">
                <ContourMeshVertex x="-${formatNumber(halfWidth)}" y="-${formatNumber(halfHeight)}" u="0" v="0" name="TopLeft">
                    ${weightTag('TopLeft')}
                </ContourMeshVertex>
                <ContourMeshVertex x="${formatNumber(halfWidth)}" y="-${formatNumber(halfHeight)}" u="1" v="0" name="TopRight">
                    ${weightTag('TopRight')}
                </ContourMeshVertex>
                <ContourMeshVertex x="${formatNumber(halfWidth)}" y="${formatNumber(halfHeight)}" u="1" v="1" name="BottomRight">
                    ${weightTag('BottomRight')}
                </ContourMeshVertex>
                <ContourMeshVertex x="-${formatNumber(halfWidth)}" y="${formatNumber(halfHeight)}" u="0" v="1" name="BottomLeft">
                    ${weightTag('BottomLeft')}
                </ContourMeshVertex>
                <Skin tx="0" ty="0" name="Skin">
                    <Tendon boneId="0:40" tx="${formatNumber(safePivot.x - width)}" ty="${formatNumber(safePivot.y - halfHeight)}" name="RootTendon"/>
                    <Tendon boneId="0:41" xx="0.8660254" xy="0.5" yx="-0.5" yy="0.8660254" tx="${formatNumber(safePivot.x - halfWidth)}" ty="${formatNumber(safePivot.y - halfHeight)}" name="EndTendon"/>
                </Skin>
            </Mesh>
        </Image>

        <LinearAnimation fps="60" duration="60" loopValue="oneShot" name="EndPose" id="0:6">
            <KeyedObject objectId="0:41">
                <KeyedProperty propertyKey="15">
                    <KeyFrameDouble value="${rest}" interpolationType="linear" frame="0"/>
                    <KeyFrameDouble value="${end}" interpolationType="linear" frame="60"/>
                </KeyedProperty>
            </KeyedObject>
        </LinearAnimation>
        <LayoutComponentStyle name="Artboard Style" id="0:5"/>
    </Artboard>

    <ImageAsset file="fixture.png" name="Rigged mark" id="0:60"/>
</Rive>
`;
}

function createGridSource({ width, height, angle = LIMITS.restAngle, meshWeights, pivot }) {
    const safeAngle = assertAngle(angle);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Image dimensions are required.');
    const safeWeights = assertMeshWeights(MESH_PROFILES.grid3, meshWeights);
    const weightRecords = new Map(encodeProfileWeightRecords(MESH_PROFILES.grid3, safeWeights).map(record => [record.name, record]));
    const weightTag = name => {
        const record = weightRecords.get(name);
        return `<Weight values="${record.values}" indices="${record.indices}"/>`;
    };
    const safePivot = assertPivot(pivot, width, height);
    const rootX = safePivot.x - width / 2;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    const boneLength = width * 0.5;
    const rest = formatNumber(radians(LIMITS.restAngle));
    const end = formatNumber(radians(safeAngle));
    const vertices = createProfileVertices(MESH_PROFILES.grid3, width, height, safeWeights);
    const vertexTags = vertices.map(vertex => `                <${vertex.kind} x="${formatNumber(vertex.x)}" y="${formatNumber(vertex.y)}" u="${formatNumber(vertex.u)}" v="${formatNumber(vertex.v)}" name="${vertex.name}">
                    ${weightTag(vertex.name)}
                </${vertex.kind}>`).join('\n');
    return `<Rive version="1" kind="fragment">
    <Artboard width="${width}" height="${height}" styleId="0:5" name="RiveEditorProof" id="0:2">
        <RootBone x="${formatNumber(rootX)}" y="${formatNumber(safePivot.y)}" length="${formatNumber(boneLength)}" rotation="0" name="Root" id="0:40">
            <Bone length="${formatNumber(boneLength)}" rotation="${rest}" name="End" id="0:41"/>
        </RootBone>

        <Image x="${formatNumber(centerX)}" y="${formatNumber(centerY)}" originX="0.5" originY="0.5" assetId="0:60" name="RiggedMark" id="0:20">
            <Mesh triangleIndexBytes="${triangleIndexBytesForProfile(MESH_PROFILES.grid3)}" name="GridMesh3" id="0:21">
${vertexTags}
                <Skin tx="0" ty="0" name="Skin">
                    <Tendon boneId="0:40" tx="${formatNumber(safePivot.x - width)}" ty="${formatNumber(safePivot.y - halfHeight)}" name="RootTendon"/>
                    <Tendon boneId="0:41" xx="0.8660254" xy="0.5" yx="-0.5" yy="0.8660254" tx="${formatNumber(safePivot.x - halfWidth)}" ty="${formatNumber(safePivot.y - halfHeight)}" name="EndTendon"/>
                </Skin>
            </Mesh>
        </Image>

        <LinearAnimation fps="60" duration="60" loopValue="oneShot" name="EndPose" id="0:6">
            <KeyedObject objectId="0:41">
                <KeyedProperty propertyKey="15">
                    <KeyFrameDouble value="${rest}" interpolationType="linear" frame="0"/>
                    <KeyFrameDouble value="${end}" interpolationType="linear" frame="60"/>
                </KeyedProperty>
            </KeyedObject>
        </LinearAnimation>
        <LayoutComponentStyle name="Artboard Style" id="0:5"/>
    </Artboard>

    <ImageAsset file="fixture.png" name="Rigged mark" id="0:60"/>
</Rive>
`;
}

export function createSource(options = {}) {
    if (Object.hasOwn(options, 'chain')) return createChainSource(options);
    const requestedProfile = Object.hasOwn(options, 'profile')
        ? options.profile
        : Object.hasOwn(options, 'meshProfile') ? options.meshProfile : undefined;
    const profile = assertMeshProfile(requestedProfile);
    if (profile === MESH_PROFILES.quad) return createQuadSource(options);
    const meshWeights = options.meshWeights === undefined
        ? gridWeightsFromQuad(DEFAULT_END_WEIGHTS)
        : options.meshWeights;
    return createGridSource({ ...options, meshWeights });
}

function singleTagAttributes(text, name) {
    const tags = [...text.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))];
    if (tags.length !== 1) return null;
    const remainder = tags[0][1].replace(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g, '').trim();
    if (remainder !== '' && remainder !== '/') return null;
    const attributes = {};
    for (const match of tags[0][1].matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g)) {
        if (Object.hasOwn(attributes, match[1])) return null;
        attributes[match[1]] = match[2];
    }
    return attributes;
}

function numericAttribute(attributes, name, fallback) {
    const value = attributes?.[name];
    if (value === undefined) return fallback;
    if (!/^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(value)) return Number.NaN;
    return Number(value);
}

function onlyAttributes(attributes, names) {
    return attributes && Object.keys(attributes).every(name => names.includes(name));
}

export function parseSourceMetadata(source) {
    const text = String(source || '');
    if (text.includes('name="ChainGrid"')) return parseChainSource(text);
    const artboard = text.match(/<Artboard width="([0-9.]+)" height="([0-9.]+)"[^>]*name="RiveEditorProof"/);
    const frames = [...text.matchAll(/<KeyFrameDouble value="([^\"]+)" interpolationType="linear" frame="(0|60)"\/>/g)];
    const endFrame = frames.find(frame => frame[2] === '60');
    const startFrame = frames.find(frame => frame[2] === '0');
    const image = text.match(/<Image\s+x="(-?[0-9.]+)"\s+y="(-?[0-9.]+)"/);
    const root = text.match(/<RootBone\s+x="(-?[0-9.]+)"\s+y="(-?[0-9.]+)"\s+length="(-?[0-9.]+)"/);
    const rootAttributes = singleTagAttributes(text, 'RootBone');
    const endAttributes = singleTagAttributes(text, 'Bone');
    const rootBlock = text.match(/<RootBone\b[^>]*>\s*<Bone\b[^>]*\/>\s*<\/RootBone>/);
    const imageBlock = text.match(/<Image\b[^>]*>\s*<Mesh\b[^>]*>([\s\S]*?)<\/Mesh>\s*<\/Image>/);
    const imageAttributes = singleTagAttributes(text, 'Image');
    const skinAttributes = singleTagAttributes(text, 'Skin');
    const tendonTags = [...text.matchAll(/<Tendon\b[^>]*>/g)];
    const rootTendon = singleTagAttributes(tendonTags.filter(tag => /name="RootTendon"/.test(tag[0])).map(tag => tag[0]).join(''), 'Tendon');
    const endTendon = singleTagAttributes(tendonTags.filter(tag => /name="EndTendon"/.test(tag[0])).map(tag => tag[0]).join(''), 'Tendon');
    const meshMatches = [...text.matchAll(/<Mesh\s+triangleIndexBytes="([^"]+)"\s+name="([^"]+)"\s+id="[^"]+">([\s\S]*?)<\/Mesh>/g)];
    if (!artboard || !startFrame || !endFrame || frames.length !== 2 || !image || !root || meshMatches.length !== 1
        || !rootBlock || !imageBlock || !imageAttributes || !skinAttributes || tendonTags.length !== 2 || !rootTendon || !endTendon
        || !onlyAttributes(rootAttributes, ['x', 'y', 'length', 'rotation', 'name', 'id'])
        || !onlyAttributes(endAttributes, ['length', 'rotation', 'name', 'id'])) return null;
    const meshMatch = meshMatches[0];
    const meshName = meshMatch[2];
    const profile = meshName === 'QuadMesh'
        ? MESH_PROFILES.quad
        : meshName === 'GridMesh3' ? MESH_PROFILES.grid3 : null;
    if (!profile) return null;
    const definition = getMeshProfileDefinition(profile);
    const meshText = meshMatch[3];
    const skinBlock = meshText.match(/<Skin\b[^>]*>\s*(<Tendon\b[^>]*\/>)\s*(<Tendon\b[^>]*\/>)\s*<\/Skin>/);
    if (imageBlock[1] !== meshText || !skinBlock
        || !/name="RootTendon"/.test(skinBlock[1]) || !/name="EndTendon"/.test(skinBlock[2])) return null;
    const vertexTagCount = [...meshText.matchAll(/<(?:ContourMeshVertex|MeshVertex)\b/g)].length;
    const weightTagCount = [...meshText.matchAll(/<Weight\b/g)].length;
    const vertexMatches = [...meshText.matchAll(/<(ContourMeshVertex|MeshVertex)\s+x="(-?[0-9.]+)"\s+y="(-?[0-9.]+)"\s+u="([0-9.]+)"\s+v="([0-9.]+)"\s+name="([A-Za-z][A-Za-z0-9_-]*)">\s*<Weight\s+values="([0-9]+)"\s+indices="([0-9]+)"\/>\s*<\/\1>/g)];
    if (vertexTagCount !== definition.vertexNames.length
        || vertexMatches.length !== definition.vertexNames.length
        || weightTagCount !== definition.vertexNames.length) return null;
    const remainingChildren = vertexMatches.reduce((children, vertex) => children.replace(vertex[0], ''), meshText).trim();
    if (remainingChildren !== skinBlock[0]) return null;
    const width = Number(artboard[1]);
    const height = Number(artboard[2]);
    const restAngle = degrees(Number(startFrame[1]));
    const angle = degrees(Number(endFrame[1]));
    const imageX = Number(image[1]);
    const imageY = Number(image[2]);
    const rootX = Number(root[1]);
    const rootY = Number(root[2]);
    const boneLength = Number(root[3]);
    let pivot;
    try {
        pivot = assertPivot({ x: rootX + width / 2, y: rootY }, width, height);
        assertAngle(angle);
    } catch {
        return null;
    }
    const near = (value, expected) => Number.isFinite(value) && Math.abs(value - expected) <= 1e-6;
    const number = numericAttribute;
    if (!near(rootX, pivot.x - width / 2) || !near(rootY, pivot.y)
        || !near(boneLength, width / 2) || !near(number(rootAttributes, 'rotation', 0), 0)
        || rootAttributes.name !== 'Root' || rootAttributes.id !== '0:40'
        || endAttributes.name !== 'End' || endAttributes.id !== '0:41'
        || !near(number(endAttributes, 'length'), width / 2)
        || !near(number(endAttributes, 'x', 0), 0) || !near(number(endAttributes, 'y', 0), 0)
        || !near(number(endAttributes, 'rotation'), radians(LIMITS.restAngle))
        || !near(Number(startFrame[1]), radians(LIMITS.restAngle))
        || !near(imageX, width / 2) || !near(imageY, height / 2)
        || !near(number(skinAttributes, 'tx', 0), 0) || !near(number(skinAttributes, 'ty', 0), 0)
        || !near(number(skinAttributes, 'xx', 1), 1) || !near(number(skinAttributes, 'xy', 0), 0)
        || !near(number(skinAttributes, 'yx', 0), 0) || !near(number(skinAttributes, 'yy', 1), 1)
        || rootTendon.boneId !== '0:40' || endTendon.boneId !== '0:41'
        || !near(number(rootTendon, 'tx'), pivot.x - width) || !near(number(rootTendon, 'ty'), pivot.y - height / 2)
        || !near(number(rootTendon, 'xx', 1), 1) || !near(number(rootTendon, 'xy', 0), 0)
        || !near(number(rootTendon, 'yx', 0), 0) || !near(number(rootTendon, 'yy', 1), 1)
        || !near(number(endTendon, 'tx'), pivot.x - width / 2) || !near(number(endTendon, 'ty'), pivot.y - height / 2)
        || !near(number(endTendon, 'xx'), 0.8660254) || !near(number(endTendon, 'xy'), 0.5)
        || !near(number(endTendon, 'yx'), -0.5) || !near(number(endTendon, 'yy'), 0.8660254)) return null;
    const meshX = vertexMatches.map(vertex => Number(vertex[2]));
    const meshY = vertexMatches.map(vertex => Number(vertex[3]));
    let meshWeights;
    try {
        const records = vertexMatches.map((vertex, index) => {
            return { name: vertex[6], values: Number(vertex[7]), indices: Number(vertex[8]) };
        });
        const parsedVertices = vertexMatches.map(vertex => ({
            kind: vertex[1],
            x: Number(vertex[2]),
            y: Number(vertex[3]),
            u: Number(vertex[4]),
            v: Number(vertex[5]),
            name: vertex[6],
            endWeight: 0,
        }));
        meshWeights = profile === MESH_PROFILES.quad
            ? decodeWeightRecords(records)
            : decodeProfileWeightRecords(profile, records);
        parsedVertices.forEach((vertex, index) => { vertex.endWeight = meshWeights[index]; });
        assertProfileVertices(profile, parsedVertices, width, height);
        assertTriangleIndices(profile, meshMatch[1]);
        assertProfileTriangles(profile, definition.triangles, definition.uvs);
    } catch {
        return null;
    }
    const meshBounds = {
        minX: Math.min(...meshX),
        maxX: Math.max(...meshX),
        minY: Math.min(...meshY),
        maxY: Math.max(...meshY),
    };
    if (![width, height, restAngle, angle, imageX, imageY, rootX, rootY, boneLength, ...meshX, ...meshY].every(Number.isFinite)) return null;
    return {
        width,
        height,
        rigMode: 'legacy',
        chain: null,
        restAngle,
        angle,
        meshProfile: profile,
        vertexCount: definition.vertexNames.length,
        triangleCount: definition.triangles.length,
        vertices: definition.vertexNames.length,
        triangles: definition.triangles.length,
        imageX,
        imageY,
        rootX,
        rootY,
        boneLength,
        pivot,
        centerAtRotationPivot: profile === MESH_PROFILES.grid3 && pivot.x === width / 2 && pivot.y === height / 2,
        meshBounds,
        meshWeights,
    };
}

export function makeSnapshot(state) {
    const sourceInfo = state.currentSource ? parseSourceMetadata(state.currentSource) : null;
    const meshProfile = sourceInfo?.meshProfile || state.meshProfile || null;
    const sourceWeights = sourceInfo?.rigMode === 'chain' ? null : sourceInfo?.meshWeights
        || (state.meshWeights ? assertMeshWeights(meshProfile || MESH_PROFILES.quad, state.meshWeights) : null);
    return {
        schema: SNAPSHOT_SCHEMA,
        status: state.status,
        documentId: state.documentId,
        buildId: state.buildId,
        sourceHash: state.currentSource ? sha256Text(state.currentSource) : null,
        image: state.image ? {
            name: state.image.name,
            width: state.image.width,
            height: state.image.height,
        } : null,
        angle: sourceInfo?.rigMode === 'chain' ? sourceInfo.angle : state.angle,
        progress: state.progress,
        dirty: state.dirty === true,
        reason: state.reason || null,
        meshProfile,
        rigMode: sourceInfo?.rigMode || 'legacy',
        chain: sourceInfo?.chain || null,
        pivot: sourceInfo?.pivot ? { ...sourceInfo.pivot } : null,
        centerAtRotationPivot: sourceInfo?.centerAtRotationPivot === true,
        vertexCount: sourceInfo?.vertexCount ?? state.vertexCount ?? null,
        triangleCount: sourceInfo?.triangleCount ?? state.triangleCount ?? null,
        meshWeights: sourceWeights ? [...sourceWeights] : null,
        weightEditPhase: state.weightEditPhase || 'idle',
        weightDraft: state.weightDraft ? {
            endWeights: state.weightDraft.endWeights ? cloneEndWeights(state.weightDraft.endWeights) : null,
            percentages: Array.isArray(state.weightDraft.percentages) ? [...state.weightDraft.percentages] : null,
        } : null,
        selectedVertex: state.selectedVertex || null,
    };
}

export function writeInitialFixture(cacheDir) {
    const fixturePath = path.join(cacheDir, 'fixture-320x200.png');
    fs.mkdirSync(cacheDir, { recursive: true });
    if (!fs.existsSync(fixturePath)) fs.writeFileSync(fixturePath, createFixturePng());
    return fixturePath;
}

