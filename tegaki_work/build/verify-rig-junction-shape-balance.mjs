// R-61 diagnostic only: one Junction shape-balance solve and canonical gates.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const [r60Path,r54Path,attributionPath]=process.argv.slice(2);
assert.ok(r60Path&&r54Path&&attributionPath,
    'pass saved R-60, R-54, and R-61 attribution reports');
function readReport(path,prefix) {
    const raw=readFileSync(path,'utf8');
    assert.ok(raw.startsWith(prefix),`${path}: expected ${prefix}`);
    return JSON.parse(raw.slice(raw.indexOf('{')));
}
const r60=readReport(r60Path,'verify-rig-weight-direction-boundary: PASS');
const r54=readReport(r54Path,'verify-rig-all-visible-pose-feasibility: PASS');
const attribution=readReport(attributionPath,'audit-rig-msw-junction-shape: PASS');
assert.ok(r60.largestStablePass?.pass&&Array.isArray(r60.mswWeights));
assert.equal(r54.classification,'A');
assert.equal(attribution.lambda,r60.largestStablePass.lambda);
const avw=r54['branched-skeleton'].candidates.find(v=>v.name==='AVW');
assert.ok(avw?.good);
const fixture=fixtures.find(v=>v.id==='branched-skeleton');
const p=preparePoseAttribution(fixture);
assert.equal(hash(p),hashes[fixture.id]);
assert.equal(r60.topology.fingerprint,hashes[fixture.id]);
assert.equal(attribution.topology.fingerprint,hashes[fixture.id]);
const W2=createJunctionHarmonicWeights(p.topology,p.context);
assert.equal(W2.ok,true);
const junction=systemFor(p,W2),soft=lpSoft(junction);
const support=sourceSupport(p);
const system=allVisibleSystemFor(p,W2,junction,support);
const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
const payload=modelPayload(p,W2,system,soft,
    r54['branched-skeleton'].stage2.angles);
const byId=new Map(p.mesh.vertices.map((v,i)=>[v.vertexId,i]));
payload.alpha={triangleVertices:p.mesh.triangles.map(tri=>tri.map(id=>byId.get(id))),
    bind:support.rows.map(v=>v.bind),
    targetSupport:support.rows.map(v=>v.target),
    targetTotal:support.targetTotal,
    poseIndices:[0,payload.poses.length-1],threshold:.875};
const groups=Object.fromEntries(Object.keys(r60.largestStablePass.regional)
    .map(role=>[role,support.rows.filter(v=>v.role===role).map(v=>v.id)]));
const regionalMin=Object.fromEntries(['CHILD:left','CHILD:right','CHILD:center']
    .map(role=>[role,r60.largestStablePass.regional[role].retention-1e-8]));
const request={triangleVertices:payload.alpha.triangleVertices,
    bind:payload.alpha.bind,source:support.rows.map(v=>v.source),
    junctionIndices:attribution.triangles.map(v=>v.id),
    groups,baseline:r60.mswWeights,marginFloor:avw.margin-1e-8,
    regionalMin,wholeMin:r60.largestStablePass.proxyWhole-1e-8};
const solver=fileURLToPath(new URL('./junction-pose-envelope-nlp.py',import.meta.url));
const solved=spawnSync('python',[solver],{
    input:JSON.stringify({...payload,r61Shape:request}),encoding:'utf8',
    maxBuffer:16*1024*1024,timeout:180000});
assert.equal(solved.status,0,solved.stderr||`shape solver exited ${solved.status}`);
const solution=JSON.parse(solved.stdout);
const rank=(values,q)=>values[Math.min(values.length-1,
    Math.round((values.length-1)*q))];
const distribution=rows=>{
    const values=rows.map(v=>v.ratio).sort((a,b)=>a-b);
    return {min:values[0],p10:rank(values,.1),median:rank(values,.5),
        p90:rank(values,.9),max:values.at(-1)};
};
const trim=({weights,...rest})=>rest;

