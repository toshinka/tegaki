// R-46F diagnostic only. Bone ownership remains the R-46D frozen cell array.
import { performance } from 'node:perf_hooks';
import { withFixedWeights } from './hybrid-domain-patch-diagnostic.mjs';
import { triangulate, quality } from './constrained-hybrid-topology-diagnostic.mjs';
import { createAlphaInterfacePermissionTopology, componentsOfEdges,
    nearestAlphaDistances, costToEdge, allowedCorridor }
    from './alpha-interface-permission-diagnostic.mjs';
import { RASTER_MESH_MAX_VERTICES, RASTER_MESH_SCHEMA_VERSION }
    from '../system/animation/raster-bone-skinning.js';

const H = 24, EPS = 1e-9;
const cellId = c => `${c.xi},${c.yi}`;
const pointId = (x, y) => `${x},${y}`;
const role = (kind, id) => `${kind}:${id}`;
const ordered = values => [...values].sort((a, b) => a.localeCompare(b));
const length = s => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
const sameParent = (a, b, parents) => a !== b && parents.get(a)
    && parents.get(a) === parents.get(b);
const forbiddenChildren = (a, b, parents) => a !== b
    && parents.get(a) !== b && parents.get(b) !== a;
const neighbors = c => [[c.xi - 1, c.yi], [c.xi + 1, c.yi],
    [c.xi, c.yi - 1], [c.xi, c.yi + 1]];

function countComponents(indices, cells, byGrid) {
    const pending = new Set(indices), result = [];
    while (pending.size) {
        const first = Math.min(...pending), queue = [first], group = [];
        pending.delete(first);
        for (let head = 0; head < queue.length; head++) {
            const i = queue[head]; group.push(i);
            for (const [x, y] of neighbors(cells[i])) {
                const next = byGrid.get(pointId(x, y));
                if (next !== undefined && pending.delete(next)) queue.push(next);
            }
        }
        result.push(group.sort((a, b) => a - b));
    }
    return result;
}

function alphaDistance(snapshot, alpha, component, point, cells) {
    const { width, height } = snapshot;
    const seed = { x: Math.floor(point.x) + 0.5, y: Math.floor(point.y) + 0.5 };
    let nearest = -1, nearestCost = Infinity;
    for (let i = 0; i < alpha.labels.length; i++) {
        if (alpha.labels[i] !== component) continue;
        const cost = Math.hypot(i % width + 0.5 - seed.x,
            Math.floor(i / width) + 0.5 - seed.y);
        if (cost < nearestCost - EPS) { nearest = i; nearestCost = cost; }
    }
    if (nearest < 0 || nearestCost > H + EPS) return { seed, nearestCost,
        cellDistances: [], reason: 'missing-junction-support' };
    const distances = new Int32Array(alpha.labels.length).fill(-1);
    const queue = [nearest]; distances[nearest] = 0;
    for (let head = 0; head < queue.length; head++) {
        const i = queue[head], x = i % width, y = Math.floor(i / width);
        for (const next of [x > 0 ? i - 1 : -1, y > 0 ? i - width : -1,
            x + 1 < width ? i + 1 : -1, y + 1 < height ? i + width : -1]) {
            if (next < 0 || alpha.labels[next] !== component || distances[next] >= 0) continue;
            distances[next] = distances[i] + 1; queue.push(next);
        }
    }
    const cellDistances = cells.map(cell => {
        let best = Infinity;
        for (let y = cell.bounds.y0; y < cell.bounds.y1; y++)
            for (let x = cell.bounds.x0; x < cell.bounds.x1; x++) {
                const d = distances[y * width + x];
                if (d >= 0) best = Math.min(best, d);
            }
        return best;
    });
    return { seed, nearestCost, cellDistances };
}

function protectedCell(cell, segment, snapshot) {
    const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
    const denom = dx * dx + dy * dy;
    if (denom <= EPS) return null;
    // Distal half begins at axis projection t=0.5 from the child joint.
    for (let y = cell.bounds.y0; y < cell.bounds.y1; y++)
        for (let x = cell.bounds.x0; x < cell.bounds.x1; x++) {
            if (!snapshot.pixels[(y * snapshot.width + x) * 4 + 3]) continue;
            const t = ((x + 0.5 - segment.start.x) * dx
                + (y + 0.5 - segment.start.y) * dy) / denom;
            if (t >= 0.5 - EPS) return { x, y, projection: t };
        }
    return null;
}

