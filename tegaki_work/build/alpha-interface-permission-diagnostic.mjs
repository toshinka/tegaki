// R-46D diagnostic only. Ownership is frozen before contact analysis.
import { performance } from 'node:perf_hooks';
import { alphaComponents, withFixedWeights } from './hybrid-domain-patch-diagnostic.mjs';
import { fixedLines, nearest, quality, triangulate }
    from './constrained-hybrid-topology-diagnostic.mjs';
import { RASTER_MESH_MAX_VERTICES, RASTER_MESH_SCHEMA_VERSION }
    from '../system/animation/raster-bone-skinning.js';

const H = 24;
const EPS = 1e-9;
const coord = (x, y) => `${x},${y}`;
const cellKey = (xi, yi) => `${xi},${yi}`;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const edgeLength = edge => distance({ x: edge.from[0], y: edge.from[1] },
    { x: edge.to[0], y: edge.to[1] });
const pairKey = (a, b) => [a, b].sort().join('|');

class MinHeap {
    values = [];
    push(item) {
        const values = this.values;
        values.push(item);
        for (let i = values.length - 1; i > 0;) {
            const parent = Math.floor((i - 1) / 2);
            if (values[parent].cost < item.cost - EPS
                || (Math.abs(values[parent].cost - item.cost) <= EPS
                    && values[parent].index <= item.index)) break;
            values[i] = values[parent]; values[parent] = item; i = parent;
        }
    }
    pop() {
        const values = this.values;
        const result = values[0], tail = values.pop();
        if (values.length) {
            let i = 0;
            while (i * 2 + 1 < values.length) {
                let child = i * 2 + 1;
                if (child + 1 < values.length
                    && (values[child + 1].cost < values[child].cost - EPS
                        || (Math.abs(values[child + 1].cost - values[child].cost) <= EPS
                            && values[child + 1].index < values[child].index))) child++;
                if (tail.cost < values[child].cost - EPS
                    || (Math.abs(tail.cost - values[child].cost) <= EPS
                        && tail.index <= values[child].index)) break;
                values[i] = values[child]; i = child;
            }
            values[i] = tail;
        }
        return result;
    }
    get size() { return this.values.length; }
}

function relationship(a, b, parents) {
    if (a === b) return 'SELF';
    if (parents.get(a) === b || parents.get(b) === a) return 'PARENT_CHILD';
    return 'SIBLING_OR_UNRELATED';
}

function lowestCommonAncestor(a, b, parents) {
    const ancestors = new Set();
    for (let id = a; id; id = parents.get(id)) ancestors.add(id);
    for (let id = b; id; id = parents.get(id)) if (ancestors.has(id)) return id;
    return null;
}

function componentsOfEdges(edges) {
    const incidence = new Map();
    for (let i = 0; i < edges.length; i++) {
        for (const endpoint of [edges[i].from, edges[i].to]) {
            const id = coord(...endpoint);
            if (!incidence.has(id)) incidence.set(id, []);
            incidence.get(id).push(i);
        }
    }
    const visited = new Set(), result = [];
    for (let i = 0; i < edges.length; i++) {
        if (visited.has(i)) continue;
        const group = [], queue = [i]; visited.add(i);
        for (let head = 0; head < queue.length; head++) {
            const index = queue[head]; group.push(edges[index]);
            for (const endpoint of [edges[index].from, edges[index].to]) {
                for (const next of incidence.get(coord(...endpoint))) {
                    if (!visited.has(next)) { visited.add(next); queue.push(next); }
                }
            }
        }
        result.push(group.sort((a, b) => a.id.localeCompare(b.id)));
    }
    return result.sort((a, b) => a[0].id.localeCompare(b[0].id));
}

