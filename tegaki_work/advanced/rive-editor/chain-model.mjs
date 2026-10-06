/**
 * ROLE: WP-039 の連鎖骨/45点mesh/終点warpのpure authoring modelとcanonical RML。
 * AUTHORITY: source生成/復元と初期bindのみ。描画/補間は公式Rive、保存正本はRML+PNG。
 * INVARIANTS: 2..8骨、row-major API/outline-first RML、二骨255weight、key15/24/25。
 * RELATED: model.mjs、server.mjs、workbench.js、chain-controller.js、WP-039 card。
 */
import { encodeTriangleIndices } from './mesh-profile.mjs';

export const CHAIN_COLUMNS = 9;
export const CHAIN_ROWS = 5;
export const CHAIN_VERTEX_COUNT = 45;
export const CHAIN_MESH_PROFILE = 'chain-grid';
const fail = message => { throw new Error(`Chain ${message}`); };
const rounded = value => {
    const result = Number(value.toFixed(3));
    return Object.is(result, -0) ? 0 : result;
};
const format = value => Number(value.toFixed(12)).toString();
function dimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) fail('image dimensions must be positive integers.');
}
function number(value, minimum, maximum, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) fail(`${label} must be a finite number in ${minimum}..${maximum}.`);
    const result = rounded(value);
    if (result < minimum || result > maximum) fail(`${label} rounded value is out of range.`);
    return result;
}
function array(value, length, label) {
    if (!Array.isArray(value) || value.length !== length) fail(`${label} must contain ${length} entries.`);
    return Array.from(value);
}
function point(value, xRange, yRange, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an x/y object.`);
    return { x: number(value.x, ...xRange, `${label}.x`), y: number(value.y, ...yRange, `${label}.y`) };
}
function weight(value, count) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('weight must be an a/b/mix object.');
    const { a, b, mix } = value;
    if (![a, b, mix].every(Number.isInteger) || a < 0 || a >= count || b < 0 || b >= count || mix < 0 || mix > 255) fail('weight indices/mix must be bounded integers.');
    if (a === b || mix === 0) return { a, b: a, mix: 0 };
    if (mix === 255) return { a: b, b, mix: 0 };
    return { a, b, mix };
}
export function assertChain(value, width, height) {
    dimensions(width, height);
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.angles)
        || value.angles.length < 2 || value.angles.length > 8) fail('must contain 2..8 angles.');
    const count = value.angles.length;
    const joints = array(value.joints, count + 1, 'joints').map((entry, index) => point(entry, [0, width], [0, height], `joint${index}`));
    for (let index = 0; index < count; index += 1) {
        if (Math.hypot(joints[index + 1].x - joints[index].x, joints[index + 1].y - joints[index].y) < 1) fail('each rest segment must be at least 1 pixel.');
    }
    return {
        joints,
        angles: Array.from(value.angles, (angle, index) => number(angle, -90, 90, `angle${index}`)),
        warp: array(value.warp, CHAIN_VERTEX_COUNT, 'warp').map((entry, index) => point(entry, [-width, width], [-height, height], `warp${index}`)),
        weights: array(value.weights, CHAIN_VERTEX_COUNT, 'weights').map(entry => weight(entry, count)),
    };
}
export function createChainMesh(width, height) {
    dimensions(width, height);
    return Array.from({ length: CHAIN_VERTEX_COUNT }, (_, index) => {
        const u = (index % CHAIN_COLUMNS) / (CHAIN_COLUMNS - 1);
        const v = Math.floor(index / CHAIN_COLUMNS) / (CHAIN_ROWS - 1);
        return { index, x: width * u, y: height * v, u, v };
    });
}
function segmentDistance(pointValue, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const t = Math.max(0, Math.min(1, ((pointValue.x - start.x) * dx + (pointValue.y - start.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(pointValue.x - start.x - t * dx, pointValue.y - start.y - t * dy);
}
export function createChainWeights(joints, width, height) {
    if (!Array.isArray(joints) || joints.length < 3 || joints.length > 9) fail('bind requires 2..8 rest segments.');
    const safeJoints = joints.map((entry, index) => point(entry, [0, width], [0, height], `joint${index}`));
    if (safeJoints.slice(1).some((joint, index) => Math.hypot(joint.x - safeJoints[index].x, joint.y - safeJoints[index].y) < 1)) fail('bind segments must be at least 1 pixel.');
    return createChainMesh(width, height).map(vertex => {
        const nearest = safeJoints.slice(1).map((end, index) => ({ index, distance: segmentDistance(vertex, safeJoints[index], end) }))
            .sort((left, right) => left.distance - right.distance || left.index - right.index);
        if (nearest[0].distance < 1e-9) return { a: nearest[0].index, b: nearest[0].index, mix: 0 };
        return weight({ a: nearest[0].index, b: nearest[1].index, mix: Math.round(255 * nearest[0].distance / (nearest[0].distance + nearest[1].distance)) }, safeJoints.length - 1);
    });
}
export function createDefaultChain(width, height, boneCount = 3) {
    dimensions(width, height);
    if (!Number.isInteger(boneCount) || boneCount < 2 || boneCount > 8) fail('bone count must be 2..8.');
    const joints = Array.from({ length: boneCount + 1 }, (_, index) => ({ x: rounded(width * (0.1 + 0.8 * index / boneCount)), y: rounded(height * 0.5) }));
    return assertChain({ joints, angles: Array(boneCount).fill(0), warp: Array.from({ length: CHAIN_VERTEX_COUNT }, () => ({ x: 0, y: 0 })),
        weights: createChainWeights(joints, width, height) }, width, height);
}
export function createChainPreset(name, width, height) {
    if (name !== 'arm' && name !== 'snake') fail('unknown preset.');
    return createDefaultChain(width, height, name === 'arm' ? 3 : 6);
}
export function resizeChain(value, oldWidth, oldHeight, newWidth, newHeight) {
    const chain = assertChain(value, oldWidth, oldHeight);
    dimensions(newWidth, newHeight);
    const scale = pointValue => ({ x: rounded(pointValue.x / oldWidth * newWidth), y: rounded(pointValue.y / oldHeight * newHeight) });
    return assertChain({ ...chain, joints: chain.joints.map(scale), warp: chain.warp.map(scale) }, newWidth, newHeight);
}
const outline = [0, 1, 2, 3, 4, 5, 6, 7, 8, 17, 26, 35, 44, 43, 42, 41, 40, 39, 38, 37, 36, 27, 18, 9];
export const CHAIN_RML_ORDER = Object.freeze([...outline, ...Array.from({ length: CHAIN_VERTEX_COUNT }, (_, index) => index).filter(index => !outline.includes(index))]);
const triangles = [];
for (let row = 0; row < CHAIN_ROWS - 1; row += 1) for (let column = 0; column < CHAIN_COLUMNS - 1; column += 1) {
    const top = row * CHAIN_COLUMNS + column;
    triangles.push([top, top + 1, top + CHAIN_COLUMNS + 1], [top, top + CHAIN_COLUMNS + 1, top + CHAIN_COLUMNS]);
}
export const CHAIN_TRIANGLES = Object.freeze(triangles.map(triangle => Object.freeze(triangle)));
const triangleBytes = encodeTriangleIndices(CHAIN_TRIANGLES.map(triangle => triangle.map(index => CHAIN_RML_ORDER.indexOf(index))));
function restBones(chain) {
    let previousRotation = 0;
    return chain.angles.map((_, index) => {
        const start = chain.joints[index];
        const end = chain.joints[index + 1];
        const worldRotation = Math.atan2(end.y - start.y, end.x - start.x);
        const relativeRotation = Math.atan2(Math.sin(worldRotation - previousRotation), Math.cos(worldRotation - previousRotation));
        previousRotation = worldRotation;
        return { ...start, length: Math.hypot(end.x - start.x, end.y - start.y), worldRotation, relativeRotation };
    });
}
function packed(entry) {
    if (entry.a === entry.b) return { values: 255, indices: entry.a + 1 };
    return { values: (255 - entry.mix) | (entry.mix << 8), indices: (entry.a + 1) | ((entry.b + 1) << 8) };
}
function track(id, key, start, end) {
    return `            <KeyedObject objectId="${id}"><KeyedProperty propertyKey="${key}"><KeyFrameDouble value="${format(start)}" interpolationType="linear" frame="0"/><KeyFrameDouble value="${format(end)}" interpolationType="linear" frame="60"/></KeyedProperty></KeyedObject>`;
}
export function createChainSource({ width, height, chain: value }) {
    const chain = assertChain(value, width, height);
    const bones = restBones(chain);
    const boneTags = bones.map((bone, index) => {
        const tag = index === 0 ? 'RootBone' : 'Bone';
        const position = index === 0 ? `x="${format(bone.x)}" y="${format(bone.y)}" ` : '';
        return `${'    '.repeat(index + 2)}<${tag} ${position}length="${format(bone.length)}" rotation="${format(bone.relativeRotation)}" name="${index === 0 ? 'Root' : `Joint${index + 1}`}" id="0:${40 + index}"${index === bones.length - 1 ? '/>' : '>'}`;
    });
    for (let index = bones.length - 2; index >= 0; index -= 1) boneTags.push(`${'    '.repeat(index + 2)}</${index === 0 ? 'RootBone' : 'Bone'}>`);
    const vertices = createChainMesh(width, height);
    const vertexTags = CHAIN_RML_ORDER.map(index => {
        const vertex = vertices[index];
        const encoded = packed(chain.weights[index]);
        const tag = outline.includes(index) ? 'ContourMeshVertex' : 'MeshVertex';
        return `                <${tag} x="${format(vertex.x - width / 2)}" y="${format(vertex.y - height / 2)}" u="${format(vertex.u)}" v="${format(vertex.v)}" name="V${index}" id="0:${100 + index}"><Weight values="${encoded.values}" indices="${encoded.indices}"/></${tag}>`;
    });
    const tendons = bones.map((bone, index) => `                    <Tendon boneId="0:${40 + index}" xx="${format(Math.cos(bone.worldRotation))}" xy="${format(Math.sin(bone.worldRotation))}" yx="${format(-Math.sin(bone.worldRotation))}" yy="${format(Math.cos(bone.worldRotation))}" tx="${format(bone.x - width / 2)}" ty="${format(bone.y - height / 2)}" name="Tendon${index + 1}"/>`);
    const tracks = bones.map((bone, index) => track(`0:${40 + index}`, 15, bone.relativeRotation, bone.relativeRotation + chain.angles[index] * Math.PI / 180));
    for (const vertex of vertices) {
        tracks.push(track(`0:${100 + vertex.index}`, 24, vertex.x - width / 2, vertex.x - width / 2 + chain.warp[vertex.index].x));
        tracks.push(track(`0:${100 + vertex.index}`, 25, vertex.y - height / 2, vertex.y - height / 2 + chain.warp[vertex.index].y));
    }
    return `<Rive version="1" kind="fragment">
    <Artboard width="${width}" height="${height}" styleId="0:5" name="RiveEditorProof" id="0:2">
${boneTags.join('\n')}
        <Image x="${format(width / 2)}" y="${format(height / 2)}" originX="0.5" originY="0.5" assetId="0:60" name="RiggedMark" id="0:20">
            <Mesh triangleIndexBytes="${triangleBytes}" name="ChainGrid" id="0:21">
${vertexTags.join('\n')}
                <Skin tx="0" ty="0" name="Skin">
${tendons.join('\n')}
                </Skin>
            </Mesh>
        </Image>
        <LinearAnimation fps="60" duration="60" loopValue="oneShot" name="EndPose" id="0:6">
${tracks.join('\n')}
        </LinearAnimation>
        <LayoutComponentStyle name="Artboard Style" id="0:5"/>
    </Artboard>
    <ImageAsset file="fixture.png" name="Rigged mark" id="0:60"/>
</Rive>
`;
}
function attributes(text) {
    return Object.fromEntries([...text.matchAll(/([A-Za-z][A-Za-z0-9]*)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}
export function parseChainSource(source) {
    if (typeof source !== 'string' || !source.includes('name="ChainGrid"')) return null;
    try {
        const artboard = attributes(source.match(/<Artboard\b([^>]*)>/)?.[1] || '');
        const width = Number(artboard.width);
        const height = Number(artboard.height);
        dimensions(width, height);
        const bones = [...source.matchAll(/<(RootBone|Bone)\b([^>]*)>/g)].map(match => ({ tag: match[1], ...attributes(match[2]) }));
        if (bones.length < 2 || bones.length > 8 || bones[0].tag !== 'RootBone') return null;
        const joints = [{ x: rounded(Number(bones[0].x)), y: rounded(Number(bones[0].y)) }];
        let worldRotation = 0;
        for (const bone of bones) {
            worldRotation += Number(bone.rotation);
            const start = joints[joints.length - 1];
            joints.push({ x: rounded(start.x + Number(bone.length) * Math.cos(worldRotation)), y: rounded(start.y + Number(bone.length) * Math.sin(worldRotation)) });
        }
        const trackValues = new Map();
        for (const match of source.matchAll(/<KeyedObject objectId="([^"]+)"><KeyedProperty propertyKey="([^"]+)"><KeyFrameDouble value="([^"]+)" interpolationType="linear" frame="0"\/><KeyFrameDouble value="([^"]+)" interpolationType="linear" frame="60"\/><\/KeyedProperty><\/KeyedObject>/g)) {
            const key = `${match[1]}:${match[2]}`;
            if (trackValues.has(key)) return null;
            trackValues.set(key, [Number(match[3]), Number(match[4])]);
        }
        const angles = bones.map((bone, index) => {
            const values = trackValues.get(`0:${40 + index}:15`);
            return rounded((values[1] - values[0]) * 180 / Math.PI);
        });
        const vertices = createChainMesh(width, height);
        const warp = vertices.map(vertex => ({ x: rounded(trackValues.get(`0:${100 + vertex.index}:24`)[1] - vertex.x + width / 2),
            y: rounded(trackValues.get(`0:${100 + vertex.index}:25`)[1] - vertex.y + height / 2) }));
        const weights = Array(CHAIN_VERTEX_COUNT);
        for (const match of source.matchAll(/<(?:ContourMeshVertex|MeshVertex)\b([^>]*)><Weight values="([0-9]+)" indices="([0-9]+)"\/><\/(?:ContourMeshVertex|MeshVertex)>/g)) {
            const vertex = attributes(match[1]);
            const index = Number(vertex.name?.slice(1));
            if (!Number.isInteger(index) || index < 0 || index >= CHAIN_VERTEX_COUNT || weights[index]) return null;
            const values = Number(match[2]);
            const indices = Number(match[3]);
            weights[index] = indices < 256 ? { a: indices - 1, b: indices - 1, mix: 0 }
                : { a: (indices & 255) - 1, b: ((indices >>> 8) & 255) - 1, mix: (values >>> 8) & 255 };
        }
        const chain = assertChain({ joints, angles, warp, weights }, width, height);
        if (createChainSource({ width, height, chain }) !== source) return null;
        return { width, height, rigMode: 'chain', chain, angle: chain.angles[0], restAngle: 0, meshProfile: CHAIN_MESH_PROFILE,
            vertexCount: CHAIN_VERTEX_COUNT, triangleCount: CHAIN_TRIANGLES.length, vertices: CHAIN_VERTEX_COUNT, triangles: CHAIN_TRIANGLES.length,
            imageX: width / 2, imageY: height / 2, meshBounds: { minX: -width / 2, maxX: width / 2, minY: -height / 2, maxY: height / 2 } };
    } catch { return null; }
}