// R-47 Policy C: the tip's nearest child-owned Alpha pixel is a fixed sentinel.
// Once whole candidate cells become Junction, all remaining child-owned Alpha
// pixels must still be one 4-connected component containing that sentinel.
export function measureResidualChildCore(cells, snapshot, segment, child, candidate) {
    const started = performance.now(), { width, height } = snapshot;
    const owned = cells.filter(c => c.domain === child);
    let seedIndex = -1, seedCell = null, seedDistance = Infinity;
    for (const cell of owned) {
        const { x0, y0, x1, y1 } = cell.bounds;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const index = y * width + x;
            if (!snapshot.pixels[index * 4 + 3]) continue;
            const d = Math.hypot(x + 0.5 - segment.end.x, y + 0.5 - segment.end.y);
            if (d < seedDistance - EPS || (Math.abs(d - seedDistance) <= EPS
                && (seedIndex < 0 || index < seedIndex))) {
                seedIndex = index; seedCell = cellId(cell); seedDistance = d;
            }
        }
    }
    const supportMs = performance.now() - started;
    const distalSeed = seedIndex < 0 ? null : { x: seedIndex % width,
        y: Math.floor(seedIndex / width), cell: seedCell, distance: seedDistance };
    if (!distalSeed || seedDistance > H + EPS) return { ok: false,
        reason: 'missing-distal-support', distalSeed, supportMs, validationMs: 0 };
    const validationStart = performance.now();
    const remaining = owned.filter(c => !candidate.has(cellId(c)));
    const present = new Uint8Array(width * height);
    let remainingAlpha = 0;
    for (const cell of remaining) {
        const { x0, y0, x1, y1 } = cell.bounds;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const index = y * width + x;
            if (!snapshot.pixels[index * 4 + 3]) continue;
            present[index] = 1; remainingAlpha++;
        }
    }
    const seedRepresented = present[seedIndex] === 1;
    let connectedAlpha = 0;
    if (seedRepresented) {
        const queue = [seedIndex]; present[seedIndex] = 0;
        for (let head = 0; head < queue.length; head++) {
            const index = queue[head], x = index % width, y = Math.floor(index / width);
            connectedAlpha++;
            for (const next of [x > 0 ? index - 1 : -1,
                x + 1 < width ? index + 1 : -1,
                y > 0 ? index - width : -1,
                y + 1 < height ? index + width : -1]) {
                if (next < 0 || !present[next]) continue;
                present[next] = 0; queue.push(next);
            }
        }
    }
    const ok = remaining.length > 0 && remainingAlpha > 0
        && seedRepresented && connectedAlpha === remainingAlpha;
    return { ok, reason: ok ? null : 'junction-overflow',
        cause: !remaining.length || !remainingAlpha ? 'child-area-zero'
            : !seedRepresented ? 'distal-support-consumed' : 'residual-child-disconnected',
        distalSeed, protectedPixels: 1, protectedCells: 1,
        remainingCells: remaining.length, remainingAlpha, seedRepresented,
        connectedAlpha, residualComponents: ok ? 1 : null,
        supportMs, validationMs: performance.now() - validationStart };
}

