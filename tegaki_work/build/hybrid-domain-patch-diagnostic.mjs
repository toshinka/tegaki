// R-45B diagnostic only. No production generator, schema, or runtime hook.
import { createRasterBoneBindSegments } from '../system/animation/raster-bone-auto-setup.js';
import { RASTER_MESH_MAX_VERTICES, RASTER_MESH_SCHEMA_VERSION } from '../system/animation/raster-bone-skinning.js';

const STEP = 24;
const EPS = 1e-9;
const pointKey = (x, y) => `${x},${y}`;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function alphaComponents(snapshot, threshold = 0) {
    const { width, height, pixels } = snapshot;
    const labels = new Int32Array(width * height).fill(-1);
    const components = [];
    for (let index = 0; index < labels.length; index++) {
        if (labels[index] !== -1 || pixels[index * 4 + 3] <= threshold) continue;
        const label = components.length;
        const queue = [index];
        labels[index] = label;
        let minX = width, minY = height, maxX = 0, maxY = 0;
        for (let head = 0; head < queue.length; head++) {
            const pixel = queue[head];
            const x = pixel % width, y = Math.floor(pixel / width);
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y + 1);
            for (const next of [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
                y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1]) {
                if (next < 0 || labels[next] !== -1 || pixels[next * 4 + 3] <= threshold) continue;
                labels[next] = label;
                queue.push(next);
            }
        }
        components.push({ id: label, pixels: queue.length, bounds: { minX, minY, maxX, maxY } });
    }
    return { labels, components, threshold, connectivity: 4 };
}

function segmentDistance(point, segment) {
    const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 > EPS ? Math.max(0, Math.min(1,
        ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / length2)) : 0;
    return Math.hypot(point.x - segment.start.x - t * dx, point.y - segment.start.y - t * dy);
}

function rootOf(boneId, parentById) {
    const seen = new Set();
    let id = boneId;
    while (parentById.get(id) && !seen.has(id)) {
        seen.add(id); id = parentById.get(id);
    }
    return id;
}

function ancestorOf(a, b, parentById) {
    const ancestors = new Set();
    for (let id = a; id; id = parentById.get(id)) ancestors.add(id);
    for (let id = b; id; id = parentById.get(id)) if (ancestors.has(id)) return id;
    return null;
}

export function createDomainContext(asset, rectangularSetup) {
    const bind = createRasterBoneBindSegments(asset);
    if (!bind.ok || bind.segments.length === 0) return { ok: false, reason: 'invalid-bind-segments' };
    const bones = asset.rigDefinition.bones;
    const parentById = new Map(bones.map(b => [b.boneId, b.parentBoneId]));
    const roots = bones.filter(b => !b.parentBoneId);
    if (roots.length !== 1) return { ok: false, reason: 'multiple-root-unsupported' };
    const boneById = new Map(bones.map(b => [b.boneId, b]));
    const segmentById = new Map(bind.segments.map(s => [s.boneId, s]));
    const gridDiagonal = Math.hypot(rectangularSetup.bindBounds.width / (rectangularSetup.dimensions.columns - 1),
        rectangularSetup.bindBounds.height / (rectangularSetup.dimensions.rows - 1));
    return { ok: true, segments: bind.segments, segmentById, parentById, boneById,
        rootBoneId: roots[0].boneId, gridDiagonal };
}

function ranked(point, context) {
    return context.segments.map(segment => ({ segment, boneId: segment.boneId,
        length: distance(segment.start, segment.end), d: segmentDistance(point, segment) }))
        .sort((a, b) => a.d - b.d || a.boneId.localeCompare(b.boneId));
}

