// R-47 diagnostic measurements. No production or persistent model mutation.
import { performance } from 'node:perf_hooks';
import { createAlphaInterfacePermissionTopology }
    from './alpha-interface-permission-diagnostic.mjs';
import { createNeutralJunctionTopology } from './neutral-junction-topology-diagnostic.mjs';

const H = 24, EPS = 1e-9;
const key = (x, y) => `${x},${y}`;
const cellKey = c => key(c.xi, c.yi);
const length = s => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
const neighbors = c => [key(c.xi - 1, c.yi), key(c.xi + 1, c.yi),
    key(c.xi, c.yi - 1), key(c.xi, c.yi + 1)];
const distance = (x, y, p) => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
const projection = (x, y, s) => {
    const dx = s.end.x - s.start.x, dy = s.end.y - s.start.y;
    return ((x + 0.5 - s.start.x) * dx + (y + 0.5 - s.start.y) * dy)
        / (dx * dx + dy * dy);
};

function groups(keys, nextKeys) {
    const pending = new Set(keys), result = [];
    while (pending.size) {
        const first = pending.values().next().value, queue = [first], group = [];
        pending.delete(first);
        for (let head = 0; head < queue.length; head++) {
            const value = queue[head]; group.push(value);
            for (const next of nextKeys(value)) if (pending.delete(next)) queue.push(next);
        }
        result.push(group);
    }
    return result;
}

function cellPixels(cell, snapshot) {
    const pixels = [];
    for (let y = cell.bounds.y0; y < cell.bounds.y1; y++)
        for (let x = cell.bounds.x0; x < cell.bounds.x1; x++)
            if (snapshot.pixels[(y * snapshot.width + x) * 4 + 3] > 0)
                pixels.push({ x, y, id: key(x, y) });
    return pixels;
}