export function createNeutralJunctionTopology(asset, snapshot, rectangularSetup,
    context, options = {}) {
    const corePolicy = options.corePolicy || 'axial-half';
    const started = performance.now();
    const baseline = createAlphaInterfacePermissionTopology(asset, snapshot,
        rectangularSetup, context);
    const diagnostic = { alpha: baseline.diagnostic.alpha, cells: baseline.diagnostic.cells,
        ownershipBefore: baseline.diagnostic.ownershipBefore,
        ownershipAfter: baseline.diagnostic.cells.map(c => c.domain),
        ownershipUnchanged: false, frozenDomainCounts: baseline.diagnostic.frozenDomainCounts,
        geometryRoles: [], roleCounts: {}, junctions: [], interfaces: [],
        siblingSharedVertices: null, siblingSharedEdges: null,
        quality: null, constraints: [], faceRoles: [], scaffoldVertexCount: 0,
        corePolicy, timingMs: { ownership: baseline.diagnostic.timingMs.total,
            siblingContact: 0, junction: 0, distalSupport: 0, coreValidation: 0,
            association: 0, graph: 0,
            triangulation: 0, total: 0 } };
    const finish = (reason, detail = {}) => {
        diagnostic.roleCounts = Object.fromEntries(ordered(new Set(diagnostic.geometryRoles))
            .map(r => [r, diagnostic.geometryRoles.filter(value => value === r).length]));
        diagnostic.timingMs.total = performance.now() - started;
        return { ok: false, reason, detail, diagnostic };
    };
    if (!snapshot?.pixels || !rectangularSetup?.ok || !context?.ok)
        return finish('invalid-input');
    if (corePolicy !== 'axial-half' && corePolicy !== 'residual-child-connectivity')
        return finish('invalid-input', { cause: 'unknown-core-policy', corePolicy });
    const cells = diagnostic.cells, alpha = diagnostic.alpha;
    const byGrid = new Map(cells.map((c, i) => [cellId(c), i]));
    diagnostic.ownershipUnchanged = JSON.stringify(diagnostic.ownershipBefore)
        === JSON.stringify(diagnostic.ownershipAfter);
    if (!diagnostic.ownershipUnchanged) return finish('invalid-input', { cause: 'ownership-changed' });
    const roles = cells.map(c => role('CHILD', c.domain));
    diagnostic.geometryRoles = roles;
    const incident = new Map(), edges = [], seedsByAncestor = new Map();
    const addIncident = (x, y, i) => {
        const id = pointId(x, y);
        if (!incident.has(id)) incident.set(id, []);
        incident.get(id).push(i);
    };
    for (let i = 0; i < cells.length; i++) {
        const c = cells[i], { x0, y0, x1, y1 } = c.bounds;
        for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
            addIncident(x, y, i);
        for (const [dx, dy, from, to] of [
            [1, 0, [x1, y0], [x1, y1]], [0, 1, [x0, y1], [x1, y1]]]) {
            const j = byGrid.get(pointId(c.xi + dx, c.yi + dy));
            if (j === undefined) continue;
            edges.push({ id: `${pointId(...from)}>${pointId(...to)}`, from, to,
                a: i, b: j, component: c.component });
        }
    }
    diagnostic.scaffoldVertexCount = incident.size;
    const seed = (a, b) => {
        const ca = cells[a], cb = cells[b];
        if (ca.component !== cb.component
            || !sameParent(ca.domain, cb.domain, context.parentById)) return;
        const parent = context.parentById.get(ca.domain);
        const key = `${ca.component}|${parent}`;
        if (!seedsByAncestor.has(key)) seedsByAncestor.set(key, new Set());
        seedsByAncestor.get(key).add(a); seedsByAncestor.get(key).add(b);
    };
    for (const edge of edges) seed(edge.a, edge.b);
    for (const list of incident.values()) for (let a = 0; a < list.length; a++)
        for (let b = a + 1; b < list.length; b++) seed(list[a], list[b]);
    diagnostic.timingMs.siblingContact = performance.now() - started
        - diagnostic.timingMs.ownership;
    const junctionStart = performance.now();
    for (const [key, seedSet] of [...seedsByAncestor].sort((a, b) =>
        a[0].localeCompare(b[0]))) {
        const [componentText, parent] = key.split('|'), component = Number(componentText);
        const children = ordered([...context.parentById].filter(([, p]) => p === parent)
            .map(([id]) => id).filter(id => cells.some(c =>
                c.component === component && c.domain === id)));
        const candidate = new Set(seedSet);
        for (const i of seedSet) for (const [x, y] of neighbors(cells[i])) {
            const j = byGrid.get(pointId(x, y));
            if (j !== undefined && cells[j].component === component) candidate.add(j);
        }
        const indexes = [...candidate].sort((a, b) => a - b);
        const row = { ancestor: parent, component, seedCount: seedSet.size,
            seeds: [...seedSet].sort((a, b) => a - b).map(i => cellId(cells[i])),
            candidateCount: indexes.length, candidateCells: indexes.map(i => cellId(cells[i])),
            expansionCount: indexes.length - seedSet.size, finalCount: 0,
            protectedRejected: [], distanceMin: null, distanceMax: null,
            componentCount: countComponents(indexes, cells, byGrid).length,
            childRetained: {}, coreByChild: {}, support: null };
        diagnostic.junctions.push(row);
        if (row.componentCount !== 1) return finish('ambiguous-junction-region', row);
        const parentSegment = context.segmentById.get(parent);
        if (!parentSegment) return finish('invalid-input', { cause: 'missing-ancestor', parent });
        const support = alphaDistance(snapshot, alpha, component, parentSegment.start, cells);
        row.support = { seed: support.seed, nearestCost: support.nearestCost };
        if (support.reason) return finish(support.reason, row);
        const maxChildLength = Math.max(...children.map(id => length(context.segmentById.get(id))));
        const radius = 2 * H + maxChildLength;
        row.radius = radius;
        row.distanceMin = Math.min(...indexes.map(i => support.cellDistances[i]));
        row.distanceMax = Math.max(...indexes.map(i => support.cellDistances[i]));
        const overDistance = indexes.filter(i => support.cellDistances[i] > radius + EPS);
        if (overDistance.length) return finish('junction-overflow', {
            cause: 'ancestor-distance', cells: overDistance.map(i => cellId(cells[i])), row });
        for (const child of children) {
            const segment = context.segmentById.get(child);
            if (!segment || length(segment) <= EPS)
                return finish('invalid-input', { cause: 'zero-length-child', child });
            if (corePolicy === 'residual-child-connectivity') {
                const core = measureResidualChildCore(cells, snapshot, segment,
                    child, new Set(indexes.map(i => cellId(cells[i]))));
                row.coreByChild[child] = core;
                row.childRetained[child] = core.remainingCells ?? 0;
                diagnostic.timingMs.distalSupport += core.supportMs;
                diagnostic.timingMs.coreValidation += core.validationMs;
                if (!core.ok) return finish(core.reason, { cause: core.cause,
                    child, core, row });
                continue;
            }
            for (const i of indexes) {
                if (cells[i].domain !== child) continue;
                const pixel = protectedCell(cells[i], segment, snapshot);
                if (pixel) row.protectedRejected.push({ child, cell: cellId(cells[i]), pixel });
            }
            row.childRetained[child] = cells.filter((c, i) => c.component === component
                && c.domain === child && !candidate.has(i)).length;
        }
        if (row.protectedRejected.length) return finish('junction-overflow', {
            cause: 'distal-protection', first: row.protectedRejected[0], row });
        if (Object.values(row.childRetained).some(count => count === 0))
            return finish('junction-overflow', { cause: 'child-area-zero', row });
        for (const i of indexes) {
            if (roles[i].startsWith('JUNCTION:'))
                return finish('ambiguous-junction-region', { cause: 'overlapping-ancestors', cell: cellId(cells[i]) });
            roles[i] = role('JUNCTION', parent);
        }
        row.finalCount = indexes.length;
    }
    diagnostic.timingMs.junction = performance.now() - junctionStart;
    diagnostic.geometryRoles = roles;
    diagnostic.roleCounts = Object.fromEntries(ordered(new Set(roles)).map(r =>
        [r, roles.filter(value => value === r).length]));

    const associationStart = performance.now();
    const interfaceEdges = new Map();
    for (const edge of edges) {
        if (cells[edge.a].component !== cells[edge.b].component) continue;
        const a = roles[edge.a], b = roles[edge.b];
        if (a === b) continue;
        const child = a.startsWith('CHILD:') ? a.slice(6)
            : b.startsWith('CHILD:') ? b.slice(6) : null;
        const parent = child && context.parentById.get(child);
        if (!parent || ![a, b].includes(role('JUNCTION', parent))) continue;
        const key = `${edge.component}|${parent}|${child}`;
        if (!interfaceEdges.has(key)) interfaceEdges.set(key, []);
        interfaceEdges.get(key).push(edge);
    }
    const rolePixels = new Array(snapshot.width * snapshot.height).fill(null);
    for (let i = 0; i < cells.length; i++) {
        const { x0, y0, x1, y1 } = cells[i].bounds;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
            rolePixels[y * snapshot.width + x] = roles[i];
    }
    for (const row of diagnostic.junctions) {
        const children = ordered([...context.parentById].filter(([, p]) => p === row.ancestor)
            .map(([id]) => id).filter(id => cells.some(c =>
                c.component === row.component && c.domain === id)));
        for (const child of children) {
            const key = `${row.component}|${row.ancestor}|${child}`;
            const groups = componentsOfEdges(interfaceEdges.get(key) || []);
            const segment = context.segmentById.get(child);
            const parentSegment = context.segmentById.get(row.ancestor);
            const local = length(parentSegment) > EPS
                ? Math.min(length(parentSegment), length(segment)) : length(segment);
            const limit = 2 * H + 0.5 * local;
            const jointSeed = { x: Math.floor(segment.start.x) + 0.5,
                y: Math.floor(segment.start.y) + 0.5 };
            const pair = new Set([role('CHILD', child), role('JUNCTION', row.ancestor)]);
            const { costs, starts } = nearestAlphaDistances(snapshot, alpha,
                rolePixels, jointSeed, pair);
            const choices = groups.map((group, i) => {
                const scored = group.map(edge => ({ edge,
                    cost: costToEdge(edge, costs, snapshot.width) }))
                    .sort((a, b) => a.cost - b.cost || a.edge.id.localeCompare(b.edge.id));
                return { id: `${key}#${i}`, group, anchor: scored[0]?.edge,
                    cost: scored[0]?.cost ?? Infinity };
            }).sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
            const winner = choices[0];
            const selected = winner && Number.isFinite(winner.cost)
                && winner.cost <= limit + EPS
                ? allowedCorridor(winner.group, winner.anchor, limit) : [];
            const selectedLength = (winner?.group || []).filter(edge =>
                selected.includes(edge.id)).reduce((sum, edge) => sum
                    + Math.hypot(edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]), 0);
            const contact = { parent: row.ancestor, child, component: row.component,
                jointSeed, limit, starts, candidateComponents: groups.length,
                selected: winner?.id || null, cost: winner?.cost ?? null,
                length: selectedLength, boundaryIds: selected,
                remaining: groups.reduce((sum, group) => sum + group.length, 0) - selected.length };
            diagnostic.interfaces.push(contact);
            if (!selected.length || contact.remaining || (choices.length > 1
                && Math.abs(choices[1].cost - winner.cost) <= EPS))
                return finish('junction-child-contact-missing', contact);
        }
    }
    diagnostic.timingMs.association = performance.now() - associationStart;

    const graphStart = performance.now();
    let siblingSharedEdges = 0, siblingSharedVertices = 0;
    for (const edge of edges) {
        const a = roles[edge.a], b = roles[edge.b];
        diagnostic.constraints.push({ id: edge.id, a, b });
        if (a.startsWith('CHILD:') && b.startsWith('CHILD:')
            && forbiddenChildren(a.slice(6), b.slice(6), context.parentById))
            siblingSharedEdges++;
    }
    for (const list of incident.values()) {
        const children = ordered(new Set(list.map(i => roles[i])
            .filter(r => r.startsWith('CHILD:')).map(r => r.slice(6))));
        if (children.some((a, i) => children.slice(i + 1).some(b =>
            forbiddenChildren(a, b, context.parentById)))) siblingSharedVertices++;
    }
    diagnostic.siblingSharedEdges = siblingSharedEdges;
    diagnostic.siblingSharedVertices = siblingSharedVertices;
    diagnostic.timingMs.graph = performance.now() - graphStart;
    if (siblingSharedEdges || siblingSharedVertices) return finish('forbidden-sibling-contact', {
        siblingSharedEdges, siblingSharedVertices });
    if (!diagnostic.junctions.length && !baseline.ok) return finish(baseline.reason,
        baseline.detail);

    const triangulationStart = performance.now();
    const vertices = [], triangles = [], vertexByPosition = new Map();
    const getVertex = (x, y) => {
        const id = pointId(x, y);
        if (!vertexByPosition.has(id)) {
            const vertex = { vertexId: `junction-v-${vertices.length}`, x, y,
                key: `${x}:${y}:constraint` };
            vertices.push(vertex); vertexByPosition.set(id, vertex);
        }
        return vertexByPosition.get(id);
    };
    let maxAspect = 0, warnings = 0;
    for (let i = 0; i < cells.length; i++) {
        const { x0, y0, x1, y1 } = cells[i].bounds;
        const face = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            .map(([x, y]) => getVertex(x, y));
        const ears = triangulate(face);
        if (!ears) return finish('triangle-quality-failure', { cell: cellId(cells[i]) });
        for (const triangle of ears) {
            const measure = quality(...triangle);
            maxAspect = Math.max(maxAspect, measure.aspect);
            if (measure.aspect > 10) warnings++;
            triangles.push(triangle.map(v => v.vertexId));
            diagnostic.faceRoles.push({ cell: cellId(cells[i]), role: roles[i] });
        }
    }
    if (vertices.length > RASTER_MESH_MAX_VERTICES)
        return finish('vertex-limit', { vertexCount: vertices.length });
    if (!triangles.length) return finish('invalid-constrained-polygon', { cause: 'no-faces' });
    diagnostic.quality = { maxAspect, warnings };
    diagnostic.timingMs.triangulation = performance.now() - triangulationStart;
    diagnostic.timingMs.total = performance.now() - started;
    const meshDefinition = { version: RASTER_MESH_SCHEMA_VERSION,
        meshId: 'neutral-junction-diagnostic-mesh', targetInternalLayerId: 'art',
        vertices: vertices.map(({ vertexId, x, y }) => ({ vertexId, x, y })), triangles };
    return { ok: true, meshDefinition,
        skinBinding: withFixedWeights(meshDefinition, context), diagnostic };
}
