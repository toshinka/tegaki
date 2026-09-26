// R-53 diagnostic only. Proxy gate precedes any area-constrained optimization.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixtures, evaluateMode, bindCoverage, motionClip }
    from './verify-rig-hybrid-domain-patch.mjs';
import { degreesToRadians } from './verify-rig-canonical-geometry.mjs';
import { preparePoseAttribution, roleMetadata, summaryAtPose,
    overlapPixelCenters } from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights } from './junction-harmonic-weight-diagnostic.mjs';
import { hashes, hash, area2, posed, systemFor, lpSoft, skinFrom, runPrimary,
    modelPayload, sweep, summarizeBoundary, energy, rootAndBrush }
    from './verify-rig-pose-envelope-feasibility.mjs';
import { sourceSupport, proxyAtPose }
    from './alpha-area-support-diagnostic.mjs';

const round=v=>Number.isFinite(v)?Number(v.toFixed(7)):v;
const percentile=(a,f)=>a.length?[...a].sort((x,y)=>x-y)
    [Math.ceil(f*(a.length-1))]:null;
const stats=a=>({max:round(Math.max(...a)),median:round(percentile(a,.5)),
    p90:round(percentile(a,.9))});
const lpPath=fileURLToPath(new URL('./junction-pose-feasibility-lp.py',import.meta.url));
const nlpPath=fileURLToPath(new URL('./junction-pose-envelope-nlp.py',import.meta.url));
function python(path,payload) {
    const run=spawnSync('python',[path],{input:JSON.stringify(payload),
        encoding:'utf8',maxBuffer:20*1024*1024,timeout:180000});
    assert.equal(run.status,0,run.stderr||`solver exit ${run.status}`);
    return JSON.parse(run.stdout);
}
function translationAlphaRow(p,system,support,W2) {
    const n=system.variables.length,coefficients=new Array(n).fill(0);
    let constant=0;
    const byId=new Map(p.mesh.vertices.map(v=>[v.vertexId,v]));
    const weight=(id,bone)=>{
        const row=W2.skinBinding.vertexWeights.find(v=>v.vertexId===id);
        return row.influences.find(v=>v.boneId===bone)?.weight||0;
    };
    for (const row of support.rows.filter(v=>v.target>0)) {
        const ids=p.mesh.triangles[row.id],pts=ids.map(v=>byId.get(v));
        const d={x:60,y:0},cross=(u,v)=>u.x*v.y-u.y*v.x;
        const u={x:pts[1].x-pts[0].x,y:pts[1].y-pts[0].y};
        const v={x:pts[2].x-pts[0].x,y:pts[2].y-pts[0].y};
        const dv=cross(d,v),ud=cross(u,d),c=[-dv-ud,dv,ud];
        let areaConstant=row.bind;
        ids.forEach((id,k)=>{
            const index=system.index.get(`${id}|${p.fixture.movingBoneId}`);
            if (index===undefined) areaConstant+=c[k]*weight(id,p.fixture.movingBoneId);
            else coefficients[index]+=row.target*c[k]/row.bind/support.targetTotal;
        });
        constant+=row.target*areaConstant/row.bind/support.targetTotal;
    }
    return {constant,coefficients};
}
function evaluateWitness(p,skin,support,name) {
    const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
    const baselineCoverage=bindCoverage(p.snapshot,p.product.meshDefinition);
    const canonical=[];
    for (const kind of ['translation','rotation'])
        for (const magnitude of kind==='translation'?[5,15,30,60]:[5,15,30,45]) {
            const pose=summaryAtPose(p,skin,metadata,kind,magnitude);
            const proxy=proxyAtPose(p,skin,pose.clip,support,pose.posed);
            const baseline=evaluateMode(p.fixture,p.snapshot,p.asset,p.product,
                pose.clip,baselineCoverage,p.context.gridDiagonal);
            assert.equal(baseline.valid,true);
            canonical.push({kind,magnitude,inversion:pose.raster.visibleInversion,
                targetAlpha:pose.raster.targetAlpha,wholeAlpha:pose.raster.alphaTotal,
                proxyTarget:proxy.targetRatio,proxyWhole:proxy.sourceRatio,
                retention:pose.raster.targetDisplacement/
                    baseline.regions[p.fixture.movingBoneId].displacement,
                overlap:(pose.overlap||overlapPixelCenters(pose.posed)).multiple,
                remote:pose.raster.remote,
                junction:pose.byRole['JUNCTION:root'],
                areaRows:kind==='translation'&&magnitude===60||
                    kind==='rotation'&&magnitude===45?proxy.rows:undefined});
        }
    return {name,canonical};
}
function areaDistribution(pose,target) {
    const rows=pose.areaRows.filter(v=>v.source>0);
    const groups=Object.fromEntries(['target CHILD','Junction','other CHILD']
        .map(role=>[role,rows.filter(v=>v.region===role)]));
    const describe=items=>({count:items.length,
        min:round(percentile(items.map(v=>v.ratio),0)),
        p10:round(percentile(items.map(v=>v.ratio),.1)),
        median:round(percentile(items.map(v=>v.ratio),.5)),
        p90:round(percentile(items.map(v=>v.ratio),.9)),
        max:round(percentile(items.map(v=>v.ratio),1))});
    return {groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>
        [k,describe(v)])),compensation:Object.fromEntries([.1,.25,.5,1.5,2]
        .map(limit=>[limit,rows.filter(v=>limit<1?v.ratio<limit:v.ratio>limit).length])),
        minimumAbsoluteArea:Math.min(...rows.map(v=>v.area)),
        minimumRatio:Math.min(...rows.map(v=>v.ratio))};
}
const results=[];
let connectedStage=null;
for (const fixture of fixtures) {
    const p=preparePoseAttribution(fixture);
    assert.equal(hash(p),hashes[fixture.id]);
    const W2=createJunctionHarmonicWeights(p.topology,p.context);
    assert.equal(W2.ok,true);
    if (!W2.junctions.length) {
        assert.deepEqual(W2.skinBinding,p.modes.W1);
        results.push({fixture:fixture.id,control:'W2 == W1; no optimization'});
        continue;
    }
    assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],
        fixture.id==='branched-skeleton'?[61,80]:[91,132]);
    const system=systemFor(p,W2),soft=lpSoft(system);
    const SBW=skinFrom(p,W2,system,soft.SBW).skin;
    const R52=runPrimary(p,W2,system,soft);
    assert.ok(R52.p2?.feasible);
    const PEWmin=skinFrom(p,W2,system,R52.p2.weights).skin;
    const skins={W0:p.modes.W0,W1:p.modes.W1,W2:W2.skinBinding,
        SBW,PEWmin};
    const support=sourceSupport(p),metadata=roleMetadata(p.mesh,p.topology.diagnostic);
    const poses=[];
    for (const [name,skin] of Object.entries(skins)) {
        if (fixture.id==='connected-humanoid'&&name==='SBW') continue;
        for (const kind of ['translation','rotation'])
            for (const magnitude of kind==='translation'?[15,30,60]:[15,30,45]) {
                const runtime=summaryAtPose(p,skin,metadata,kind,magnitude);
                const proxy=proxyAtPose(p,skin,runtime.clip,support,runtime.posed);
                const overlap=runtime.overlap || overlapPixelCenters(runtime.posed);
                poses.push({name,kind,magnitude,
                    runtimeTarget:runtime.raster.targetAlpha,
                    proxyTarget:proxy.targetRatio,
                    targetAbsoluteError:Math.abs(runtime.raster.targetAlpha-proxy.targetRatio),
                    targetRelativeError:Math.abs(runtime.raster.targetAlpha-proxy.targetRatio)
                        /runtime.raster.targetAlpha,
                    runtimeWhole:runtime.raster.alphaTotal,
                    proxyWhole:proxy.sourceRatio,
                    wholeAbsoluteError:Math.abs(runtime.raster.alphaTotal-proxy.sourceRatio),
                    wholeRelativeError:Math.abs(runtime.raster.alphaTotal-proxy.sourceRatio)
                        /runtime.raster.alphaTotal,
                    visibleInversion:runtime.raster.visibleInversion,
                    overlap:overlap?.multiple??null,
                    minimumAreaRatio:Math.min(...proxy.rows.filter(r=>r.source>0)
                        .map(r=>r.ratio)),
                    roles:fixture.id==='branched-skeleton'&&name==='PEWmin'
                        &&kind==='translation'&&magnitude===60?proxy.roles:undefined});
            }
    }
    const safe=poses.filter(v=>v.visibleInversion===0&&v.overlap===0);
    const errors={targetAbsolute:stats(safe.map(v=>v.targetAbsoluteError)),
        targetRelative:stats(safe.map(v=>v.targetRelativeError)),
        wholeAbsolute:stats(safe.map(v=>v.wholeAbsoluteError)),
        wholeRelative:stats(safe.map(v=>v.wholeRelativeError))};
    const PEW60=poses.find(v=>v.name==='PEWmin'&&v.kind==='translation'
        &&v.magnitude===60);
    // Feasibility screen only; runtime remains the decisive quality gate.
    // Two percentage points is small beside the 0.85 threshold and the
    // observed PEW-min deficit, but no proxy borderline is called a pass.
    const proxyValid=errors.targetAbsolute.max<=.025
        &&errors.targetAbsolute.p90<=.02
        &&errors.wholeAbsolute.max<=.025
        &&PEW60.targetAbsoluteError<=.01;
    const row={fixture:fixture.id,topology:{vertices:p.mesh.vertices.length,
        triangles:p.mesh.triangles.length,fingerprint:hashes[fixture.id]},
        support:{sourceTotal:support.sourceTotal,targetTotal:support.targetTotal,
            preprocessingMs:support.preprocessingMs},
        R52:{selectedStart:R52.passes.at(-1).selectedStart,
            p2Margin:R52.p2.margin},
        errors,safeRows:safe.length,proxyValid,PEW60,
        poses:poses.map(({roles,...v})=>({...v,
            ...(roles?{roles}:{}),runtimeTarget:round(v.runtimeTarget),
            proxyTarget:round(v.proxyTarget),runtimeWhole:round(v.runtimeWhole),
            proxyWhole:round(v.proxyWhole),
            targetAbsoluteError:round(v.targetAbsoluteError),
            wholeAbsoluteError:round(v.wholeAbsoluteError)}))};
    if (proxyValid) {
        const alpha=translationAlphaRow(p,system,support,W2);
        const stage=python(lpPath,{mode:'alpha',variables:system.variables,
            vertices:system.vertices,triangles:system.triangles,alpha});
        row.stage1={...stage,weights:undefined};
        if (fixture.id==='connected-humanoid') connectedStage=stage;
        if (fixture.id==='branched-skeleton') assert.ok(connectedStage?.ok
            &&connectedStage.mStar>0,'CONNECTED LP control must pass first');
        if (stage.ok&&stage.mStar>0) {
            const AWT=skinFrom(p,W2,system,stage.weights).skin;
            const awt=evaluateWitness(p,AWT,support,'AW-T');
            row.AWT={canonical:awt.canonical.map(({areaRows,...v})=>v)};
            const t60=awt.canonical.find(v=>v.kind==='translation'&&v.magnitude===60);
            assert.ok(Math.abs(t60.proxyTarget-stage.targetAlphaGeom)<1e-7,
                'Translation LP/proxy parity');
            row.AWT.qualityPass=t60.inversion===0&&t60.targetAlpha>=.85
                &&t60.retention>=.85;
            {
                let angles=[5,15,30,45],passes=[],selected=null,final=null;
                for (let cutting=0;cutting<=2;cutting++) {
                    const payload=modelPayload(p,W2,system,soft,angles);
                    const vertexIndex=new Map(p.mesh.vertices.map((v,i)=>[v.vertexId,i]));
                    payload.alpha={triangleVertices:p.mesh.triangles.map(tri=>
                        tri.map(id=>vertexIndex.get(id))),
                        bind:support.rows.map(v=>v.bind),
                        targetSupport:support.rows.map(v=>v.target),
                        targetTotal:support.targetTotal,poseIndices:[0,payload.poses.length-1]};
                    payload.starts=[{name:'PEW-min',weights:R52.p2.weights},
                        {name:'AW-T',weights:stage.weights},
                        {name:'W2',weights:system.variables.map(v=>v.w2)},
                        {name:'SBW',weights:soft.SBW}];
                    payload.runP2=true;
                    const solved=python(nlpPath,payload);
                    passes.push({constructionMs:solved.constructionMs,
                        starts:solved.starts.map(({weights,...v})=>v),
                        selectedStart:solved.selectedStart,
                        p2:solved.p2?((({weights,...v})=>v)(solved.p2)):null});
                    if (!solved.selected?.feasible) break;
                    selected=solved.selected;
                    const skin=skinFrom(p,W2,system,selected.weights).skin;
                    const angular=sweep(p,skin,system);
                    if (!angular.failures.length) {final={solved,skin,angular};break;}
                    if (cutting===2) break;
                    const earliest=angular.failures[0].angle;
                    angles=[...new Set([...angles,earliest])].sort((a,b)=>a-b);
                }
                row.stage2={angles,cuttingPasses:passes.length-1,passes,
                    found:!!final};
                if (final) {
                    const P1=evaluateWitness(p,final.skin,support,'AAW-P1');
                    const P2=final.solved.p2?.feasible
                        ?skinFrom(p,W2,system,final.solved.p2.weights).skin:null;
                    const candidates=[{name:'AAW-P1',skin:final.skin,metrics:P1,
                        sweep:final.angular,solver:final.solved.selected}];
                    if (P2) candidates.push({name:'AAW-min',skin:P2,
                        metrics:evaluateWitness(p,P2,support,'AAW-min'),
                        sweep:sweep(p,P2,system),solver:final.solved.p2});
                    row.candidates=candidates.map(candidate=>{
                        const t=candidate.metrics.canonical.find(v=>v.kind==='translation'
                            &&v.magnitude===60);
                        const r=candidate.metrics.canonical.find(v=>v.kind==='rotation'
                            &&v.magnitude===45);
                        const good=candidate.sweep.allFailures.length===0
                            &&candidate.metrics.canonical.every(v=>v.inversion===0)
                            &&t.targetAlpha>=.85&&r.targetAlpha>=.85
                            &&t.retention>=.85&&r.retention>=.85
                            &&t.overlap===0&&r.overlap===0;
                        const minArea=Math.min(...[t,r].flatMap(pose=>pose.areaRows
                            .filter(v=>v.source>0).map(v=>v.area)));
                        const minRatio=Math.min(...[t,r].flatMap(pose=>pose.areaRows
                            .filter(v=>v.source>0).map(v=>v.ratio)));
                        const robustness=minArea>1e-4&&minRatio>.05?'ROBUST'
                            :minArea>1e-6&&minRatio>.005?'MARGINAL'
                                :'NUMERICALLY FRAGILE';
                        return {name:candidate.name,good,
                            robustness:good?robustness:null,
                            margin:candidate.solver.margin,
                            minimumAbsoluteArea:minArea,minimumRatio:minRatio,
                            l1FromW2:candidate.solver.l1FromW2,
                            sweep:{junction:candidate.sweep.minimum,
                                full:candidate.sweep.allMinimum,
                                failures:candidate.sweep.allFailures.length},
                            canonical:candidate.metrics.canonical.map(({areaRows,...v})=>v),
                            areaDistribution:{translation:areaDistribution(t),
                                rotation:areaDistribution(r)},
                            boundary:summarizeBoundary(p,system,candidate.skin),
                            energy:energy(p,candidate.skin),
                            rootAndBrush:rootAndBrush(p,candidate.skin,system)};
                    });
                }
            }
        }
    }
    results.push(row);
}
const primary=results.find(v=>v.fixture==='branched-skeleton');
const control=results.find(v=>v.fixture==='connected-humanoid');
const decision=primary.proxyValid&&control.proxyValid
    ? 'GEOMETRIC ALPHA PROXY VALID ENOUGH FOR FEASIBILITY DIAGNOSTICS'
    : 'GEOMETRIC PROXY TOO WEAK';
const classification=decision==='GEOMETRIC PROXY TOO WEAK'?'E'
    :primary.stage1?.status===2?'D'
        :primary.candidates?.some(v=>v.good)
            ?primary.candidates.some(v=>v.good&&v.robustness==='NUMERICALLY FRAGILE')
                ?'F':'A'
            :primary.stage1?.ok?'B':'C';
console.log('verify-rig-alpha-area-feasibility: PASS');
console.log(JSON.stringify({decision,classification,fixtures:results},null,2));