let candidate=null;
if(solution.feasible) {
    const skin=skinFrom(p,W2,system,solution.weights).skin;
    const rows=[];
    for(const kind of ['translation','rotation'])
        for(const magnitude of kind==='translation'?[5,15,30,60]:[5,15,30,45])
            rows.push(summaryAtPose(p,skin,metadata,kind,magnitude));
    const t=rows.find(v=>v.kind==='translation'&&v.magnitude===60);
    const r=rows.find(v=>v.kind==='rotation'&&v.magnitude===45);
    const original=pose=>evaluateMode(p.fixture,p.snapshot,p.asset,p.product,
        pose.clip,p.coverage,p.context.gridDiagonal);
    const endpoint=pose=>({inversion:pose.raster.visibleInversion,
        overlap:overlapPixelCenters(pose.posed).multiple,
        targetAlpha:pose.raster.targetAlpha,
        wholeAlpha:pose.raster.alphaTotal,
        targetRetention:pose.raster.targetDisplacement
            /original(pose).regions[p.fixture.movingBoneId].displacement,
        minimumVisibleRatio:Math.min(...pose.areas
            .filter(v=>v.support!=='transparent-only').map(v=>v.ratio)),
        remoteRight:pose.raster.remote.right});
    const translation=endpoint(t),rotation=endpoint(r);
    const angular=sweep(p,skin,system);
    const proxy=proxyAtPose(p,skin,t.clip,support,t.posed);
    const rotationProxy=proxyAtPose(p,skin,r.clip,support,r.posed);
    const regional=Object.fromEntries(Object.keys(groups).map(role=>{
        const values=proxy.rows.filter(v=>v.role===role);
        const source=values.reduce((s,v)=>s+v.source,0);
        const deformed=values.reduce((s,v)=>s+v.sourceArea,0);
        return [role,{source,deformed,retention:deformed/source}];
    }));
    const junctionRows=attribution.triangles.map(v=>({
        id:v.id,ratio:t.areas[v.id].ratio}));
    const colorMass=mesh=>{
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
    const sourceAsset={...p.asset,meshDefinitions:[p.mesh],skinBindings:[skin]};
    const bind=evaluateRasterBoneSkinning(sourceAsset,null,0);
    assert.equal(bind.ok,true);
    const sourceMass=colorMass(bind.resultByMeshId.get(p.mesh.meshId));
    const posedMass=colorMass(t.posed);
    const colors=Object.fromEntries(['target','right','center','black']
        .map(name=>[name,posedMass[name]/sourceMass[name]]));
    const failures=[];
    for(const row of rows) if(row.raster.visibleInversion!==0)
        failures.push({type:'visible inversion',pose:row.kind,
            magnitude:row.magnitude,count:row.raster.visibleInversion});
    if(angular.allFailures.length) failures.push({type:'rotation sweep orientation',
        pose:'rotation',magnitude:angular.allFailures[0].angle,
        count:angular.allFailures.length});
    for(const [pose,metric] of [[t,translation],[r,rotation]]) {
        if(metric.overlap) failures.push({type:'geometric overlap',
            pose:pose.kind,magnitude:pose.magnitude,count:metric.overlap});
        if(metric.targetAlpha<.85) failures.push({type:'target alpha',
            pose:pose.kind,magnitude:pose.magnitude,value:metric.targetAlpha});
        if(metric.targetRetention<.85) failures.push({type:'target motion retention',
            pose:pose.kind,magnitude:pose.magnitude,value:metric.targetRetention});
        if(metric.minimumVisibleRatio<request.marginFloor-1e-7)
            failures.push({type:'minimum visible area',pose:pose.kind,
                magnitude:pose.magnitude,value:metric.minimumVisibleRatio});
    }
    if(angular.allMinimum.ratio<request.marginFloor-1e-7)
        failures.push({type:'rotation sweep area floor',
            magnitude:angular.allMinimum.angle,value:angular.allMinimum.ratio});
    if(proxy.targetRatio<.875-1e-7||rotationProxy.targetRatio<.875-1e-7)
        failures.push({type:'target alpha proxy',
            values:[proxy.targetRatio,rotationProxy.targetRatio]});
    for(const role of Object.keys(regionalMin)) {
        const delta=regional[role].retention
            -r60.largestStablePass.regional[role].retention;
        if(delta<-1e-6) failures.push({type:'regional regression',
            region:role,value:delta});
    }
    const wholeDelta=translation.wholeAlpha
        -r60.largestStablePass.translation.wholeAlpha;
    if(wholeDelta<-1e-3)
        failures.push({type:'runtime whole alpha regression',value:wholeDelta});
    for(const name of ['target','right','center']) {
        const delta=colors[name]-r60.largestStablePass.colors[name];
        if(delta<-1e-3) failures.push({type:'raster color regression',
            region:name,value:delta});
    }
    candidate={safe:failures.length===0,firstFailure:failures[0]||null,
        failures,translation,rotation,
        sweep:{failures:angular.allFailures.length,
            minimumVisibleRatio:angular.allMinimum.ratio},
        regional,colors,proxyWhole:proxy.sourceRatio,
        proxyTarget:{translation:proxy.targetRatio,
            rotation:rotationProxy.targetRatio},
        junctionDistribution:distribution(junctionRows),
        sameSkinBindingPerPose:true};
}
const useful=solution.feasible&&candidate?.safe
    &&solution.objectiveCandidate<solution.objectiveBaseline-1e-6;
const output={technicalClassification:useful?'JBW_FEASIBLE':'NO_SAFE_USEFUL_JBW',
    topology:r60.topology,mswLambda:r60.largestStablePass.lambda,
    attribution:{triangleCount:attribution.junctionTriangleCount,
        distribution:attribution.distribution},
    selectedObjective:'source-alpha-weighted mean squared Junction area-ratio deviation from 1',
    solver:trim(solution),msw:r60.largestStablePass,candidate,
    jbwWeights:useful?solution.weights:null};
console.log('verify-rig-junction-shape-balance: PASS (diagnostic executed)');
console.log(JSON.stringify(output,null,2));
