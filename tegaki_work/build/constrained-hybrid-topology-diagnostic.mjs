// R-46B diagnostic only. Fixed raster scaffold, explicit region boundaries,
// and constrained simple-face triangulation. No production registration.
import { performance } from 'node:perf_hooks';
import { alphaComponents, withFixedWeights } from './hybrid-domain-patch-diagnostic.mjs';
import { RASTER_MESH_MAX_VERTICES, RASTER_MESH_SCHEMA_VERSION }
    from '../system/animation/raster-bone-skinning.js';

const H = 24;
const EPS = 1e-9;
const fail = (reason, detail = {}) => ({ ok: false, reason, detail });
const key = (x, y) => `${x},${y}`;
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cellKey = (xi, yi) => `${xi},${yi}`;

export function nearest(point, context) {
    let best = null;
    for (const segment of context.segments) {
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        const denominator = dx * dx + dy * dy;
        const t = denominator > EPS ? Math.max(0, Math.min(1,
            ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / denominator)) : 0;
        const distance2 = (point.x - segment.start.x - t * dx) ** 2
            + (point.y - segment.start.y - t * dy) ** 2;
        const candidate = { boneId: segment.boneId, distance2 };
        if (!best || distance2 < best.distance2 - EPS
            || (Math.abs(distance2 - best.distance2) <= EPS
                && candidate.boneId.localeCompare(best.boneId) < 0)) best = candidate;
    }
    return best?.boneId || null;
}

export function fixedLines(snapshot, labels) {
    const lines = [new Set([0, snapshot.width]), new Set([0, snapshot.height])];
    for (let x = H; x < snapshot.width; x += H) lines[0].add(x);
    for (let y = H; y < snapshot.height; y += H) lines[1].add(y);
    // Alpha run edges are part of the fixed artwork input, never Bone-derived.
    for (let y = 0; y < snapshot.height; y++) for (let x = 0; x < snapshot.width; x++) {
        const index = y * snapshot.width + x;
        const occupied = labels[index] >= 0;
        if (occupied !== (x > 0 && labels[index - 1] >= 0)) lines[0].add(x);
        if (occupied !== (y > 0 && labels[index - snapshot.width] >= 0)) lines[1].add(y);
        if (occupied && x === snapshot.width - 1) lines[0].add(snapshot.width);
        if (occupied && y === snapshot.height - 1) lines[1].add(snapshot.height);
    }
    return lines.map(set => [...set].sort((a, b) => a - b));
}

function ancestry(a, b, parents) {
    if (a === b) return 'SELF';
    if (parents.get(a) === b || parents.get(b) === a) return 'PARENT_CHILD_PORTAL';
    for (let cursor = parents.get(a); cursor; cursor = parents.get(cursor)) {
        if (cursor === b) return 'ANCESTOR_PORTAL';
    }
    for (let cursor = parents.get(b); cursor; cursor = parents.get(cursor)) {
        if (cursor === a) return 'ANCESTOR_PORTAL';
    }
    return 'DISALLOWED_SIBLING';
}

function portalFor(childId, context) {
    const parentId = context.parentById.get(childId);
    const child = context.segmentById.get(childId);
    const parent = context.segmentById.get(parentId);
    if (!child || !parent) return null;
    const childLength = pointDistance(child.start, child.end);
    const parentLength = pointDistance(parent.start, parent.end);
    const length = parentLength > EPS ? Math.min(parentLength, childLength) : childLength;
    const r = Math.min(H, 0.3 * length);
    const ux = childLength > EPS ? (child.end.x - child.start.x) / childLength : 0;
    const uy = childLength > EPS ? (child.end.y - child.start.y) / childLength : 0;
    return { childId, parentId, r, center: { x: child.start.x + r * ux,
        y: child.start.y + r * uy }, cells: [] };
}