// Fixed R-44 D-gated-joint family, including one fixed tree-root fallback.
export function fixedDomainWeights(point, context) {
    const ordered = ranked(point, context);
    if (!ordered.length) return [];
    const eligible = ordered.filter(item => item.d <= Math.max(item.length * 0.5,
        context.gridDiagonal * 0.75));
    if (!eligible.length) return [{ boneId: rootOf(ordered[0].boneId, context.parentById), weight: 1 }];
    const anchor = eligible[0];
    let companion = null;
    for (const candidate of eligible.slice(1)) {
        const parentChild = context.parentById.get(anchor.boneId) === candidate.boneId
            || context.parentById.get(candidate.boneId) === anchor.boneId;
        if (!parentChild) continue;
        const child = context.parentById.get(anchor.boneId) === candidate.boneId ? anchor : candidate;
        const band = 0.3 * Math.min(anchor.length, candidate.length);
        const ratio = band > 0 ? distance(point, child.segment.start) / band : Infinity;
        if (ratio < 1 && (!companion || ratio < companion.ratio)) companion = { candidate, ratio };
    }
    if (!companion) return [{ boneId: anchor.boneId, weight: 1 }];
    const t = companion.ratio, secondary = 0.5 * (1 - t * t * (3 - 2 * t));
    return [{ boneId: anchor.boneId, weight: 1 - secondary },
        { boneId: companion.candidate.boneId, weight: secondary }];
}

export function withFixedWeights(meshDefinition, context) {
    return { version: RASTER_MESH_SCHEMA_VERSION, meshId: meshDefinition.meshId,
        vertexWeights: meshDefinition.vertices.map(v => ({ vertexId: v.vertexId,
            influences: fixedDomainWeights(v, context) })) };
}

function primaryDomain(point, context, componentId, componentOwners) {
    const ordered = ranked(point, context);
    let owner = ordered[0]?.boneId || null;
    // A shared ancestor patch surrounds a branch point. The radius is tied to
    // existing grid spacing and short child length, never a fixed pixel number.
    for (const parent of context.boneById.values()) {
        const children = [...context.parentById].filter(([, id]) => id === parent.boneId)
            .map(([id]) => id);
        if (children.length < 2) continue;
        // An isolated child island is not a branch junction merely because
        // its pixels happen to lie near the ancestor Bone origin.
        if (children.filter(id => componentOwners.get(componentId)?.has(id)).length < 2) continue;
        const origin = context.segmentById.get(parent.boneId)?.start;
        const shortest = Math.min(...children.map(id =>
            distance(context.segmentById.get(id).start, context.segmentById.get(id).end)));
        const radius = Math.max(context.gridDiagonal * 0.75, shortest * 0.3);
        if (origin && distance(point, origin) <= radius) owner = parent.boneId;
    }
    return owner;
}

function axisLines(snapshot, axis, components, context) {
    const horizontal = axis === 'x';
    const width = snapshot.width, height = snapshot.height;
    const size = horizontal ? width : height;
    const lines = new Set([0, size]);
    // Every alpha run boundary is preserved. This is deliberately conservative:
    // detailed art can hit the 256-vertex limit and returns a reasoned failure.
    for (let outer = 0; outer < (horizontal ? height : width); outer++) {
        let previous = false;
        for (let inner = 0; inner < size; inner++) {
            const x = horizontal ? inner : outer, y = horizontal ? outer : inner;
            const opaque = snapshot.pixels[(y * width + x) * 4 + 3] > components.threshold;
            if (opaque !== previous) lines.add(inner);
            previous = opaque;
        }
        if (previous) lines.add(size);
    }
    const coordinates = [...lines].sort((a, b) => a - b);
    for (let start = coordinates[0]; start < coordinates.at(-1); start += STEP) lines.add(start);
    for (const [childId, parentId] of context.parentById) {
        if (!parentId) continue;
        const child = context.segmentById.get(childId), parent = context.segmentById.get(parentId);
        if (!child || !parent) continue;
        const localLength = Math.min(distance(child.start, child.end), distance(parent.start, parent.end));
        const band = Math.min(context.gridDiagonal * 0.75,
            Math.max(context.gridDiagonal * 0.2, localLength * 0.3));
        const coord = horizontal ? child.start.x : child.start.y;
        for (const offset of [-band, 0, band]) {
            const value = Math.round(coord + offset);
            if (value > 0 && value < size) lines.add(value);
        }
    }
    return [...lines].sort((a, b) => a - b);
}

