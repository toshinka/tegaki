// R-52 diagnostic only. One frozen field across translation and rotation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { evaluateRasterBoneSkinning, validateRasterBoneSkinning,
    RASTER_MESH_MAX_INFLUENCES } from '../system/animation/raster-bone-skinning.js';
import { evaluateRigidBones } from '../system/animation/part-rig.js';
import { applyTransformMatrix, invertTransformMatrix,
    multiplyTransformMatrices } from '../system/transform-math.js';
import { ALPHA_FIT_GRID_GENERATOR, createRasterMeshSourceSignature }
    from '../system/animation/raster-bone-auto-setup.js';
import { createSkinWeightBrushPlan }
    from '../system/animation/skin-weight-brush.js';
import { fixtures, evaluateMode, motionClip, bindCoverage }
    from './verify-rig-hybrid-domain-patch.mjs';
import { degreesToRadians } from './verify-rig-canonical-geometry.mjs';
import { preparePoseAttribution, roleMetadata,
    gradients, overlapPixelCenters, summaryAtPose }
    from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights, HARMONIC_LENGTH_EPSILON }
    from './junction-harmonic-weight-diagnostic.mjs';

const solverPath = fileURLToPath(new URL('./junction-pose-envelope-nlp.py', import.meta.url));
const lpPath = fileURLToPath(new URL('./junction-pose-feasibility-lp.py', import.meta.url));
const hashes = {
    'disconnected-islands': '2eda38c39b4e42f298a1e1bdca46d73aa65eb0c14c7609b2bbbf2eb4fbf86136',
    'connected-humanoid': 'cff2fc82bbf1e9efefe901ac60150760fc10f9e491fb42bc7ebbcc0e9ce325e9',
    'simple-chain': '2c9a21ed8573fb545bd19ea49b062ddfec7c90994101be9a38e0e5a1f5c20fe1',
    'branched-skeleton': '50dd7032f8a1e3ce2c7bf0b00e88508dc4e5311d562678fda5a7f84d41027eb3'
};
const round = n => Number.isFinite(n) ? Number(n.toFixed(8)) : n;
const area2 = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const percentile = (a, f) => a.length ? round([...a].sort((x, y) => x - y)
    [Math.ceil(f * (a.length - 1))]) : null;
const stats = a => ({ min: percentile(a, 0), p10: percentile(a, .1),
    median: percentile(a, .5), p90: percentile(a, .9), max: percentile(a, 1) });