function findRoute(cells, byGrid, start, end, parentId, childId, portal, context) {
    const startKey = cellKey(start.xi, start.yi), endKey = cellKey(end.xi, end.yi);
    const queue = [start];
    const previous = new Map([[startKey, null]]);
    for (let head = 0; head < queue.length && !previous.has(endKey); head++) {
        const current = queue[head];
        // Coordinate order is stable and independent of Bone iteration order.
        for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
            const next = byGrid.get(cellKey(current.xi + dx, current.yi + dy));
            if (!next || next.component !== start.component) continue;
            const nextKey = cellKey(next.xi, next.yi);
            if (previous.has(nextKey)) continue;
            const role = ancestry(next.initialDomain, parentId, context.parentById);
            const targetProximal = next.initialDomain === childId
                && pointDistance(next.center, context.segmentById.get(childId).start)
                    <= portal.r + H;
            if (role === 'DISALLOWED_SIBLING' && !targetProximal && next !== end) continue;
            previous.set(nextKey, cellKey(current.xi, current.yi));
            queue.push(next);
        }
    }
    if (!previous.has(endKey)) return null;
    const path = [];
    for (let cursor = endKey; cursor; cursor = previous.get(cursor)) path.push(byGrid.get(cursor));
    path.reverse();
    const length = path.slice(1).reduce((sum, cell, index) =>
        sum + pointDistance(path[index].center, cell.center), 0);
    const limit = pointDistance(context.segmentById.get(parentId).start, portal.center) * 1.5 + 2 * H;
    return { path, length, limit };
}