function nearestAlphaDistances(snapshot, alpha, ownershipPixels, seed, pair) {
    const { width, height } = snapshot;
    const costs = new Float64Array(width * height).fill(Infinity);
    const heap = new MinHeap();
    let starts = 0;
    for (let index = 0; index < costs.length; index++) {
        if (alpha.labels[index] < 0 || !pair.has(ownershipPixels[index])) continue;
        const start = { x: index % width + 0.5, y: Math.floor(index / width) + 0.5 };
        const cost = distance(seed, start);
        if (cost > H + EPS) continue;
        costs[index] = cost;
        heap.push({ cost, index }); starts++;
    }
    while (heap.size) {
        const current = heap.pop();
        if (current.cost > costs[current.index] + EPS) continue;
        const x = current.index % width, y = Math.floor(current.index / width);
        for (const next of [x > 0 ? current.index - 1 : -1,
            y > 0 ? current.index - width : -1,
            y + 1 < height ? current.index + width : -1,
            x + 1 < width ? current.index + 1 : -1]) {
            if (next < 0 || alpha.labels[next] !== alpha.labels[current.index]
                || !pair.has(ownershipPixels[next])) continue;
            const cost = current.cost + 1;
            if (cost >= costs[next] - EPS) continue;
            costs[next] = cost;
            heap.push({ cost, index: next });
        }
    }
    return { costs, starts };
}

function costToEdge(edge, distances, width) {
    let best = Infinity;
    if (edge.from[0] === edge.to[0]) {
        const x = edge.from[0];
        for (let y = edge.from[1]; y < edge.to[1]; y++) {
            best = Math.min(best, distances[(y * width) + x - 1],
                distances[(y * width) + x]);
        }
    } else {
        const y = edge.from[1];
        for (let x = edge.from[0]; x < edge.to[0]; x++) {
            best = Math.min(best, distances[((y - 1) * width) + x],
                distances[(y * width) + x]);
        }
    }
    return best + 0.5;
}

function allowedCorridor(group, anchor, limit) {
    const adjacency = new Map();
    for (const edge of group) for (const endpoint of [edge.from, edge.to]) {
        const id = coord(...endpoint);
        if (!adjacency.has(id)) adjacency.set(id, []);
        adjacency.get(id).push(edge);
    }
    const costs = new Map([[anchor.id, 0]]), heap = new MinHeap();
    const indexed = new Map(group.map((edge, index) => [edge.id, index]));
    heap.push({ cost: 0, index: indexed.get(anchor.id) });
    while (heap.size) {
        const current = heap.pop();
        const edge = group[current.index];
        if (current.cost > costs.get(edge.id) + EPS) continue;
        for (const endpoint of [edge.from, edge.to]) {
            for (const next of adjacency.get(coord(...endpoint))) {
                const cost = current.cost + (edgeLength(edge) + edgeLength(next)) / 2;
                if (cost > limit + EPS || cost >= (costs.get(next.id) ?? Infinity) - EPS) continue;
                costs.set(next.id, cost);
                heap.push({ cost, index: indexed.get(next.id) });
            }
        }
    }
    return group.filter(edge => costs.has(edge.id)).map(edge => edge.id);
}