const hash = p => createHash('sha256').update(JSON.stringify({
    vertices: p.mesh.vertices, triangles: p.mesh.triangles,
    geometryRoles: p.topology.diagnostic.geometryRoles,
    faceRoles: p.topology.diagnostic.faceRoles,
    interfaces: p.topology.diagnostic.interfaces.map(i => ({ parent: i.parent,
        child: i.child, component: i.component, boundaryIds: i.boundaryIds }))
})).digest('hex');
const weight = (skin, id, bone) => {
    const row = skin.vertexWeights.find(v => v.vertexId === id);
    const total = row.influences.reduce((s, v) => s + v.weight, 0);
    return (row.influences.find(v => v.boneId === bone)?.weight || 0) / total;
};
const meshAsset = (p, skin) => ({ ...p.asset, meshDefinitions: [p.mesh], skinBindings: [skin] });
function posed(p, skin, clip) {
    const result = evaluateRasterBoneSkinning(meshAsset(p, skin), clip, 0);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    return result.resultByMeshId.get(p.mesh.meshId);
}
function systemFor(p, W2) {
    const byId = new Map(p.mesh.vertices.map(v => [v.vertexId, v]));
    const byCoord = new Map(p.mesh.vertices.map(v => [`${v.x},${v.y}`, v.vertexId]));
    const active = new Map(), boundary = new Map();
    for (const junction of W2.junctions) {
        const ids = new Set(p.mesh.triangles.flatMap((tri, i) =>
            p.topology.diagnostic.faceRoles[i].role === `JUNCTION:${junction.ancestor}`
                ? tri : []));
        for (const id of ids) { assert.ok(!active.has(id)); active.set(id, junction); }
        for (const row of p.topology.diagnostic.interfaces.filter(item =>
            item.parent === junction.ancestor && item.component ===
                p.topology.diagnostic.junctions.find(j =>
                    j.ancestor === junction.ancestor).component))
            for (const edge of row.boundaryIds)
                for (const point of edge.split('>')) {
                    const id = byCoord.get(point);
                    assert.ok(ids.has(id));
                    if (boundary.has(id)) assert.equal(boundary.get(id), row.child);
                    boundary.set(id, row.child);
                }
    }
    const variables = [], vertices = [], index = new Map();
    for (const vertex of p.mesh.vertices) {
        const junction = active.get(vertex.vertexId);
        if (!junction) continue;
        assert.ok(junction.children.length <= RASTER_MESH_MAX_INFLUENCES);
        const indices = [];
        for (const boneId of junction.children) {
            const i = variables.length;
            variables.push({ vertexId: vertex.vertexId, boneId,
                w2: weight(W2.skinBinding, vertex.vertexId, boneId),
                fixed: boundary.has(vertex.vertexId)
                    ? Number(boundary.get(vertex.vertexId) === boneId) : null });
            index.set(`${vertex.vertexId}|${boneId}`, i); indices.push(i);
        }
        vertices.push({ id: vertex.vertexId, indices, x: vertex.x, y: vertex.y });
    }
    const triangles = [];
    for (const [id, tri] of p.mesh.triangles.entries()) {
        if (!p.topology.diagnostic.faceRoles[id].role.startsWith('JUNCTION:')
            || !['visible-supporting', 'mixed'].includes(p.coverage.support[id])) continue;
        const points = tri.map(key => byId.get(key));
        const bind = area2(...points);
        assert.ok(bind > 0);
        const d = { x: 60, y: 0 }, cross = (u, v) => u.x * v.y - u.y * v.x;
        const u = { x: points[1].x - points[0].x, y: points[1].y - points[0].y };
        const v = { x: points[2].x - points[0].x, y: points[2].y - points[0].y };
        const dv = cross(d, v), ud = cross(u, d), coeff = [-dv - ud, dv, ud];
        let constant = bind; const entries = [];
        tri.forEach((vertexId, k) => {
            const at = index.get(`${vertexId}|${p.fixture.movingBoneId}`);
            if (at === undefined) constant += coeff[k] * weight(W2.skinBinding,
                vertexId, p.fixture.movingBoneId);
            else entries.push([at, coeff[k]]);
        });
        triangles.push({ id, bind, constant, coefficients: entries });
    }
    const dominance = [];
    for (const [id, own] of boundary) {
        const ownIndex = index.get(`${id}|${own}`);
        for (const sibling of active.get(id).children.filter(b => b !== own))
            dominance.push([ownIndex, index.get(`${id}|${sibling}`)]);
    }
    return { variables, vertices, triangles, active, boundary, dominance, index };
}
function lpSoft(system) {
    const result = spawnSync('python', [lpPath], { encoding: 'utf8',
        input: JSON.stringify({ variables: system.variables, vertices: system.vertices,
            triangles: system.triangles, mode: 'soft' }), maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true, `${parsed.stage}: ${parsed.message}`);
    return parsed;
}
function skinFrom(p, W2, system, values) {
    assert.equal(values.length, system.variables.length);
    const byVertex = new Map(); let maxRawViolation = 0;
    values.forEach((raw, i) => {
        const variable = system.variables[i];
        assert.ok(Number.isFinite(raw));
        maxRawViolation = Math.max(maxRawViolation, -raw, raw - 1);
        if (!byVertex.has(variable.vertexId)) byVertex.set(variable.vertexId, []);
        byVertex.get(variable.vertexId).push({ boneId: variable.boneId, weight: raw });
    });
    assert.ok(maxRawViolation < 1e-7);
    const skin = { ...W2.skinBinding, vertexWeights: W2.skinBinding.vertexWeights.map(row => {
        if (!byVertex.has(row.vertexId)) return row;
        const raw = byVertex.get(row.vertexId), sum = raw.reduce((s, v) => s + v.weight, 0);
        assert.ok(Math.abs(sum - 1) < 1e-7);
        return { vertexId: row.vertexId, influences: raw.map(v => ({
            boneId: v.boneId, weight: Math.max(0, Math.min(1, v.weight)) / sum }))
            .filter(v => v.weight > 0) };
    }) };
    const valid = validateRasterBoneSkinning([p.mesh], [skin],
        p.asset.internalLayers, p.asset.rigDefinition);
    assert.equal(valid.ok, true, JSON.stringify(valid.errors));
    for (const row of skin.vertexWeights) {
        assert.ok(row.influences.length <= RASTER_MESH_MAX_INFLUENCES);
        if (!system.active.has(row.vertexId)) assert.deepEqual(row,
            p.modes.W1.vertexWeights.find(v => v.vertexId === row.vertexId));
    }
    for (const [id, own] of system.boundary)
        for (const child of system.active.get(id).children)
            assert.ok(weight(skin, id, own) + 1e-7 >= weight(skin, id, child));
    return { skin, maxRawViolation };
}

function poseDelta(p, W2, kind, magnitude) {
    const clip = motionClip(p.fixture.movingBoneId, kind === 'translation'
        ? { x: magnitude } : { rotation: degreesToRadians(magnitude) });
    const asset = meshAsset(p, W2.skinBinding);
    const bind = evaluateRigidBones(asset, null, 0);
    const current = evaluateRigidBones(asset, clip, 0);
    assert.equal(bind.ok, true); assert.equal(current.ok, true);
    const moving = p.fixture.movingBoneId;
    // All non-target direct children must have identity movement here.
    for (const bone of p.asset.rigDefinition.bones) {
        if (bone.boneId === moving) continue;
        const before = bind.poseByBoneId.get(bone.boneId).worldMatrix;
        const after = current.poseByBoneId.get(bone.boneId).worldMatrix;
        assert.ok(['a','b','c','d','tx','ty'].every(key =>
            Math.abs(before[key] - after[key]) < 1e-8),
            `${p.fixture.id}: moving descendant invalidates one-target model`);
    }
    const before = bind.poseByBoneId.get(moving).worldMatrix;
    const after = current.poseByBoneId.get(moving).worldMatrix;
    const matrix = multiplyTransformMatrices(after, invertTransformMatrix(before));
    return p.mesh.vertices.map(v => {
        const q = applyTransformMatrix(matrix, v.x, v.y);
        return [q.x - v.x, q.y - v.y];
    });
}
function modelPayload(p, W2, system, soft, angles) {
    const vertexIndex = new Map(p.mesh.vertices.map((v, i) => [v.vertexId, i]));
    const triangleVertices = system.triangles.map(row =>
        p.mesh.triangles[row.id].map(id => vertexIndex.get(id)));
    const targetIndex = p.mesh.vertices.map(v => system.index.get(
        `${v.vertexId}|${p.fixture.movingBoneId}`) ?? -1);
    const fixedTarget = p.mesh.vertices.map(v => weight(W2.skinBinding,
        v.vertexId, p.fixture.movingBoneId));
    const poses = [{ name: 'translation:60', delta: poseDelta(p, W2, 'translation', 60) },
        ...angles.map(a => ({ name: `rotation:${a}`,
            delta: poseDelta(p, W2, 'rotation', a) }))];
    const W2Weights = system.variables.map(v => v.w2);
    const starts = [{ name: 'W2', weights: W2Weights },
        { name: 'SBW', weights: soft.SBW },
        { name: 'F1', weights: soft.F1Weights },
        { name: 'midpoint', weights: W2Weights.map((v, i) =>
            (v + soft.SBW[i]) / 2) }];
    return { variables: system.variables, vertices: system.vertices,
        dominance: system.dominance, base: p.mesh.vertices.map(v => [v.x, v.y]),
        triangleVertices, bind: system.triangles.map(v => v.bind),
        targetIndex, fixedTarget, poses, starts };
}
function predictedVertices(payload, weights, pose) {
    return payload.base.map(([x, y], i) => {
        const w = payload.targetIndex[i] >= 0 ? weights[payload.targetIndex[i]]
            : payload.fixedTarget[i];
        return { x: x + w * pose.delta[i][0], y: y + w * pose.delta[i][1] };
    });
}
function verifyRotationModel(p, W2, system, payload, values, label) {
    const skin = skinFrom(p, W2, system, values).skin;
    let vertexError = 0, areaError = 0;
    for (const pose of payload.poses) {
        const [kind, mag] = pose.name.split(':');
        const clip = motionClip(p.fixture.movingBoneId, kind === 'translation'
            ? { x: Number(mag) } : { rotation: degreesToRadians(Number(mag)) });
        const runtime = new Map(posed(p, skin, clip).vertices.map(v => [v.vertexId, v]));
        const predicted = predictedVertices(payload, values, pose);
        for (const [i, v] of p.mesh.vertices.entries()) {
            const r = runtime.get(v.vertexId);
            vertexError = Math.max(vertexError,
                Math.hypot(predicted[i].x - r.x, predicted[i].y - r.y));
        }
        for (const tri of payload.triangleVertices) {
            const ids = tri.map(i => p.mesh.vertices[i].vertexId);
            areaError = Math.max(areaError, Math.abs(area2(...tri.map(i => predicted[i]))
                - area2(...ids.map(id => runtime.get(id)))));
        }
    }
    assert.ok(vertexError < 1e-7 && areaError < 1e-7,
        `${p.fixture.id} ${label}: model/runtime parity ${vertexError}, ${areaError}`);
    return { vertexError, areaError };
}
function solve(payload) {
    const result = spawnSync('python', [solverPath], { encoding: 'utf8',
        input: JSON.stringify(payload), maxBuffer: 20 * 1024 * 1024,
        timeout: 180000 });
    assert.equal(result.status, 0, result.stderr || `solver exit ${result.status}`);
    return JSON.parse(result.stdout);
}
function sweep(p, skin, system, step = .5) {
    let minimum = { area: Infinity, ratio: Infinity, angle: null, id: null };
    let allMinimum = { area: Infinity, ratio: Infinity, angle: null, id: null };
    const failures = [], allFailures = [], samples = [];
    const relevant = p.mesh.triangles.map((tri,id) => ({id,tri,
        bind:area2(...tri.map(v=>p.mesh.vertices.find(x=>x.vertexId===v)))}))
        .filter(v=>['visible-supporting','mixed'].includes(p.coverage.support[v.id]));
    for (let i = 0; i <= Math.round(45 / step); i++) {
        const angle = Math.min(45, i * step);
        const clip = motionClip(p.fixture.movingBoneId,
            { rotation: degreesToRadians(angle) });
        const nodes = new Map(posed(p, skin, clip).vertices.map(v => [v.vertexId, v]));
        for (const row of system.triangles) {
            const area = area2(...p.mesh.triangles[row.id].map(id => nodes.get(id)));
            const ratio = area / row.bind;
            if (ratio < minimum.ratio) minimum = { area, ratio, angle, id: row.id };
            if (area <= 1e-8) failures.push({ angle, id: row.id, area });
            if ([29, 30].includes(row.id)) samples.push({ angle, id: row.id, area });
        }
        for (const row of relevant) {
            const area=area2(...row.tri.map(id=>nodes.get(id)));
            const ratio=area/row.bind;
            if (ratio<allMinimum.ratio) allMinimum={area,ratio,angle,id:row.id};
            if (area<=1e-8) allFailures.push({angle,id:row.id,area});
        }
    }
    // Refine around the closest-to-zero observed angle at 0.05 degrees.
    const refinement=[];
    if (allMinimum.ratio < 1e-4) {
        const lo=Math.max(0,allMinimum.angle-.5),hi=Math.min(45,allMinimum.angle+.5);
        for (let angle=lo;angle<=hi+1e-9;angle+=.05) {
            const clip=motionClip(p.fixture.movingBoneId,
                {rotation:degreesToRadians(angle)});
            const nodes=new Map(posed(p,skin,clip).vertices.map(v=>[v.vertexId,v]));
            const row=relevant.find(v=>v.id===allMinimum.id);
            const area=area2(...row.tri.map(id=>nodes.get(id)));
            refinement.push({angle:round(angle),area});
            if (area<=1e-8) allFailures.push({angle,id:row.id,area});
        }
    }
    return { minimum, failures, allMinimum, allFailures, samples, step,refinement };
}
function summarizeBoundary(p, system, skin) {
    const rows = [...system.boundary].map(([id, own]) => {
        const vertex = p.mesh.vertices.find(v => v.vertexId === id);
        const siblings = system.active.get(id).children.filter(child => child !== own);
        return { id, x: vertex.x, y: vertex.y, child: own,
            own: weight(skin, id, own),
            siblingMax: Math.max(...siblings.map(b => weight(skin, id, b))) };
    });
    const own = rows.map(v => v.own);
    return { count: rows.length, deltaMax: round(Math.max(...own.map(v => 1-v))),
        own: stats(own), siblingMax: round(Math.max(...rows.map(v => v.siblingMax))),
        rows: rows.filter(v => v.own < .999999).map(v => ({ ...v,
            own: round(v.own), siblingMax: round(v.siblingMax) })) };
}
function energy(p, skin) {
    const nodes = new Map(p.mesh.vertices.map(v => [v.vertexId, v]));
    const edges = new Map();
    p.mesh.triangles.forEach((tri, i) => {
        if (!p.topology.diagnostic.faceRoles[i].role.startsWith('JUNCTION:')) return;
        for (const [a, b] of [[tri[0],tri[1]], [tri[1],tri[2]], [tri[2],tri[0]]])
            edges.set([a,b].sort().join('|'), [a,b]);
    });
    let sum = 0;
    for (const [a, b] of edges.values()) {
        const va = nodes.get(a), vb = nodes.get(b);
        const conductance = 1 / Math.max(Math.hypot(va.x-vb.x, va.y-vb.y),
            HARMONIC_LENGTH_EPSILON);
        const ids = new Set([p.modes.W1, skin].flatMap(s => [a,b].flatMap(id =>
            s.vertexWeights.find(v => v.vertexId === id).influences.map(v => v.boneId))));
        for (const id of ids) sum += .5 * conductance *
            (weight(skin,a,id)-weight(skin,b,id))**2;
    }
    return round(sum);
}
function changeMap(p, system, skin, reference) {
    const rows = system.vertices.map(v => {
        const differences = system.active.get(v.id).children.map(b =>
            Math.abs(weight(skin,v.id,b)-weight(reference,v.id,b)));
        const coordinate = p.mesh.vertices.find(x => x.vertexId === v.id);
        const nearby = [29,30,31,33,35,37,39,41].filter(id =>
            p.mesh.triangles[id]?.includes(v.id));
        return { id: v.id, x: coordinate.x, y: coordinate.y,
            role: system.boundary.has(v.id) ? 'interface' : 'Junction interior',
            child: system.boundary.get(v.id) || null,
            maxDifference: Math.max(...differences), nearby };
    });
    return { counts: Object.fromEntries([.01,.05,.1,.25].map(t => [t,
        rows.filter(v => v.maxDifference > t).length])),
    vertices: rows.filter(v => v.maxDifference > .01).map(v => ({ ...v,
        maxDifference: round(v.maxDifference) })) };
}
function trianglePacket(p, system, modes, sweeps) {
    const tracked = [29,30], obstruction = [31,33,35,37,39,41];
    const out = {};
    for (const id of [...tracked,...obstruction]) {
        const tri = p.mesh.triangles[id];
        out[id] = {};
        for (const [name, skin] of Object.entries(modes)) {
            if (!skin) continue;
            const kind = tracked.includes(id) ? 'rotation' : 'translation';
            const magnitude = tracked.includes(id) ? 45 : 60;
            const clip = motionClip(p.fixture.movingBoneId, kind === 'rotation'
                ? { rotation: degreesToRadians(magnitude) } : { x: magnitude });
            const map = new Map(posed(p, skin, clip).vertices.map(v => [v.vertexId,v]));
            out[id][name] = { area: area2(...tri.map(v => map.get(v))),
                weights: tracked.includes(id) ? tri.map(vertexId => ({ vertexId,
                    influences: skin.vertexWeights.find(v => v.vertexId === vertexId).influences }))
                    : undefined,
                sweep: tracked.includes(id) && sweeps[name]
                    ? [...sweeps[name].samples].filter(v => v.id === id)
                        .sort((a,b) => a.area-b.area)[0] : undefined };
        }
    }
    return out;
}
function rootAndBrush(p, skin, system) {
    const root = motionClip(p.fixture.rootBoneId, { x: 20 });
    const nodes = new Map(posed(p, skin, root).vertices.map(v => [v.vertexId,v]));
    const coordinateError = Math.max(...p.mesh.vertices.flatMap(v => [
        Math.abs(nodes.get(v.vertexId).x-v.x-20), Math.abs(nodes.get(v.vertexId).y-v.y)]));
    const raster = evaluateMode(p.fixture,p.snapshot,p.asset,
        { meshDefinition:p.mesh, skinBinding:skin },root,p.coverage,p.context.gridDiagonal);
    assert.equal(raster.valid,true);
    assert.ok(coordinateError < 1e-7);
    const choice = system.vertices.find(v => {
        const target = weight(skin,v.id,p.fixture.movingBoneId);
        return target > .05 && target < .95;
    });
    assert.ok(choice);
    const asset = { ...meshAsset(p,skin), meshDefinitions:[{ ...p.mesh,
        generator:{type:ALPHA_FIT_GRID_GENERATOR,
            source:createRasterMeshSourceSignature(p.snapshot)} }] };
    const before = JSON.stringify(asset);
    const plan = createSkinWeightBrushPlan(asset,'art',p.fixture.movingBoneId,
        [{vertexId:choice.id,delta:.01}]);
    assert.equal(plan.ok,true,JSON.stringify(plan)); assert.equal(plan.changed,true);
    assert.equal(JSON.stringify(asset),before);
    return { root:{coordinateError,alpha:raster.alphaRaster.alphaAreaRatio,
        inversion:raster.quality.visibleInverted},brush:{ok:true,vertexId:choice.id} };
}
function modeMetrics(p, skin, name, system) {
    const metadata = roleMetadata(p.mesh,p.topology.diagnostic);
    const canonical = [];
    for (const kind of ['translation','rotation'])
        for (const magnitude of [5,15,30,kind === 'translation' ? 60 : 45]) {
            const pose = summaryAtPose(p,skin,metadata,kind,magnitude);
            const junction = pose.byRole['JUNCTION:root'];
            const overlap = pose.overlap || (kind === 'rotation' && magnitude === 45
                ? overlapPixelCenters(pose.posed) : null);
            canonical.push({kind,magnitude,visibleInversion:pose.raster.visibleInversion,
                targetDisplacement:pose.raster.targetDisplacement,
                targetAlpha:pose.raster.targetAlpha,wholeAlpha:pose.raster.alphaTotal,
                remote:pose.raster.remote,junction,overlap});
        }
    const gradientsByRole = gradients(metadata,skin,p.fixture.movingBoneId);
    return {canonical,gradients:gradientsByRole,energy:energy(p,skin)};
}
function marginMap(p,system,skin,angles) {
    const rows = [];
    for (const [kind,mags] of [['translation',[60]],['rotation',angles]])
        for (const magnitude of mags) {
            const clip = motionClip(p.fixture.movingBoneId,kind === 'translation'
                ? {x:magnitude}:{rotation:degreesToRadians(magnitude)});
            const map = new Map(posed(p,skin,clip).vertices.map(v => [v.vertexId,v]));
            for (const row of system.triangles) {
                const ratio = area2(...p.mesh.triangles[row.id].map(id => map.get(id)))
                    / row.bind;
                rows.push({triangleId:row.id,role:p.topology.diagnostic.faceRoles[row.id].role,
                    kind,magnitude,ratio});
            }
        }
    rows.sort((a,b) => a.ratio-b.ratio || a.triangleId-b.triangleId
        || a.magnitude-b.magnitude);
    const minimum = rows[0];
    return {minimum,nearActive:rows.filter(v => v.ratio-minimum.ratio < 1e-5)
        .slice(0,20),nearActiveTotal:rows.filter(v => v.ratio-minimum.ratio < 1e-5).length};
}
function shortSolver(result) {
    return {constructionMs:result.constructionMs,selectedStart:result.selectedStart,
        starts:result.starts.map(({weights,...v}) => v),
        selected:result.selected ? (({weights,...v}) => v)(result.selected) : null,
        p2:result.p2 ? (({weights,...v}) => v)(result.p2) : null};
}
function runPrimary(p,W2,system,soft) {
    const constructed = performance.now();
    let angles = [5,15,30,45];
    let payload = modelPayload(p,W2,system,soft,angles);
    const modelConstructionMs = performance.now()-constructed;
    const parity = Object.fromEntries([['W2',payload.starts[0].weights],
        ['SBW',soft.SBW]].map(([name,v]) => [name,
        verifyRotationModel(p,W2,system,payload,v,name)]));
    const solveStart = performance.now();
    const passes = [];
    let selected = null, final = null, sweepResult = null;
    for (let cutting=0;cutting<=2;cutting++) {
        // P2 only after the final angle set is known.
        const result = solve({...payload,runP2:false});
        passes.push(shortSolver(result));
        if (!result.selected || result.selected.margin <= 0) break;
        selected = result.selected;
        const skin = skinFrom(p,W2,system,selected.weights).skin;
        sweepResult = sweep(p,skin,system);
        if (!sweepResult.failures.length) { final = result; break; }
        if (cutting === 2) break;
        const earliest = sweepResult.failures[0].angle;
        angles = [...new Set([...angles,earliest])].sort((a,b)=>a-b);
        payload = modelPayload(p,W2,system,soft,angles);
        payload.starts = [{name:'W2',weights:payload.starts[0].weights},
            {name:'SBW',weights:soft.SBW},
            {name:'F1',weights:soft.F1Weights},
            {name:'midpoint',weights:payload.starts[3].weights}];
    }
    let p2 = null;
    if (final) {
        // Reuse the same deterministic starts and final constraints for P2.
        const p2Payload = {...payload,starts:[],preselected:selected.weights,
            runP2:true};
        p2 = solve(p2Payload).p2;
    }
    return {angles,parity,modelConstructionMs,solveMs:performance.now()-solveStart,
        passes,selected,final,p2,sweep:sweepResult};
}

if (process.argv[1]?.endsWith('verify-rig-pose-envelope-feasibility.mjs')) {
const report = [];
for (const fixture of fixtures) {
    const p = preparePoseAttribution(fixture);
    assert.equal(hash(p),hashes[fixture.id]);
    const W2 = createJunctionHarmonicWeights(p.topology,p.context);
    assert.equal(W2.ok,true);
    if (!W2.junctions.length) {
        assert.deepEqual(W2.skinBinding,p.modes.W1);
        report.push({fixture:fixture.id,control:'W2 == W1; no optimization'});
        continue;
    }
    assert.deepEqual([p.coverage.uncovered,p.coverage.multiple],[0,0]);
    assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],
        fixture.id === 'branched-skeleton' ? [61,80] : [91,132]);
    const system = systemFor(p,W2), soft = lpSoft(system);
    assert.ok(Math.abs(soft.mSoft - (fixture.id === 'branched-skeleton'
        ? 1.1041666667 : 1.652173913)) < 1e-6);
    const SBW = skinFrom(p,W2,system,soft.SBW).skin;
    p.modes.W2=W2.skinBinding; p.modes.SBW=SBW;
    const baseline = fixture.id === 'branched-skeleton' ? {
        W2:modeMetrics(p,W2.skinBinding,'W2',system),
        SBW:modeMetrics(p,SBW,'SBW',system) } : null;
    const primary = runPrimary(p,W2,system,soft);
    const repeated = runPrimary(p,W2,system,soft);
    assert.equal(Boolean(primary.final),Boolean(repeated.final));
    assert.equal(primary.passes.at(-1).selectedStart,
        repeated.passes.at(-1).selectedStart);
    const repeatDifference = primary.selected && repeated.selected
        ? Math.max(...primary.selected.weights.map((v,i)=>
            Math.abs(v-repeated.selected.weights[i]))) : null;
    if (repeatDifference !== null) assert.ok(repeatDifference < 1e-7);
    const p2RepeatDifference = primary.p2?.weights && repeated.p2?.weights
        ? Math.max(...primary.p2.weights.map((v,i)=>
            Math.abs(v-repeated.p2.weights[i]))) : null;
    if (p2RepeatDifference !== null) assert.ok(p2RepeatDifference < 1e-7);
    const row = {fixture:fixture.id,
        topology:{vertices:p.mesh.vertices.length,triangles:p.mesh.triangles.length,
            fingerprint:hashes[fixture.id]},
        modelParity:primary.parity,translationF1Margin:soft.mSoft,
        deltaMin:soft.deltaMin,solver:primary.passes,
        determinism:{selectedStart:primary.passes.at(-1).selectedStart,
            maxWeightDifference:repeatDifference,
            p2MaxWeightDifference:p2RepeatDifference},
        cuttingAngles:primary.angles,cuttingPasses:primary.passes.length-1,
        timingMs:{modelConstruction:primary.modelConstructionMs,
            nonlinear:primary.solveMs},classification:'SEARCH INCONCLUSIVE'};
    if (baseline) row.baseline=baseline;
    if (!primary.final) {
        row.bestSweep=primary.sweep ? {minimum:primary.sweep.minimum,
            failureCount:primary.sweep.failures.length,
            firstFailure:primary.sweep.failures[0]} : null;
        report.push(row); continue;
    }
    const PEW = skinFrom(p,W2,system,primary.selected.weights);
    p.modes.PEW=PEW.skin;
    const validationStart=performance.now();
    const parity = verifyRotationModel(p,W2,system,
        modelPayload(p,W2,system,soft,primary.angles),primary.selected.weights,'PEW');
    const modes = {W2:W2.skinBinding,SBW,PEW:PEW.skin};
    if (primary.p2?.feasible) {
        const minSkin=skinFrom(p,W2,system,primary.p2.weights).skin;
        p.modes.PEWmin=minSkin; modes.PEWmin=minSkin;
    }
    const modeOutput = Object.fromEntries(Object.entries(modes).map(([name,skin]) =>
        [name,modeMetrics(p,skin,name,system)]));
    const sweeps=Object.fromEntries(Object.entries(modes).map(([name,skin]) =>
        [name,sweep(p,skin,system)]));
    const baselineCoverage=bindCoverage(p.snapshot,p.product.meshDefinition);
    const productionBaseline=Object.fromEntries(['translation','rotation'].map(kind => {
        const clip=motionClip(fixture.movingBoneId,kind==='translation'
            ? {x:60}:{rotation:degreesToRadians(45)});
        const result=evaluateMode(fixture,p.snapshot,p.asset,p.product,clip,
            baselineCoverage,p.context.gridDiagonal);
        assert.equal(result.valid,true);
        return [kind,result.regions[fixture.movingBoneId].displacement];
    }));
    const quality={};
    for (const name of ['PEW','PEWmin'].filter(n=>modes[n])) {
        const canonical=modeOutput[name].canonical;
        const t=canonical.find(v=>v.kind==='translation'&&v.magnitude===60);
        const r=canonical.find(v=>v.kind==='rotation'&&v.magnitude===45);
        quality[name]={translationRetention:t.targetDisplacement/
                productionBaseline.translation,
            rotationRetention:r.targetDisplacement/productionBaseline.rotation,
            targetAlphaTranslation:t.targetAlpha,targetAlphaRotation:r.targetAlpha,
            wholeAlphaTranslation:t.wholeAlpha,wholeAlphaRotation:r.wholeAlpha,
            sweepMinimum:sweeps[name].minimum,
            sweepFailureCount:sweeps[name].failures.length,
            fullSweepMinimum:sweeps[name].allMinimum,
            fullSweepFailureCount:sweeps[name].allFailures.length,
            canonicalVisibleInversion:canonical.reduce((s,v)=>s+v.visibleInversion,0)};
    }
    const witness=quality.PEW;
    const orientationPass=witness.fullSweepFailureCount===0
        && witness.canonicalVisibleInversion===0;
    const qualityPass=witness.translationRetention>=.85
        && witness.rotationRetention>=.85
        && [witness.targetAlphaTranslation,witness.targetAlphaRotation]
            .every(v=>v>=.85&&v<=1.15);
    row.classification=orientationPass ? qualityPass ? 'A' : 'B' : 'C';
    if (witness.sweepMinimum.ratio<1e-4 && orientationPass) row.classification='C';
    if (!orientationPass && quality.PEWmin
        && quality.PEWmin.fullSweepFailureCount===0
        && quality.PEWmin.canonicalVisibleInversion===0)
        row.classification='B';
    row.runtime={parity,quality,poses:modeOutput,
        sweeps:Object.fromEntries(Object.entries(sweeps).map(([name,s]) =>
            [name,{minimum:s.minimum,allMinimum:s.allMinimum,
                failures:s.failures.slice(0,10),allFailures:s.allFailures.slice(0,10),
                step:s.step,refinement:s.refinement}])),
        triangles:fixture.id==='branched-skeleton'
            ? trianglePacket(p,system,modes,sweeps):null,
        marginMap:marginMap(p,system,PEW.skin,primary.angles),
        boundary:{SBW:summarizeBoundary(p,system,SBW),
            PEW:summarizeBoundary(p,system,PEW.skin),
            PEWmin:modes.PEWmin?summarizeBoundary(p,system,modes.PEWmin):null},
        changeFromW2:changeMap(p,system,PEW.skin,W2.skinBinding),
        changeFromSBW:changeMap(p,system,PEW.skin,SBW),
        energies:Object.fromEntries(Object.entries(modes).map(([name,skin])=>
            [name,energy(p,skin)])),
        maxRawViolation:PEW.maxRawViolation,
        rootAndBrush:rootAndBrush(p,PEW.skin,system)};
    row.timingMs.runtimeValidation=performance.now()-validationStart;
    report.push(row);
}
console.log('verify-rig-pose-envelope-feasibility: PASS');
console.log(JSON.stringify({fixtures:report},null,2));
}
export { hashes, hash, area2, posed, systemFor, lpSoft, skinFrom,
    runPrimary, modelPayload, modeMetrics, summarizeBoundary, energy, sweep,
    rootAndBrush };
