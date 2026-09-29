// R-60 diagnostic only: bounded one-dimensional AVW -> R-58 Phase B search.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixtures, evaluateMode } from './verify-rig-hybrid-domain-patch.mjs';
import { preparePoseAttribution, roleMetadata, summaryAtPose,
    overlapPixelCenters } from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights } from './junction-harmonic-weight-diagnostic.mjs';
import { hashes, hash, systemFor, skinFrom, sweep }
    from './verify-rig-pose-envelope-feasibility.mjs';
import { sourceSupport, proxyAtPose } from './alpha-area-support-diagnostic.mjs';
import { allVisibleSystemFor } from './all-visible-pose-diagnostic.mjs';
import { evaluateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';
import { deformRasterSnapshotWithSkin } from '../system/animation/raster-skin-render-plan.js';

const verifier=fileURLToPath(new URL('./verify-rig-area-preservation-feasibility.mjs',
    import.meta.url));
const result=spawnSync(process.execPath,[verifier,'--emit-weights'],{
    encoding:'utf8',maxBuffer:16*1024*1024,timeout:180000});
assert.equal(result.status,0,result.stderr||`R-58 exited ${result.status}`);
assert.ok(result.stdout.startsWith('verify-rig-area-preservation-feasibility: PASS'));
const r58=JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
assert.equal(r58.classification,'A');
const W0=r58.avwWeights,W1=r58.phaseBWeights,APW=r58.apwWeights;
assert.ok(Array.isArray(W0)&&Array.isArray(W1)&&Array.isArray(APW));
assert.equal(W0.length,W1.length);
assert.equal(W0.length,APW.length);
const weightsAt=lambda=>W0.map((w,i)=>w+lambda*(W1[i]-w));
const maximumDifference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
assert.ok(maximumDifference(weightsAt(0),W0)<1e-12);
assert.ok(maximumDifference(weightsAt(.125),APW)<1e-12);
assert.ok(maximumDifference(weightsAt(1),W1)<1e-12);

const fixture=fixtures.find(v=>v.id==='branched-skeleton');
const p=preparePoseAttribution(fixture);
assert.equal(hash(p),hashes[fixture.id]);
assert.equal(r58.topology.fingerprint,hashes[fixture.id]);
assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],[61,80]);
const W2=createJunctionHarmonicWeights(p.topology,p.context);
assert.equal(W2.ok,true);
const junction=systemFor(p,W2);
const support=sourceSupport(p);
const system=allVisibleSystemFor(p,W2,junction,support);
assert.equal(system.variables.length,W0.length);
const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
const roles=Object.keys(r58.baseline.regional);
const targetRole=`CHILD:${fixture.movingBoneId}`;
const sourceAsset={...p.asset,meshDefinitions:[p.mesh],
    skinBindings:[skinFrom(p,W2,system,W0).skin]};
const bind=evaluateRasterBoneSkinning(sourceAsset,null,0);
assert.equal(bind.ok,true);
function colorMass(mesh) {
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
}
const bindMass=colorMass(bind.resultByMeshId.get(p.mesh.meshId));
const near=(actual,expected,label,tolerance=1e-8)=>assert.ok(
    Math.abs(actual-expected)<tolerance,`${label}: ${actual} != ${expected}`);

