// R-58 diagnostic only: fixed R-47 topology/support, one area solve per phase.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixtures, evaluateMode } from './verify-rig-hybrid-domain-patch.mjs';
import { preparePoseAttribution, roleMetadata, summaryAtPose,
    overlapPixelCenters } from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights } from './junction-harmonic-weight-diagnostic.mjs';
import { hashes, hash, systemFor, lpSoft, skinFrom, modelPayload, sweep }
    from './verify-rig-pose-envelope-feasibility.mjs';
import { sourceSupport, proxyAtPose } from './alpha-area-support-diagnostic.mjs';
import { allVisibleSystemFor } from './all-visible-pose-diagnostic.mjs';
import { evaluateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';
import { deformRasterSnapshotWithSkin } from '../system/animation/raster-skin-render-plan.js';

const r54=fileURLToPath(new URL('./verify-rig-all-visible-pose-feasibility.mjs',import.meta.url));
const solver=fileURLToPath(new URL('./junction-pose-envelope-nlp.py',import.meta.url));
const run=(bin,args,input)=>{
    const result=spawnSync(bin,args,{input:input&&JSON.stringify(input),
        encoding:'utf8',maxBuffer:16*1024*1024,timeout:180000});
    assert.equal(result.status,0,result.stderr||`${bin}: ${result.status}`);
    return result.stdout;
};
const r54Output=run(process.execPath,[r54,'--emit-avw']);
assert.ok(r54Output.startsWith('verify-rig-all-visible-pose-feasibility: PASS'));
const r54Report=JSON.parse(r54Output.slice(r54Output.indexOf('{')));
assert.equal(r54Report.classification,'A');
const r54Branch=r54Report['branched-skeleton'];
const avw=r54Branch.candidates.find(v=>v.name==='AVW');
assert.ok(avw?.good&&Array.isArray(r54Branch.avwWeights));

const fixture=fixtures.find(v=>v.id==='branched-skeleton');
const p=preparePoseAttribution(fixture);
assert.equal(hash(p),hashes[fixture.id]);
assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],[61,80]);
const W2=createJunctionHarmonicWeights(p.topology,p.context);
assert.equal(W2.ok,true);
const junction=systemFor(p,W2),soft=lpSoft(junction);
const support=sourceSupport(p);
const system=allVisibleSystemFor(p,W2,junction,support);
const angles=r54Branch.stage2.angles;
const payload=modelPayload(p,W2,system,soft,angles);
const byId=new Map(p.mesh.vertices.map((v,i)=>[v.vertexId,i]));
payload.alpha={triangleVertices:p.mesh.triangles.map(tri=>tri.map(id=>byId.get(id))),
    bind:support.rows.map(v=>v.bind),
    targetSupport:support.rows.map(v=>v.target),
    targetTotal:support.targetTotal,
    poseIndices:[0,payload.poses.length-1],threshold:.875};
const baselineSkin=skinFrom(p,W2,system,r54Branch.avwWeights).skin;
const areaFloor=avw.margin-1e-8;
const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
const baselinePose=summaryAtPose(p,baselineSkin,metadata,'translation',60);
const baselineProxy=proxyAtPose(p,baselineSkin,baselinePose.clip,
    support,baselinePose.posed);
const roles=[...new Set(support.rows.filter(v=>v.source>0).map(v=>v.role))].sort();
const regional=Object.fromEntries(roles.map(role=>{
    const rows=baselineProxy.rows.filter(v=>v.role===role);
    const source=rows.reduce((s,v)=>s+v.source,0);
    const deformed=rows.reduce((s,v)=>s+v.sourceArea,0);
    return [role,{source,deformed,retention:deformed/source,
        loss:source-deformed}];
}));
assert.ok(Math.abs(Object.values(regional).reduce((s,v)=>s+v.source,0)
    -support.sourceTotal)<1e-6);
