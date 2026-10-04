/**
 * ROLE: WP-029 の固定 PNG/source template、制約、snapshot の純粋な authoring model。
 * AUTHORITY: source と image が編集正本。`.riv` は公式 CLI の派生物で、製品 schema は所有しない。
 * INVARIANTS: RGBA PNG の境界、rest 30°/end -90..90°、実寸 4 vertex/2 triangle mesh を維持する。
 * RELATED: advanced/rive-editor/server.mjs、build/verify-rive-editor-model.mjs、WP-029 card。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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

export function createSource({ width, height, angle = LIMITS.restAngle }) {
    const safeAngle = assertAngle(angle);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Image dimensions are required.');
    const rootX = 0;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    const boneLength = width * 0.5;
    const rest = formatNumber(radians(LIMITS.restAngle));
    const end = formatNumber(radians(safeAngle));
    return `<Rive version="1" kind="fragment">
    <Artboard width="${width}" height="${height}" styleId="0:5" name="RiveEditorProof" id="0:2">
        <RootBone x="${formatNumber(rootX)}" y="${formatNumber(centerY)}" length="${formatNumber(boneLength)}" rotation="0" name="Root" id="0:40">
            <Bone length="${formatNumber(boneLength)}" rotation="${rest}" name="End" id="0:41"/>
        </RootBone>

        <Image x="${formatNumber(centerX)}" y="${formatNumber(centerY)}" originX="0.5" originY="0.5" assetId="0:60" name="RiggedMark" id="0:20">
            <Mesh triangleIndexBytes="AAECAAID" name="QuadMesh" id="0:21">
                <ContourMeshVertex x="-${formatNumber(halfWidth)}" y="-${formatNumber(halfHeight)}" u="0" v="0" name="TopLeft">
                    <Weight values="255" indices="1"/>
                </ContourMeshVertex>
                <ContourMeshVertex x="${formatNumber(halfWidth)}" y="-${formatNumber(halfHeight)}" u="1" v="0" name="TopRight">
                    <Weight values="255" indices="2"/>
                </ContourMeshVertex>
                <ContourMeshVertex x="${formatNumber(halfWidth)}" y="${formatNumber(halfHeight)}" u="1" v="1" name="BottomRight">
                    <Weight values="255" indices="2"/>
                </ContourMeshVertex>
                <ContourMeshVertex x="-${formatNumber(halfWidth)}" y="${formatNumber(halfHeight)}" u="0" v="1" name="BottomLeft">
                    <Weight values="255" indices="1"/>
                </ContourMeshVertex>
                <Skin tx="0" ty="0" name="Skin">
                    <Tendon boneId="0:40" tx="-${formatNumber(halfWidth)}" ty="0" name="RootTendon"/>
                    <Tendon boneId="0:41" xx="0.8660254" xy="0.5" yx="-0.5" yy="0.8660254" tx="0" ty="0" name="EndTendon"/>
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

export function parseSourceMetadata(source) {
    const text = String(source || '');
    const artboard = text.match(/<Artboard width="([0-9.]+)" height="([0-9.]+)"[^>]*name="RiveEditorProof"/);
    const frames = [...text.matchAll(/<KeyFrameDouble value="([^\"]+)" interpolationType="linear" frame="(0|60)"\/>/g)];
    const vertexMatches = [...text.matchAll(/<ContourMeshVertex\s+x="(-?[0-9.]+)"\s+y="(-?[0-9.]+)"/g)];
    const vertices = [...text.matchAll(/<ContourMeshVertex\b/g)];
    const endFrame = frames.find(frame => frame[2] === '60');
    const startFrame = frames.find(frame => frame[2] === '0');
    const image = text.match(/<Image\s+x="(-?[0-9.]+)"\s+y="(-?[0-9.]+)"/);
    const root = text.match(/<RootBone\s+x="(-?[0-9.]+)"\s+y="(-?[0-9.]+)"\s+length="(-?[0-9.]+)"/);
    if (!artboard || !startFrame || !endFrame || vertices.length !== 4 || vertexMatches.length !== 4 || !image || !root || !text.includes('triangleIndexBytes="AAECAAID"')) return null;
    const width = Number(artboard[1]);
    const height = Number(artboard[2]);
    const restAngle = degrees(Number(startFrame[1]));
    const angle = degrees(Number(endFrame[1]));
    const imageX = Number(image[1]);
    const imageY = Number(image[2]);
    const rootX = Number(root[1]);
    const rootY = Number(root[2]);
    const boneLength = Number(root[3]);
    const meshX = vertexMatches.map(vertex => Number(vertex[1]));
    const meshY = vertexMatches.map(vertex => Number(vertex[2]));
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
        restAngle,
        angle,
        vertices: vertices.length,
        triangles: 2,
        imageX,
        imageY,
        rootX,
        rootY,
        boneLength,
        meshBounds,
    };
}

export function makeSnapshot(state) {
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
        angle: state.angle,
        progress: state.progress,
        dirty: state.dirty === true,
        reason: state.reason || null,
    };
}

export function writeInitialFixture(cacheDir) {
    const fixturePath = path.join(cacheDir, 'fixture-320x200.png');
    fs.mkdirSync(cacheDir, { recursive: true });
    if (!fs.existsSync(fixturePath)) fs.writeFileSync(fixturePath, createFixturePng());
    return fixturePath;
}