function evaluate(lambda) {
    const weights=weightsAt(lambda);
    const skin=skinFrom(p,W2,system,weights).skin;
    const rows=[];
    for(const kind of ['translation','rotation'])
        for(const magnitude of kind==='translation'?[5,15,30,60]:[5,15,30,45])
            rows.push(summaryAtPose(p,skin,metadata,kind,magnitude));
    const t=rows.find(v=>v.kind==='translation'&&v.magnitude===60);
    const r=rows.find(v=>v.kind==='rotation'&&v.magnitude===45);
    const original=pose=>evaluateMode(p.fixture,p.snapshot,p.asset,p.product,
        pose.clip,p.coverage,p.context.gridDiagonal);
    const endpoint=pose=>({
        inversion:pose.raster.visibleInversion,
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
    const regional=Object.fromEntries(roles.map(role=>{
        const values=proxy.rows.filter(v=>v.role===role);
        const source=values.reduce((s,v)=>s+v.source,0);
        const deformed=values.reduce((s,v)=>s+v.sourceArea,0);
        return [role,{source,deformed,retention:deformed/source}];
    }));
    const raster=colorMass(t.posed);
    const colors=Object.fromEntries(['target','right','center','black']
        .map(name=>[name,raster[name]/bindMass[name]]));
    const failures=[];
    for(const row of rows) if(row.raster.visibleInversion!==0)
        failures.push({type:'visible inversion',pose:row.kind,
            magnitude:row.magnitude,count:row.raster.visibleInversion});
    if(angular.allFailures.length) failures.push({type:'rotation sweep orientation',
        pose:'rotation',magnitude:angular.allFailures[0].angle,
        count:angular.allFailures.length,triangle:angular.allFailures[0].id});
    for(const [pose,metric] of [[t,translation],[r,rotation]]) {
        if(metric.overlap!==0) failures.push({type:'geometric overlap',
            pose:pose.kind,magnitude:pose.magnitude,count:metric.overlap});
        if(metric.targetAlpha<.85) failures.push({type:'target alpha',
            pose:pose.kind,magnitude:pose.magnitude,value:metric.targetAlpha});
        if(metric.targetRetention<.85) failures.push({type:'target motion retention',
            pose:pose.kind,magnitude:pose.magnitude,value:metric.targetRetention});
        if(metric.minimumVisibleRatio<r58.r58AreaFloor-1e-7)
            failures.push({type:'R-58 area floor',pose:pose.kind,
                magnitude:pose.magnitude,value:metric.minimumVisibleRatio});
    }
    if(angular.allMinimum.ratio<r58.r58AreaFloor-1e-7)
        failures.push({type:'rotation sweep area floor',pose:'rotation',
            magnitude:angular.allMinimum.angle,value:angular.allMinimum.ratio});
    for(const [pose,value] of [['translation',proxy.targetRatio],
        ['rotation',rotationProxy.targetRatio]])
        if(value<.875-1e-7) failures.push({type:'target alpha proxy',
            pose,magnitude:pose==='translation'?60:45,value});
    for(const role of roles.filter(v=>v!==targetRole)) {
        const delta=regional[role].retention-r58.baseline.regional[role].retention;
        if(delta<-1e-6) failures.push({type:'regional regression',
            region:role,value:delta});
    }
    for(const name of ['right','center','black']) {
        const delta=colors[name]-r58.baseline.colorRetention[name];
        if(delta<-1e-3) failures.push({type:'raster color regression',
            region:name,value:delta});
    }
    const rowSumMaximum=Math.max(...skin.vertexWeights.map(v=>Math.abs(
        v.influences.reduce((s,w)=>s+w.weight,0)-1)));
    assert.ok(rowSumMaximum<1e-12);
    const summary={lambda,pass:failures.length===0,firstFailure:failures[0]||null,
        failureCount:failures.length,translation,rotation,
        sweep:{failures:angular.allFailures.length,
            minimumVisibleRatio:angular.allMinimum.ratio},
        regional,colors,proxyWhole:proxy.sourceRatio,
        proxyTarget:{translation:proxy.targetRatio,rotation:rotationProxy.targetRatio},
        normalizationError:rowSumMaximum,sameSkinBindingPerPose:true};
    return summary;
}

const AVW=evaluate(0),apw=evaluate(.125),endpoint=evaluate(1);
assert.equal(AVW.pass,true);
assert.equal(apw.pass,true);
assert.equal(endpoint.pass,false);
for(const [actual,expected,label] of [
    [AVW.translation,r58.baseline.translation,'AVW T60'],
    [AVW.rotation,r58.baseline.rotation,'AVW R45'],
    [apw.translation,r58.phaseB.nearBaselineSafetyWitness.translation,'APW T60'],
    [apw.rotation,r58.phaseB.nearBaselineSafetyWitness.rotation,'APW R45'],
    [endpoint.translation,r58.phaseB.runtime.translation,'Phase B T60'],
    [endpoint.rotation,r58.phaseB.runtime.rotation,'Phase B R45']]) {
    near(actual.wholeAlpha,expected.wholeAlpha,`${label} whole`);
    near(actual.targetAlpha,expected.targetAlpha,`${label} target`);
    near(actual.remoteRight,expected.remoteRight,`${label} remote Right`);
    assert.equal(actual.overlap,expected.overlap);
    assert.equal(actual.inversion,expected.inversion);
}
assert.equal(endpoint.rotation.overlap,7);

// One fixed coarse bracket, then no more than 12 deterministic refinements.
const coarse=[.25,.5,.75].map(evaluate);
const ordered=[apw,...coarse,endpoint].sort((a,b)=>a.lambda-b.lambda);
let best=[...ordered].reverse().find(v=>v.pass);
let fail=ordered.find(v=>v.lambda>best.lambda&&!v.pass);
assert.ok(best&&fail);
const initialBracket={pass:best.lambda,fail:fail.lambda};
const refinements=[];
for(let i=0;i<12;i++) {
    const candidate=evaluate((best.lambda+fail.lambda)/2);
    refinements.push({lambda:candidate.lambda,pass:candidate.pass,
        firstFailure:candidate.firstFailure});
    if(candidate.pass) best=candidate;
    else fail=candidate;
}
const output={classification:'BOUNDARY FOUND',topology:r58.topology,
    path:{W0:'R-54 AVW',W1:'R-58 Phase B',apwLambda:.125,
        exactApwMaximumDifference:maximumDifference(weightsAt(.125),APW),
        variableCount:W0.length,support:'same R-54/R-58 variable system'},
    baseline:AVW,apw,phaseBEndpoint:endpoint,
    coarse:coarse.map(v=>({lambda:v.lambda,pass:v.pass,
        firstFailure:v.firstFailure})),initialBracket,refinements,
    largestStablePass:best,nearestTestedFail:fail,
    refinementCount:refinements.length,
    avwWeights:process.argv.includes('--emit-weights')?W0:null,
    apwWeights:process.argv.includes('--emit-weights')?APW:null,
    mswWeights:best.lambda>.125?weightsAt(best.lambda):null};
console.log('verify-rig-weight-direction-boundary: PASS');
console.log(JSON.stringify(output,null,2));