assert.ok(Math.abs(Object.values(regional).reduce((s,v)=>s+v.deformed,0)
    -baselineProxy.sourceRatio*support.sourceTotal)<1e-6);

const rasterFor=mesh=>{
    const image=deformRasterSnapshotWithSkin(p.snapshot,mesh);
    assert.ok(image?.pixels);
    const mass=[0,0,0,0];
    for(let i=0;i<image.pixels.length;i+=4) {
        const a=image.pixels[i+3]/255;
        mass[0]+=a;
        for(let c=0;c<3;c++) mass[c+1]+=a*image.pixels[i+c]/255;
    }
    const [whole,target,right,center]=mass;
    return {whole,target,right,center,black:whole-target-right-center};
};
const sourceAsset={...p.asset,meshDefinitions:[p.mesh],skinBindings:[baselineSkin]};
const bind=evaluateRasterBoneSkinning(sourceAsset,null,0);
assert.equal(bind.ok,true);
const bindMass=rasterFor(bind.resultByMeshId.get(p.mesh.meshId));
const channelMass=pose=>rasterFor(pose.posed);

function metrics(weights,label) {
    const skin=skinFrom(p,W2,system,weights).skin;
    const rows=[];
    for(const kind of ['translation','rotation'])
        for(const magnitude of kind==='translation'?[5,15,30,60]:[5,15,30,45]) {
            const pose=summaryAtPose(p,skin,metadata,kind,magnitude);
            rows.push(pose);
        }
    const t=rows.find(v=>v.kind==='translation'&&v.magnitude===60);
    const r=rows.find(v=>v.kind==='rotation'&&v.magnitude===45);
    const original=(pose)=>evaluateMode(p.fixture,p.snapshot,p.asset,p.product,
        pose.clip,p.coverage,p.context.gridDiagonal);
    const targetRetention=pose=>pose.raster.targetDisplacement
        /original(pose).regions[p.fixture.movingBoneId].displacement;
    const present=pose=>({inversion:pose.raster.visibleInversion,
        overlap:overlapPixelCenters(pose.posed).multiple,
        targetAlpha:pose.raster.targetAlpha,
        wholeAlpha:pose.raster.alphaTotal,
        targetRetention:targetRetention(pose),
        minimumVisibleRatio:Math.min(...pose.areas.filter(v=>v.support
            !=='transparent-only').map(v=>v.ratio)),
        remoteRight:pose.raster.remote.right});
    const translation=present(t),rotation=present(r);
    const angular=sweep(p,skin,system);
    const proxy=proxyAtPose(p,skin,t.clip,support,t.posed);
    const rotationProxy=proxyAtPose(p,skin,r.clip,support,r.posed);
    const region=Object.fromEntries(roles.map(role=>{
        const values=proxy.rows.filter(v=>v.role===role);
        const source=values.reduce((s,v)=>s+v.source,0);
        const deformed=values.reduce((s,v)=>s+v.sourceArea,0);
        return [role,{source,deformed,retention:deformed/source}];
    }));
    const raster=channelMass(t);
    const colorRetention=Object.fromEntries(['target','right','center','black']
        .map(name=>[name,raster[name]/bindMass[name]]));
    const safe=rows.every(v=>v.raster.visibleInversion===0)
        &&angular.allFailures.length===0
        &&[translation,rotation].every(v=>v.overlap===0
            &&v.targetAlpha>=.85&&v.targetRetention>=.85
            &&v.minimumVisibleRatio>=areaFloor-1e-7)
        &&angular.allMinimum.ratio>=areaFloor-1e-7
        &&proxy.targetRatio>=.875-1e-7
        &&rotationProxy.targetRatio>=.875-1e-7;
    return {label,safe,translation,rotation,
        sweep:{failures:angular.allFailures.length,
            minimumVisibleRatio:angular.allMinimum.ratio},
        proxyWhole:proxy.sourceRatio,
        proxyTarget:{translation:proxy.targetRatio,rotation:rotationProxy.targetRatio},
        regional:region,colorRetention,
        runtimeWholeFromPixels:raster.whole/bindMass.whole};
}
const baseline=metrics(r54Branch.avwWeights,'AVW');
assert.ok(baseline.safe);
assert.ok(Math.abs(baseline.translation.wholeAlpha-.6924742847958856)<1e-9);