function area2(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function quality(a, b, c) {
    const area = Math.abs(area2(a, b, c));
    const edges = [[a, b], [b, c], [c, a]].map(([u, v]) =>
        (u.x - v.x) ** 2 + (u.y - v.y) ** 2);
    return { normalizedArea2: area / H ** 2, aspect: Math.max(...edges) / area };
}

function insideTriangle(point, a, b, c) {
    return area2(a, b, point) >= -EPS && area2(b, c, point) >= -EPS
        && area2(c, a, point) >= -EPS;
}

// Bounded ear clipper: faces here are simple fixed-cell polygons. The candidate
// rule and key tie-break also work for a future non-rectangular simple face.
export function triangulate(face) {
    const remaining = [...face];
    const triangles = [];
    while (remaining.length > 3) {
        const ears = [];
        for (let i = 0; i < remaining.length; i++) {
            const prev = remaining[(i + remaining.length - 1) % remaining.length];
            const tip = remaining[i], next = remaining[(i + 1) % remaining.length];
            if (area2(prev, tip, next) <= EPS) continue;
            if (remaining.some((point, j) => j !== i && j !== (i + 1) % remaining.length
                && j !== (i + remaining.length - 1) % remaining.length
                && insideTriangle(point, prev, tip, next))) continue;
            const q = quality(prev, tip, next);
            if (q.normalizedArea2 <= 1e-6 || q.aspect > 30) continue;
            ears.push({ i, score: q.aspect, key: tip.key, triangle: [prev, tip, next] });
        }
        ears.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
        if (!ears.length) return null;
        const ear = ears[0];
        triangles.push(ear.triangle);
        remaining.splice(ear.i, 1);
    }
    const q = quality(...remaining);
    if (area2(...remaining) <= EPS || q.normalizedArea2 <= 1e-6 || q.aspect > 30) return null;
    triangles.push(remaining);
    return triangles;
}

export function createConstrainedHybridTopology(asset, snapshot, rectangularSetup, context) {
    const started = performance.now();
    if (!snapshot?.pixels || !context?.ok || !rectangularSetup?.ok) return fail('invalid-input');
    if (context.boneById.size < 2) return fail('invalid-input', { cause: 'need-child-bone' });
    const alpha = alphaComponents(snapshot, 0);
    if (!alpha.components.length) return fail('invalid-input', { cause: 'empty-alpha' });
    if (alpha.components.length * 4 > RASTER_MESH_MAX_VERTICES) {
        return fail('vertex-limit', { componentCount: alpha.components.length,
            minimumVertexCount: alpha.components.length * 4 });
    }
    const [xs, ys] = fixedLines(snapshot, alpha.labels);
    const pixelDomains = new Array(snapshot.width * snapshot.height).fill(null);
    for (let i = 0; i < pixelDomains.length; i++) {
        if (alpha.labels[i] >= 0) pixelDomains[i] = nearest({ x: i % snapshot.width + 0.5,
            y: Math.floor(i / snapshot.width) + 0.5 }, context);
    }
    const cells = [], byGrid = new Map();
    for (let yi = 0; yi < ys.length - 1; yi++) for (let xi = 0; xi < xs.length - 1; xi++) {
        const x0 = xs[xi], x1 = xs[xi + 1], y0 = ys[yi], y1 = ys[yi + 1];
        const sample = Math.floor((y0 + y1) / 2) * snapshot.width + Math.floor((x0 + x1) / 2);
        const component = alpha.labels[sample];
        if (component < 0) continue;
        const tally = new Map();
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const owner = pixelDomains[y * snapshot.width + x];
            tally.set(owner, (tally.get(owner) || 0) + 1);
        }
        const initialDomain = [...tally].sort((a, b) => b[1] - a[1]
            || a[0].localeCompare(b[0]))[0][0];
        const cell = { xi, yi, component, bounds: { x0, y0, x1, y1 },
            center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
            initialDomain, domain: initialDomain, portalIds: [] };
        cells.push(cell); byGrid.set(cellKey(xi, yi), cell);
    }
    const alphaDomainMs = performance.now() - started;
    const depth = boneId => {
        let value = 0;
        for (let parent = context.parentById.get(boneId); parent;
            parent = context.parentById.get(parent)) value++;
        return value;
    };
    const portals = [...context.parentById].filter(([, parent]) => parent)
        .map(([child]) => portalFor(child, context))
        .sort((a, b) => depth(a.childId) - depth(b.childId)
            || a.childId.localeCompare(b.childId));
    if (portals.some(p => !p || p.r <= EPS)) return fail('impossible-joint-portal', { cause: 'zero-radius' });
    for (const portal of portals) {
        const candidates = cells.filter(cell => {
            const { x0, y0, x1, y1 } = cell.bounds;
            const closest = { x: Math.max(x0, Math.min(x1, portal.center.x)),
                y: Math.max(y0, Math.min(y1, portal.center.y)) };
            return pointDistance(closest, portal.center) <= portal.r / 2;
        });
        if (!candidates.length) return fail('impossible-joint-portal', {
            child: portal.childId, cause: 'no-alpha-cell-in-snapped-portal', center: portal.center,
            radius: portal.r / 2 });
        portal.cells = candidates.map(c => cellKey(c.xi, c.yi));
        for (const cell of candidates) cell.portalIds.push(portal.childId);
    }
    for (const cell of cells) if (cell.portalIds.length > 1) {
        return fail('impossible-joint-portal', { cause: 'overlapping-portals',
            cell: cellKey(cell.xi, cell.yi), portals: cell.portalIds });
    }
    const routes = [];
    for (const portal of portals) {
        const parent = context.segmentById.get(portal.parentId);
        const start = [...cells].sort((a, b) => pointDistance(a.center, parent.start)
            - pointDistance(b.center, parent.start)
            || a.yi - b.yi || a.xi - b.xi)[0];
        const ends = portal.cells.map(id => byGrid.get(id)).filter(c => c.component === start.component)
            .sort((a, b) => pointDistance(a.center, portal.center)
                - pointDistance(b.center, portal.center) || a.yi - b.yi || a.xi - b.xi);
        if (!ends.length) {
            routes.push({ childId: portal.childId, parentId: portal.parentId,
                cells: [], disconnectedComponent: true });
            continue;
        }
        const route = findRoute(cells, byGrid, start, ends[0], portal.parentId,
            portal.childId, portal, context);
        if (!route || route.length > route.limit + EPS) return fail('impossible-joint-portal', {
            child: portal.childId, cause: route ? 'route-length-limit' : 'no-allowed-route',
            routeLength: route?.length, limit: route?.limit });
        const routeCells = [];
        for (const cell of cells) {
            if (cell.component !== start.component) continue;
            const nearRoute = route.path.some(pathCell => {
                const { x0, y0, x1, y1 } = pathCell.bounds;
                const closest = { x: Math.max(x0, Math.min(x1, cell.center.x)),
                    y: Math.max(y0, Math.min(y1, cell.center.y)) };
                return pointDistance(closest, cell.center) <= portal.r;
            });
            if (!nearRoute) continue;
            const owner = cell.initialDomain;
            if (owner !== portal.parentId && owner !== context.rootBoneId) {
                const ownerSegment = context.segmentById.get(owner);
                const ownerPortal = portals.find(p => p.childId === owner);
                if (ownerSegment && ownerPortal
                    && pointDistance(cell.center, ownerSegment.start) > ownerPortal.r + H) continue;
            }
            cell.domain = portal.parentId;
            routeCells.push(cellKey(cell.xi, cell.yi));
        }
        routes.push({ childId: portal.childId, parentId: portal.parentId,
            cells: routeCells, centerline: route.path.map(c => cellKey(c.xi, c.yi)), length: route.length,
            limit: route.limit });
    }
    const graph = [], forbidden = [], boundaryKinds = {};
    const incident = new Map();
    const addIncident = (x, y, cell) => {
        const id = key(x, y);
        if (!incident.has(id)) incident.set(id, []);
        incident.get(id).push(cell);
    };
    for (const cell of cells) {
        const { x0, y0, x1, y1 } = cell.bounds;
        for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) addIncident(x, y, cell);
        for (const [dx, dy, side] of [[1, 0, 'right'], [0, 1, 'bottom']]) {
            const neighbor = byGrid.get(cellKey(cell.xi + dx, cell.yi + dy));
            if (!neighbor) continue;
            const permission = cell.component !== neighbor.component ? 'DISALLOWED_COMPONENT'
                : ancestry(cell.domain, neighbor.domain, context.parentById);
            const portal = cell.portalIds.some(id => neighbor.portalIds.includes(id))
                || cell.portalIds.includes(neighbor.domain) || neighbor.portalIds.includes(cell.domain);
            const kind = permission === 'SELF' ? 'tile'
                : portal ? 'portal' : 'domain';
            const edge = { from: side === 'right' ? [x1, y0] : [x0, y1],
                to: [x1, y1], side, a: cell.domain, b: neighbor.domain,
                permission, kind, cell: cellKey(cell.xi, cell.yi) };
            if (side === 'bottom') edge.to = [x1, y1];
            graph.push(edge);
            boundaryKinds[kind] = (boundaryKinds[kind] || 0) + 1;
            if (permission.startsWith('DISALLOWED')
                || (permission !== 'SELF' && !portal)) forbidden.push(edge);
        }
    }
    // Include exterior Alpha edges in the explicit graph.
    for (const cell of cells) {
        const { x0, y0, x1, y1 } = cell.bounds;
        for (const [dx, dy, from, to] of [
            [-1, 0, [x0, y0], [x0, y1]], [1, 0, [x1, y0], [x1, y1]],
            [0, -1, [x0, y0], [x1, y0]], [0, 1, [x0, y1], [x1, y1]]]) {
            if (!byGrid.has(cellKey(cell.xi + dx, cell.yi + dy))) {
                graph.push({ from, to, a: cell.domain, b: null,
                    permission: 'EXTERIOR', kind: 'alpha-exterior' });
                boundaryKinds['alpha-exterior'] = (boundaryKinds['alpha-exterior'] || 0) + 1;
            }
        }
    }
    for (const [vertex, adjacent] of incident) {
        for (let i = 0; i < adjacent.length; i++) for (let j = i + 1; j < adjacent.length; j++) {
            const a = adjacent[i], b = adjacent[j];
            if (a.component !== b.component) {
                forbidden.push({ vertex, a: a.component, b: b.component,
                    permission: 'DISALLOWED_COMPONENT', kind: 'vertex-contact' });
                continue;
            }
            if (ancestry(a.domain, b.domain, context.parentById) === 'DISALLOWED_SIBLING') {
                forbidden.push({ vertex, a: a.domain, b: b.domain,
                    permission: 'DISALLOWED_SIBLING', kind: 'vertex-contact' });
            }
        }
    }
    const graphMs = performance.now() - started - alphaDomainMs;
    if (forbidden.length) return fail('impossible-joint-portal', {
        cause: 'forbidden-contact-or-unconfined-portal', count: forbidden.length,
        witness: forbidden[0], alphaComponents: alpha.components.length,
        cells: cells.length, portals, routes, boundaryKinds });
    for (const portal of portals) {
        const initial = cells.filter(cell => cell.initialDomain === portal.childId);
        if (initial.length && !cells.some(cell => cell.domain === portal.childId)) {
            return fail('no-valid-domain-partition', { cause: 'child-distal-domain-consumed',
                child: portal.childId, initialCells: initial.map(c => cellKey(c.xi, c.yi)),
                portalCells: portal.cells });
        }
    }
    const vertices = [], triangles = [], vertexByPosition = new Map(), faceOwners = [];
    const getVertex = (x, y, component) => {
        const position = key(x, y);
        if (!vertexByPosition.has(position)) {
            const vertex = { vertexId: `constrained-v-${vertices.length}`, x, y,
                key: `${component}:${x}:${y}:constraint` };
            vertexByPosition.set(position, vertex);
            vertices.push(vertex);
        }
        return vertexByPosition.get(position);
    };
    let warned = 0, maxAspect = 0;
    for (const cell of cells) {
        const { x0, y0, x1, y1 } = cell.bounds;
        const face = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            .map(([x, y]) => getVertex(x, y, cell.component));
        const ears = triangulate(face);
        if (!ears) return fail('triangle-quality-failure', { cell: cellKey(cell.xi, cell.yi) });
        for (const triangle of ears) {
            const q = quality(...triangle);
            maxAspect = Math.max(maxAspect, q.aspect);
            if (q.aspect > 10) warned++;
            triangles.push(triangle.map(vertex => vertex.vertexId));
            faceOwners.push({ component: cell.component, domain: cell.domain,
                cell: cellKey(cell.xi, cell.yi) });
        }
    }
    if (vertices.length > RASTER_MESH_MAX_VERTICES) return fail('vertex-limit', {
        vertexCount: vertices.length, componentCount: alpha.components.length });
    if (!triangles.length) return fail('invalid-constrained-polygon', { cause: 'no-faces' });
    const triangulationMs = performance.now() - started - alphaDomainMs - graphMs;
    const meshDefinition = { version: RASTER_MESH_SCHEMA_VERSION,
        meshId: 'constrained-diagnostic-mesh', targetInternalLayerId: 'art',
        vertices: vertices.map(({ vertexId, x, y }) => ({ vertexId, x, y })), triangles };
    return { ok: true, meshDefinition,
        skinBinding: withFixedWeights(meshDefinition, context),
        diagnostic: { alpha, xs, ys, cells, pixelDomains, portals, routes, graph,
            faceOwners, vertexKeys: vertices.map(v => v.key), boundaryKinds,
            quality: { warnings: warned, maxAspect },
            timingMs: { alphaDomain: alphaDomainMs, graph: graphMs,
                triangulation: triangulationMs, total: performance.now() - started } } };
}