export function createAlphaInterfacePermissionTopology(asset, snapshot, rectangularSetup, context) {
    const started = performance.now();
    const diagnostic = { alpha: null, cells: [], ownershipBefore: [], ownershipAfter: [],
        ownershipUnchanged: false, frozenDomainCounts: {}, pairs: [],
        siblingContactCount: 0, componentCrossingCount: 0,
        missingAncestorDomains: [], graph: [], faceOwners: [],
        timingMs: { ownership: 0, extraction: 0, association: 0, graph: 0,
            triangulation: 0, total: 0 } };
    const finish = (reason, detail = {}) => {
        diagnostic.timingMs.total = performance.now() - started;
        return { ok: false, reason, detail, diagnostic };
    };
    if (!snapshot?.pixels || !rectangularSetup?.ok || !context?.ok) return finish('invalid-input');
    const alpha = alphaComponents(snapshot, 0);
    diagnostic.alpha = alpha;
    if (!alpha.components.length) return finish('invalid-input', { cause: 'empty-alpha' });
    if (alpha.components.length * 4 > RASTER_MESH_MAX_VERTICES) return finish('vertex-limit', {
        componentCount: alpha.components.length, minimumVertexCount: alpha.components.length * 4 });
    const [xs, ys] = fixedLines(snapshot, alpha.labels);
    const pixelNearest = new Array(snapshot.width * snapshot.height).fill(null);
    for (let index = 0; index < pixelNearest.length; index++) {
        if (alpha.labels[index] < 0) continue;
        pixelNearest[index] = nearest({ x: index % snapshot.width + 0.5,
            y: Math.floor(index / snapshot.width) + 0.5 }, context);
    }
    const cells = [], byGrid = new Map();
    const ownershipPixels = new Array(pixelNearest.length).fill(null);
    for (let yi = 0; yi < ys.length - 1; yi++) for (let xi = 0; xi < xs.length - 1; xi++) {
        const bounds = { x0: xs[xi], y0: ys[yi], x1: xs[xi + 1], y1: ys[yi + 1] };
        const sample = Math.floor((bounds.y0 + bounds.y1) / 2) * snapshot.width
            + Math.floor((bounds.x0 + bounds.x1) / 2);
        const component = alpha.labels[sample];
        if (component < 0) continue;
        const tally = new Map();
        for (let y = bounds.y0; y < bounds.y1; y++) for (let x = bounds.x0; x < bounds.x1; x++) {
            const id = pixelNearest[y * snapshot.width + x];
            tally.set(id, (tally.get(id) || 0) + 1);
        }
        const domain = [...tally].sort((a, b) => b[1] - a[1]
            || a[0].localeCompare(b[0]))[0][0];
        const cell = { xi, yi, component, bounds, domain };
        cells.push(cell); byGrid.set(cellKey(xi, yi), cell);
        for (let y = bounds.y0; y < bounds.y1; y++) for (let x = bounds.x0; x < bounds.x1; x++) {
            ownershipPixels[y * snapshot.width + x] = domain;
        }
    }
    diagnostic.cells = cells;
    diagnostic.ownershipBefore = cells.map(c => c.domain);
    diagnostic.frozenDomainCounts = Object.fromEntries([...new Set(diagnostic.ownershipBefore)]
        .sort().map(id => [id, diagnostic.ownershipBefore.filter(value => value === id).length]));
    diagnostic.timingMs.ownership = performance.now() - started;

    const interfaces = new Map(), graph = [], incident = new Map();
    const recordVertex = (x, y, cell) => {
        const id = coord(x, y);
        if (!incident.has(id)) incident.set(id, []);
        incident.get(id).push(cell);
    };
    for (const cell of cells) {
        const { x0, y0, x1, y1 } = cell.bounds;
        for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) recordVertex(x, y, cell);
        for (const [dx, dy, from, to] of [
            [1, 0, [x1, y0], [x1, y1]], [0, 1, [x0, y1], [x1, y1]]]) {
            const next = byGrid.get(cellKey(cell.xi + dx, cell.yi + dy));
            if (!next) continue;
            const edge = { id: `${coord(...from)}>${coord(...to)}`, from, to,
                componentId: cell.component, a: cell.domain, b: next.domain,
                relation: cell.component === next.component
                    ? relationship(cell.domain, next.domain, context.parentById)
                    : 'DIFFERENT_COMPONENT' };
            graph.push(edge);
            if (edge.relation !== 'PARENT_CHILD') continue;
            const pair = pairKey(edge.a, edge.b);
            const id = `${cell.component}|${pair}`;
            if (!interfaces.has(id)) interfaces.set(id, []);
            interfaces.get(id).push(edge);
        }
    }
    diagnostic.graph = graph;
    const grouped = [...interfaces].map(([id, edges]) => ({ id,
        components: componentsOfEdges(edges) })).sort((a, b) => a.id.localeCompare(b.id));
    diagnostic.timingMs.extraction = performance.now() - started - diagnostic.timingMs.ownership;

    const allowed = new Set(), parentChildren = [...context.parentById]
        .filter(([, parent]) => parent).sort((a, b) => a[0].localeCompare(b[0]));
    let contactFailure = null;
    for (const [childId, parentId] of parentChildren) {
        const child = context.segmentById.get(childId);
        const parent = context.segmentById.get(parentId);
        const childLength = distance(child.start, child.end);
        const parentLength = distance(parent.start, parent.end);
        const localLength = parentLength > EPS ? Math.min(parentLength, childLength) : childLength;
        const limit = 2 * H + 0.5 * localLength;
        const seed = { x: Math.floor(child.start.x) + 0.5,
            y: Math.floor(child.start.y) + 0.5 };
        const pair = new Set([parentId, childId]);
        const candidates = grouped.filter(item => item.id.endsWith(`|${pairKey(parentId, childId)}`));
        const row = { parentDomainId: parentId, childDomainId: childId, jointSeed: seed,
            limit, candidateInterfaceCount: candidates.reduce((sum, item) =>
                sum + item.components.length, 0), selectedInterfaceComponent: null,
            associationCost: null, selectedBoundaryLength: 0,
            unassociatedRemainingContactCount: 0, allowedSharedBoundary: [],
            failureReason: null };
        diagnostic.pairs.push(row);
        if (!candidates.length) continue;
        const { costs, starts } = nearestAlphaDistances(snapshot, alpha,
            ownershipPixels, seed, pair);
        const choices = [];
        for (const item of candidates) for (let i = 0; i < item.components.length; i++) {
            const edges = item.components[i];
            const scored = edges.map(edge => ({ edge,
                cost: costToEdge(edge, costs, snapshot.width) }))
                .sort((a, b) => a.cost - b.cost || a.edge.id.localeCompare(b.edge.id));
            choices.push({ id: `${item.id}#${i}`, group: edges,
                anchor: scored[0].edge, cost: scored[0].cost });
        }
        choices.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
        const winner = choices[0];
        if (!starts || !winner || !Number.isFinite(winner.cost)
            || winner.cost > limit + EPS) {
            row.failureReason = 'unassociated-interface';
            row.unassociatedRemainingContactCount = choices.reduce((sum, choice) =>
                sum + choice.group.length, 0);
            contactFailure ||= { reason: row.failureReason, childId, seed, limit,
                bestCost: winner?.cost ?? null, starts };
            continue;
        }
        if (choices.length > 1 && Math.abs(choices[1].cost - winner.cost) <= EPS) {
            row.failureReason = 'ambiguous-interface';
            contactFailure ||= { reason: row.failureReason, childId, seed, limit,
                tied: [winner.id, choices[1].id] };
            continue;
        }
        const selected = allowedCorridor(winner.group, winner.anchor, limit);
        row.selectedInterfaceComponent = winner.id;
        row.associationCost = winner.cost;
        row.allowedSharedBoundary = selected;
        row.selectedBoundaryLength = winner.group.filter(edge => selected.includes(edge.id))
            .reduce((sum, edge) => sum + edgeLength(edge), 0);
        row.unassociatedRemainingContactCount = choices.reduce((sum, choice) =>
            sum + choice.group.length, 0) - selected.length;
        for (const id of selected) allowed.add(id);
        if (row.unassociatedRemainingContactCount) {
            row.failureReason = 'unassociated-interface';
            contactFailure ||= { reason: row.failureReason, childId, seed, limit,
                remaining: row.unassociatedRemainingContactCount };
        }
    }
    diagnostic.timingMs.association = performance.now() - started
        - diagnostic.timingMs.ownership - diagnostic.timingMs.extraction;

    const domainByComponent = new Map();
    for (const cell of cells) {
        if (!domainByComponent.has(cell.component)) domainByComponent.set(cell.component, new Set());
        domainByComponent.get(cell.component).add(cell.domain);
    }
    const missing = new Set();
    for (const [component, domains] of domainByComponent) {
        const ids = [...domains].sort();
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
            if (relationship(ids[i], ids[j], context.parentById) !== 'SIBLING_OR_UNRELATED') continue;
            const ancestor = lowestCommonAncestor(ids[i], ids[j], context.parentById);
            if (ancestor && !domains.has(ancestor)) missing.add(`${component}|${ancestor}`);
        }
    }
    diagnostic.missingAncestorDomains = [...missing].sort().map(id => {
        const [component, domain] = id.split('|');
        return { component: Number(component), domain };
    });
    const forbidden = [];
    for (const edge of graph) {
        if (edge.relation === 'DIFFERENT_COMPONENT') diagnostic.componentCrossingCount++;
        if (edge.relation === 'SIBLING_OR_UNRELATED') {
            diagnostic.siblingContactCount++;
            forbidden.push({ kind: 'edge', id: edge.id, a: edge.a, b: edge.b });
        }
    }
    for (const [vertex, incidentCells] of incident) {
        const seen = new Set();
        for (let i = 0; i < incidentCells.length; i++)
            for (let j = i + 1; j < incidentCells.length; j++) {
                const a = incidentCells[i], b = incidentCells[j];
                if (a.domain === b.domain && a.component === b.component) continue;
                const id = `${vertex}|${pairKey(a.domain, b.domain)}`;
                if (seen.has(id)) continue;
                seen.add(id);
                if (a.component !== b.component) {
                    diagnostic.componentCrossingCount++;
                    forbidden.push({ kind: 'component-vertex', vertex, a: a.domain, b: b.domain });
                } else if (relationship(a.domain, b.domain, context.parentById)
                    === 'SIBLING_OR_UNRELATED') {
                    diagnostic.siblingContactCount++;
                    forbidden.push({ kind: 'sibling-vertex', vertex, a: a.domain, b: b.domain });
                }
            }
    }
    diagnostic.ownershipAfter = cells.map(c => c.domain);
    diagnostic.ownershipUnchanged = JSON.stringify(diagnostic.ownershipBefore)
        === JSON.stringify(diagnostic.ownershipAfter);
    diagnostic.timingMs.graph = performance.now() - started
        - diagnostic.timingMs.ownership - diagnostic.timingMs.extraction
        - diagnostic.timingMs.association;
    if (!diagnostic.ownershipUnchanged) return finish('invalid-domain-partition');
    if (contactFailure) return finish(contactFailure.reason, contactFailure);
    if (missing.size) return finish('missing-ancestor-domain', {
        domains: diagnostic.missingAncestorDomains,
        firstForbiddenContact: forbidden[0] || null });
    if (forbidden.length || diagnostic.componentCrossingCount) return finish('forbidden-domain-contact', {
        first: forbidden[0] || null, siblingContactCount: diagnostic.siblingContactCount,
        componentCrossingCount: diagnostic.componentCrossingCount });
    for (const edge of graph) {
        if (edge.relation === 'PARENT_CHILD' && !allowed.has(edge.id)) {
            return finish('unassociated-interface', { edge: edge.id, a: edge.a, b: edge.b });
        }
    }
    const vertices = [], triangles = [], vertexByPosition = new Map();
    const getVertex = (x, y) => {
        const id = coord(x, y);
        if (!vertexByPosition.has(id)) {
            const vertex = { vertexId: `interface-v-${vertices.length}`, x, y,
                key: `${x}:${y}:constraint` };
            vertexByPosition.set(id, vertex); vertices.push(vertex);
        }
        return vertexByPosition.get(id);
    };
    let maxAspect = 0, warnings = 0;
    for (const cell of cells) {
        const { x0, y0, x1, y1 } = cell.bounds;
        const face = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
            .map(([x, y]) => getVertex(x, y));
        const ears = triangulate(face);
        if (!ears) return finish('triangle-quality-failure', { cell: cellKey(cell.xi, cell.yi) });
        for (const triangle of ears) {
            const measure = quality(...triangle);
            maxAspect = Math.max(maxAspect, measure.aspect);
            if (measure.aspect > 10) warnings++;
            triangles.push(triangle.map(vertex => vertex.vertexId));
            diagnostic.faceOwners.push({ component: cell.component, domain: cell.domain,
                cell: cellKey(cell.xi, cell.yi) });
        }
    }
    if (vertices.length > RASTER_MESH_MAX_VERTICES) return finish('vertex-limit', {
        vertexCount: vertices.length, componentCount: alpha.components.length });
    if (!triangles.length) return finish('invalid-constrained-polygon', { cause: 'no-faces' });
    diagnostic.timingMs.triangulation = performance.now() - started
        - diagnostic.timingMs.ownership - diagnostic.timingMs.extraction
        - diagnostic.timingMs.association - diagnostic.timingMs.graph;
    diagnostic.timingMs.total = performance.now() - started;
    diagnostic.quality = { maxAspect, warnings };
    const meshDefinition = { version: RASTER_MESH_SCHEMA_VERSION,
        meshId: 'alpha-interface-diagnostic-mesh', targetInternalLayerId: 'art',
        vertices: vertices.map(({ vertexId, x, y }) => ({ vertexId, x, y })), triangles };
    return { ok: true, meshDefinition,
        skinBinding: withFixedWeights(meshDefinition, context), diagnostic };
}