const groups=Object.fromEntries(roles.map(role=>[role,support.rows
    .filter(v=>v.role===role).map(v=>v.id)]));
const request={triangleVertices:payload.alpha.triangleVertices,
    bind:payload.alpha.bind,source:support.rows.map(v=>v.source),
    sourceTotal:support.sourceTotal,groups,
    marginFloor:areaFloor,baseline:r54Branch.avwWeights};
const solveArea=(extra)=>JSON.parse(run('python',[solver],
    {...payload,r58Area:{...request,...extra}}));
const phaseA=solveArea({});
const upper=phaseA.feasible?metrics(phaseA.weights,'whole-area upper bound'):null;
const regionalMin=Object.fromEntries(roles.filter(v=>v!==`CHILD:${fixture.movingBoneId}`)
    .map(role=>[role,regional[role].retention-1e-8]));
const phaseB=solveArea({regionalMin});
const pareto=phaseB.feasible?metrics(phaseB.weights,'APW'):null;
// The proxy optimizer has no nonlocal-overlap constraint. Check one fixed
// near-baseline interpolation witness rather than treating its optimum as safe.
const near=pareto&&!pareto.safe?metrics(r54Branch.avwWeights.map((v,i)=>
    v+(phaseB.weights[i]-v)/8),'APW one-eighth safety witness'):null;
const witness=pareto?.safe?pareto:near?.safe?near:null;
const witnessWeights=pareto?.safe?phaseB.weights:near?.safe
    ?r54Branch.avwWeights.map((v,i)=>v+(phaseB.weights[i]-v)/8):null;

const regionRegressions=witness?Object.fromEntries(Object.keys(regionalMin)
    .map(role=>[role,witness.regional[role].retention-regional[role].retention])):null;
const colorRegressions=witness?Object.fromEntries(['right','center','black']
    .map(name=>[name,witness.colorRetention[name]-baseline.colorRetention[name]])):null;
const improved=witness&&witness.translation.wholeAlpha
    >baseline.translation.wholeAlpha+1e-6;
const proxyImproved=witness&&witness.proxyWhole>baseline.proxyWhole+1e-6;
const noRegionalMigration=witness&&Object.values(regionRegressions)
    .every(delta=>delta>=-1e-6)
    &&Object.values(colorRegressions).every(delta=>delta>=-1e-3);
const classification=improved&&proxyImproved&&noRegionalMigration?'A':'U';
const trim=({weights,...rest})=>rest;
const report={classification,topology:{fixture:fixture.id,
    fingerprint:hashes[fixture.id],vertices:p.mesh.vertices.length,
    triangles:p.mesh.triangles.length},
    r54Margin:avw.margin,r58AreaFloor:areaFloor,
    sourceSupportTotal:support.sourceTotal,
    baseline:{...baseline,regional},
    phaseA:{solver:trim(phaseA),runtime:upper},
    phaseB:{solver:trim(phaseB),runtime:pareto,
        nearBaselineSafetyWitness:near,selectedWitness:witness?.label||null,
        regionalRegressions:regionRegressions,
        runtimeColorRegressions:colorRegressions},
    avwWeights:process.argv.includes('--emit-weights')?r54Branch.avwWeights:null,
    phaseBWeights:process.argv.includes('--emit-weights')?phaseB.weights:null,
    apwWeights:classification==='A'?witnessWeights:null,
    sameSkinBindingPerPose:true};
console.log('verify-rig-area-preservation-feasibility: PASS (diagnostic executed)');
console.log(JSON.stringify(report,null,2));