export function inspectChildCore(asset, snapshot, product, context) {
    const start = performance.now();
    const baseline = createAlphaInterfacePermissionTopology(asset, snapshot, product, context);
    const current = createNeutralJunctionTopology(asset, snapshot, product, context);
    const cells = baseline.diagnostic.cells;
    const byKey = new Map(cells.map(c => [cellKey(c), c]));
    const candidate = new Set(current.diagnostic.junctions.flatMap(j => j.candidateCells));
    const children = [...context.parentById].filter(([, p]) => p)
        .map(([id]) => id).sort();
    const rows = [];
    let supportMs = 0, coreMs = 0;
    for (const child of children) {
        const segment = context.segmentById.get(child);
        if (!segment || length(segment) <= EPS) continue;
        const owned = cells.filter(c => c.domain === child);
        const ownedPixels = owned.flatMap(c => cellPixels(c, snapshot));
        const supportStart = performance.now();
        const ranked = ownedPixels.map(p => ({ ...p,
            distance: distance(p.x, p.y, segment.end) }))
            .sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
        const distalSeed = ranked[0] || null;
        supportMs += performance.now() - supportStart;
        const coreStart = performance.now();
        const axialPixels = ownedPixels.filter(p => projection(p.x, p.y, segment) >= 0.5 - EPS);
        const axialCells = owned.filter(c => cellPixels(c, snapshot).some(p =>
            projection(p.x, p.y, segment) >= 0.5 - EPS));
        const pixelSet = new Set(axialPixels.map(p => p.id));
        const axialComponents = groups(pixelSet, id => {
            const [x, y] = id.split(',').map(Number);
            return [key(x - 1, y), key(x + 1, y), key(x, y - 1), key(x, y + 1)];
        });
        const proximalInProtectedCells = axialCells.reduce((sum, c) => sum
            + cellPixels(c, snapshot).filter(p => projection(p.x, p.y, segment) < 0.5 - EPS).length, 0);
        const residual = owned.filter(c => !candidate.has(cellKey(c)));
        const residualKeys = new Set(residual.map(cellKey));
        const residualComponents = groups(residualKeys, id => neighbors(byKey.get(id)));
        const seedCell = distalSeed && owned.find(c => distalSeed.x >= c.bounds.x0
            && distalSeed.x < c.bounds.x1 && distalSeed.y >= c.bounds.y0
            && distalSeed.y < c.bounds.y1);
        const seedRepresented = !!seedCell && residualKeys.has(cellKey(seedCell));
        const residualPixels = residual.flatMap(c => cellPixels(c, snapshot));
        const residualPixelCount = residualPixels.length;
        const residualPixelGroups = groups(new Set(residualPixels.map(p => p.id)), id => {
            const [x, y] = id.split(',').map(Number);
            return [key(x - 1, y), key(x + 1, y), key(x, y - 1), key(x, y + 1)];
        });
        const seedPixelComponent = distalSeed && residualPixelGroups.find(group =>
            group.includes(distalSeed.id));
        // B is defined before comparison: 4-connected child-owned pixels within
        // one fixed h=24 Euclidean radius of the nearest tip support pixel.
        const boundedSet = new Set(ownedPixels.filter(p => distalSeed
            && Math.hypot(p.x - distalSeed.x, p.y - distalSeed.y) <= H + EPS)
            .map(p => p.id));
        const boundedComponent = distalSeed ? groups(boundedSet, id => {
            const [x, y] = id.split(',').map(Number);
            return [key(x - 1, y), key(x + 1, y), key(x, y - 1), key(x, y + 1)];
        }).find(group => group.includes(distalSeed.id)) || [] : [];
        const boundedPixelSet = new Set(boundedComponent);
        const boundedCells = owned.filter(c => cellPixels(c, snapshot).some(p =>
            boundedPixelSet.has(p.id)));
        coreMs += performance.now() - coreStart;
        rows.push({ child, base: segment.start, tip: segment.end,
            ownedPixels: ownedPixels.length, ownedCells: owned.length,
            distalSeed: distalSeed ? { x: distalSeed.x, y: distalSeed.y,
                distance: distalSeed.distance, cell: seedCell && cellKey(seedCell),
                plausible: distalSeed.distance <= H + EPS } : null,
            A: { protectedPixels: axialPixels.length, protectedCells: axialCells.length,
                ratio: ownedPixels.length ? axialPixels.length / ownedPixels.length : 0,
                components: axialComponents.length,
                reachesTip: !!distalSeed && pixelSet.has(distalSeed.id),
                proximalPixelsInProtectedCells: proximalInProtectedCells,
                collisionCells: axialCells.map(cellKey).filter(id => candidate.has(id)) },
            B: { protectedPixels: boundedComponent.length,
                protectedCells: boundedCells.length,
                collisionCells: boundedCells.map(cellKey).filter(id => candidate.has(id)) },
            C: { protectedPixels: distalSeed ? 1 : 0,
                protectedCells: seedCell ? 1 : 0,
                collisionCells: seedCell && candidate.has(cellKey(seedCell))
                    ? [cellKey(seedCell)] : [],
                remainingCells: residual.length, remainingAlpha: residualPixelCount,
                seedRepresented, residualComponents: residualComponents.length,
                residualPixelComponents: residualPixelGroups.length,
                tipConnectedToAllResidual: seedRepresented
                    && seedPixelComponent?.length === residualPixelCount } });
    }
    const conflicts = ['3,6', '10,6'].map(id => {
        const cell = byKey.get(id);
        if (!cell) return { cell: id, missing: true };
        const segment = context.segmentById.get(cell.domain);
        const root = context.segmentById.get(context.rootBoneId).start;
        const pixels = cellPixels(cell, snapshot);
        const projections = pixels.map(p => projection(p.x, p.y, segment));
        const ranges = point => {
            const values = pixels.map(p => distance(p.x, p.y, point));
            return [Math.min(...values), Math.max(...values)];
        };
        const residual = rows.find(row => row.child === cell.domain)?.C;
        return { cell: id, bounds: cell.bounds, alphaPixels: pixels.length,
            owner: cell.domain, initialRole: `CHILD:${cell.domain}`,
            candidateReason: current.diagnostic.junctions.some(j => j.seeds.includes(id))
                ? 'sibling-contact seed' : candidate.has(id) ? 'one-neighbor expansion' : 'not-candidate',
            projectionRange: [Math.min(...projections), Math.max(...projections)],
            distalPixels: projections.filter(t => t >= 0.5 - EPS).length,
            proximalPixels: projections.filter(t => t < 0.5 - EPS).length,
            baseDistanceRange: ranges(segment.start), tipDistanceRange: ranges(segment.end),
            rootDistanceRange: ranges(root),
            childNeighbors: neighbors(cell).filter(k => byKey.get(k)?.domain === cell.domain),
            removalResidualComponents: residual?.residualComponents,
            removalResidualPixelComponents: residual?.residualPixelComponents,
            removalTipRepresented: residual?.seedRepresented,
            removalTipConnected: residual?.tipConnectedToAllResidual };
    });
    return { fixture: snapshot.id, baselineOk: baseline.ok,
        R46F: { ok: current.ok, reason: current.reason || null,
            candidateCells: [...candidate].sort(), junctions: current.diagnostic.junctions },
        children: rows, conflicts,
        timingMs: { support: supportMs, core: coreMs, total: performance.now() - start } };
}