export function createHybridDomainPatch(asset, snapshot, rectangularSetup, context, options = {}) {
    const components = alphaComponents(snapshot, 0); // Production default alphaThreshold is 0.
    if (!components.components.length) return { ok: false, reason: 'empty-alpha' };
    const xs = axisLines(snapshot, 'x', components, context);
    const ys = axisLines(snapshot, 'y', components, context);
    const componentOwners = new Map(components.components.map(c => [c.id, new Set()]));
    for (let index = 0; index < components.labels.length; index++) {
        const component = components.labels[index];
        if (component < 0) continue;
        const x = index % snapshot.width + 0.5, y = Math.floor(index / snapshot.width) + 0.5;
        componentOwners.get(component).add(ranked({ x, y }, context)[0].boneId);
    }
    const vertices = [], triangles = [], vertexByPosition = new Map(), cells = [];
    const getVertex = (x, y) => {
        const key = pointKey(x, y);
        if (!vertexByPosition.has(key)) {
            const index = vertices.length;
            vertexByPosition.set(key, index);
            vertices.push({ vertexId: `hybrid-v-${index}`, x, y });
        }
        return vertexByPosition.get(key);
    };
    for (let yi = 0; yi < ys.length - 1; yi++) {
        for (let xi = 0; xi < xs.length - 1; xi++) {
            const x0 = xs[xi], x1 = xs[xi + 1], y0 = ys[yi], y1 = ys[yi + 1];
            if (x0 === x1 || y0 === y1) continue;
            const midX = Math.min(snapshot.width - 1, Math.floor((x0 + x1) / 2));
            const midY = Math.min(snapshot.height - 1, Math.floor((y0 + y1) / 2));
            const component = components.labels[midY * snapshot.width + midX];
            if (component < 0) continue;
            const corners = [getVertex(x0, y0), getVertex(x1, y0),
                getVertex(x0, y1), getVertex(x1, y1)];
            const domain = primaryDomain({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
                context, component, componentOwners);
            triangles.push([corners[0], corners[1], corners[3]], [corners[0], corners[3], corners[2]]);
            cells.push({ xi, yi, component, domain, corners, bounds: { x0, y0, x1, y1 } });
        }
    }
    if (vertices.length > RASTER_MESH_MAX_VERTICES) return { ok: false, reason: 'vertex-limit',
        vertexCount: vertices.length, componentCount: components.components.length };
    if (triangles.length === 0) return { ok: false, reason: 'no-triangles' };
    const byCell = new Map(cells.map(cell => [`${cell.xi},${cell.yi}`, cell]));
    const siblingEdges = [];
    for (const cell of cells) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const neighbor = byCell.get(`${cell.xi + dx},${cell.yi + dy}`);
            if (!neighbor || neighbor.component !== cell.component || neighbor.domain === cell.domain) continue;
            const parent = context.parentById;
            if (parent.get(cell.domain) === neighbor.domain || parent.get(neighbor.domain) === cell.domain) continue;
            siblingEdges.push({ a: cell.domain, b: neighbor.domain,
                ancestor: ancestorOf(cell.domain, neighbor.domain, parent),
                x: cell.bounds.x1, y: cell.bounds.y1 });
        }
    }
    const meshDefinition = { version: RASTER_MESH_SCHEMA_VERSION,
        meshId: options.meshId || 'hybrid-diagnostic-mesh',
        targetInternalLayerId: options.targetInternalLayerId || 'art',
        vertices, triangles: triangles.map(t => t.map(index => vertices[index].vertexId)) };
    return { ok: true, meshDefinition, skinBinding: withFixedWeights(meshDefinition, context),
        diagnostic: { alpha: components, cells, siblingEdges,
            transitionBand: 'min(0.75 * rectGridDiagonal, max(0.2 * rectGridDiagonal, 0.3 * min(parentLength, childLength)))',
            branchRadius: 'max(0.75 * rectGridDiagonal, 0.3 * shortestChildLength)',
            step: STEP, alphaThreshold: 0 } };
}
