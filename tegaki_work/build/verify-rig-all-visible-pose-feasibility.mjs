// R-54 diagnostic only: frozen topology, all-visible orientation and alpha.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixtures, evaluateMode, bindCoverage } from './verify-rig-hybrid-domain-patch.mjs';
import { degreesToRadians } from './verify-rig-canonical-geometry.mjs';
import { preparePoseAttribution, roleMetadata, summaryAtPose,
    overlapPixelCenters, gradients } from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights } from './junction-harmonic-weight-diagnostic.mjs';
import { hashes, hash, systemFor, lpSoft, skinFrom, runPrimary,
    modelPayload, sweep, summarizeBoundary, energy, rootAndBrush }
    from './verify-rig-pose-envelope-feasibility.mjs';
import { sourceSupport, proxyAtPose } from './alpha-area-support-diagnostic.mjs';
import { allVisibleSystemFor } from './all-visible-pose-diagnostic.mjs';

const lpPath=fileURLToPath(new URL('./junction-pose-feasibility-lp.py',import.meta.url));
const nlpPath=fileURLToPath(new URL('./junction-pose-envelope-nlp.py',import.meta.url));
const solve=(path,payload)=>{
    const run=spawnSync('python',[path],{input:JSON.stringify(payload),
        encoding:'utf8',maxBuffer:10*1024*1024,timeout:180000});
    assert.equal(run.status,0,run.stderr||`LP exit ${run.status}`);
    return JSON.parse(run.stdout);
};
const area2=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const pct=(a,f)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(f*(a.length-1))]:null;
const distribution=rows=>{
    const values=rows.map(v=>v.ratio);
    return {count:values.length,min:pct(values,0),p10:pct(values,.1),
        median:pct(values,.5),p90:pct(values,.9),max:pct(values,1),
        counts:{below010:values.filter(v=>v<.1).length,
            below025:values.filter(v=>v<.25).length,
            below050:values.filter(v=>v<.5).length,
            above150:values.filter(v=>v>1.5).length,
            above200:values.filter(v=>v>2).length}};
};
function areaDistributions(areas) {
    const rows=areas.filter(v=>v.support!=='transparent-only');
    return {all:distribution(rows),roles:Object.fromEntries(
        [...new Set(rows.map(v=>v.role))].sort().map(role=>
            [role,distribution(rows.filter(v=>v.role===role))]))};
}
function interfaceChildGradients(p,system,skin) {
    const value=(id,bone)=>skin.vertexWeights.find(v=>v.vertexId===id)
        .influences.find(v=>v.boneId===bone)?.weight||0;
    const rows=[],seen=new Set();
    p.mesh.triangles.forEach((tri,i)=>{
        if (!p.topology.diagnostic.faceRoles[i].role.startsWith('CHILD:')) return;
        for (const [a,b] of [[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]) {
            const [edge,interior]=system.boundary.has(a)&&!system.active.has(b)
                ?[a,b]:system.boundary.has(b)&&!system.active.has(a)?[b,a]:[];
            if (!edge) continue;
            const key=`${edge}|${interior}`;
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push(Math.abs(value(edge,p.fixture.movingBoneId)
                -value(interior,p.fixture.movingBoneId)));
        }
    });
    return {count:rows.length,max:pct(rows,1),median:pct(rows,.5),
        p90:pct(rows,.9)};
}
function alphaPayload(p,W2,system,soft,support,angles,threshold) {
    const payload=modelPayload(p,W2,system,soft,angles);
    const index=new Map(p.mesh.vertices.map((v,i)=>[v.vertexId,i]));
    payload.alpha={triangleVertices:p.mesh.triangles.map(tri=>
        tri.map(id=>index.get(id))),
        bind:support.rows.map(v=>v.bind),
        targetSupport:support.rows.map(v=>v.target),
        targetTotal:support.targetTotal,
        poseIndices:[0,payload.poses.length-1],threshold};
    return payload;
}
function runtimeSummary(p,skin,support) {
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
            const overlap=pose.overlap||overlapPixelCenters(pose.posed);
            const failing=pose.areas.filter(v=>v.current<=0&&v.support!=='transparent-only')
                .map(v=>({id:v.id,role:v.kind,area:v.current,ratio:v.ratio}));
            canonical.push({kind,magnitude,inversion:pose.raster.visibleInversion,
                failing,overlap:overlap.multiple,
                targetAlpha:pose.raster.targetAlpha,wholeAlpha:pose.raster.alphaTotal,
                proxyTarget:proxy.targetRatio,proxyWhole:proxy.sourceRatio,
                retention:pose.raster.targetDisplacement/
                    baseline.regions[p.fixture.movingBoneId].displacement,
                remote:pose.raster.remote,
                junction:pose.byRole['JUNCTION:root'],
                sectors:kind==='translation'&&magnitude===60||
                    kind==='rotation'&&magnitude===45?proxy.sectors:undefined,
                areas:pose.areas.map(v=>({id:v.id,area:v.current,ratio:v.ratio,
                    role:v.kind,support:v.support}))});
        }
    return canonical;
}
const prepared=[];
for (const fixture of fixtures) {
    const p=preparePoseAttribution(fixture);
    assert.equal(hash(p),hashes[fixture.id]);
    const W2=createJunctionHarmonicWeights(p.topology,p.context);
    assert.equal(W2.ok,true);
    if (!W2.junctions.length) {
        assert.deepEqual(W2.skinBinding,p.modes.W1);
        prepared.push({fixture:fixture.id,control:'W2 == W1; no optimization'});
        continue;
    }
    assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],
        fixture.id==='branched-skeleton'?[61,80]:[91,132]);
    const junction=systemFor(p,W2),soft=lpSoft(junction);
    const R52=runPrimary(p,W2,junction,soft);
    assert.ok(R52.p2?.feasible);
    const SBW=skinFrom(p,W2,junction,soft.SBW).skin;
    const PEWmin=skinFrom(p,W2,junction,R52.p2.weights).skin;
    const support=sourceSupport(p);
    const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
    const skins={W0:p.modes.W0,W1:p.modes.W1,W2:W2.skinBinding,
        SBW,PEWmin};
    const rows=[];
    for (const [name,skin] of Object.entries(skins)) {
        if (fixture.id==='connected-humanoid'&&name==='SBW') continue;
        for (const kind of ['translation','rotation'])
            for (const magnitude of kind==='translation'?[15,30,60]:[15,30,45]) {
                const runtime=summaryAtPose(p,skin,metadata,kind,magnitude);
                const overlap=runtime.overlap||overlapPixelCenters(runtime.posed);
                const proxy=proxyAtPose(p,skin,runtime.clip,support,runtime.posed);
                rows.push({name,kind,magnitude,inversion:runtime.raster.visibleInversion,
                    overlap:overlap.multiple,
                    targetError:Math.abs(runtime.raster.targetAlpha-proxy.targetRatio),
                    wholeError:Math.abs(runtime.raster.alphaTotal-proxy.sourceRatio)});
            }
    }
    const safe=rows.filter(v=>v.inversion===0&&v.overlap===0);
    assert.ok(safe.length>0);
    const maxTargetError=Math.max(...safe.map(v=>v.targetError));
    const maxWholeError=Math.max(...safe.map(v=>v.wholeError));
    const proxyPassed=maxTargetError<=.025&&maxWholeError<=.015;
    prepared.push({fixture:fixture.id,p,W2,junction,soft,R52,support,
        proxy:{safeSamples:safe.length,maxTargetError,maxWholeError,
            thresholds:{target:.025,whole:.015},passed:proxyPassed}});
}
const branch=prepared.find(v=>v.fixture==='branched-skeleton');
const connected=prepared.find(v=>v.fixture==='connected-humanoid');
const report={proxy:Object.fromEntries([connected,branch].map(v=>[v.fixture,v.proxy])),
    controls:prepared.filter(v=>v.control).map(v=>({fixture:v.fixture,control:v.control}))};
if (!connected.proxy.passed||!branch.proxy.passed) {
    report.classification='E';
    console.log('verify-rig-all-visible-pose-feasibility: PASS (proxy gate stopped solve)');
    console.log(JSON.stringify(report,null,2));
    process.exit(0);
}
for (const entry of [connected,branch]) {
    const system=allVisibleSystemFor(entry.p,entry.W2,entry.junction,entry.support);
    entry.allVisible=system;
    const lp=solve(lpPath,{mode:'alpha',variables:system.variables,
        vertices:system.vertices,triangles:system.triangles,alpha:system.alpha});
    entry.lp=lp;
    report[entry.fixture]={topology:{vertices:entry.p.mesh.vertices.length,
        triangles:entry.p.mesh.triangles.length,fingerprint:hashes[entry.fixture]},
        visible:{count:system.triangles.length,roles:system.roles},
        stage1:{...lp,weights:undefined}};
}
assert.ok(connected.lp.ok&&connected.lp.mStar>0,
    'CONNECTED all-visible LP control must be feasible');
if (!branch.lp.ok) report.classification=branch.lp.status===2?'D':'B';
else if (branch.lp.mStar<=0) report.classification='D';
else {
    for (const entry of [connected,branch]) {
        if (!entry.lp.ok||entry.lp.mStar<=0) continue;
        const p=entry.p,system=entry.allVisible;
        const AVT=skinFrom(p,entry.W2,system,entry.lp.weights).skin;
        const avtRuntime=runtimeSummary(p,AVT,entry.support);
        const avt60=avtRuntime.find(v=>v.kind==='translation'&&v.magnitude===60);
        const translationTransfer=avt60.inversion===0&&avt60.targetAlpha>=.85;
        report[entry.fixture].AVT={canonical:avtRuntime.map(({areas,...v})=>v),
            translationTransfer,
            lpProxyParity:avt60.proxyTarget-entry.lp.targetAlphaGeom};
        report[entry.fixture].stage1.active={total:entry.lp.activeTriangles.length,
            rows:entry.lp.activeTriangles.slice(0,20).map(id=>{
                const area=avt60.areas[id];
                return {id,role:area.role,pose:'translation:60',ratio:area.ratio};
            }),alphaActive:Math.abs(entry.lp.alphaConstraintSlack)<1e-7,
            dominanceActive:system.dominance.filter(([own,sibling])=>
                Math.abs(entry.lp.weights[own]-entry.lp.weights[sibling])<1e-7).length};
        assert.ok(Math.abs(avt60.proxyTarget-entry.lp.targetAlphaGeom)<1e-7);
        if (!translationTransfer) {
            report[entry.fixture].stage2={stopped:'runtime transfer invalid'};
            continue;
        }
        // Reconstruct the frozen R-53 best combined baseline. One known
        // deterministic PEW-min start suffices; this is not an R-54 start.
        const historical=alphaPayload(p,entry.W2,entry.junction,entry.soft,
            entry.support,[5,15,30,45],.85);
        historical.starts=[{name:'R53-PEW-min',weights:entry.R52.p2.weights}];
        historical.runP2=false;
        const r53=solve(nlpPath,historical);
        assert.ok(r53.selected?.feasible);
        const R53Skin=skinFrom(p,entry.W2,entry.junction,r53.selected.weights).skin;
        const r53Runtime=runtimeSummary(p,R53Skin,entry.support);
        report[entry.fixture].R53Baseline={margin:r53.selected.margin,
            failures:r53Runtime.filter(v=>v.failing.length).map(v=>({
                kind:v.kind,magnitude:v.magnitude,triangles:v.failing}))};
        const baselineSkins={W0:p.modes.W0,W1:p.modes.W1,W2:entry.W2.skinBinding,
            SBW:skinFrom(p,entry.W2,entry.junction,entry.soft.SBW).skin,
            PEWmin:skinFrom(p,entry.W2,entry.junction,entry.R52.p2.weights).skin,
            R53:R53Skin};
        report[entry.fixture].baselineLocality=Object.fromEntries(
            Object.entries(baselineSkins).map(([name,skin])=>{
                const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
                return [name,Object.fromEntries([['translation',60],['rotation',45]]
                    .map(([kind,magnitude])=>{
                        const pose=summaryAtPose(p,skin,metadata,kind,magnitude);
                        return [`${kind}:${magnitude}`,pose.raster.remote];
                    }))];
            }));
        let angles=[5,15,30,45],passes=[],final=null;
        for (let cutting=0;cutting<=2;cutting++) {
            const payload=alphaPayload(p,entry.W2,system,entry.soft,
                entry.support,angles,.875);
            payload.starts=[{name:'R53-best',weights:r53.selected.weights},
                {name:'R52-PEW-min',weights:entry.R52.p2.weights},
                {name:'AVT',weights:entry.lp.weights},
                {name:'W2',weights:system.variables.map(v=>v.w2)}];
            payload.runP2=false;
            const solved=solve(nlpPath,payload);
            passes.push({constructionMs:solved.constructionMs,
                starts:solved.starts.map(({weights,...v})=>v),
                selectedStart:solved.selectedStart});
            if (!solved.selected?.feasible||solved.selected.margin<=1e-8) break;
            const skin=skinFrom(p,entry.W2,system,solved.selected.weights).skin;
            const angular=sweep(p,skin,system);
            if (!angular.allFailures.length) {
                final={payload,solved,skin,angular}; break;
            }
            if (cutting===2) break;
            const canonical=new Set(angles);
            const between=angular.allFailures.find(v=>!canonical.has(v.angle));
            if (!between) break;
            angles=[...new Set([...angles,between.angle])].sort((a,b)=>a-b);
        }
        report[entry.fixture].stage2={angles,cuttingPasses:passes.length-1,
            passes,solverWitness:!!final};
        if (!final) continue;
        const p2Payload={...final.payload,starts:[],
            preselected:final.solved.selected.weights,runP2:true};
        const p2=solve(nlpPath,p2Payload).p2;
        report[entry.fixture].stage2.secondary=p2
            ?(({weights,...v})=>v)(p2):null;
        const candidates=[{name:'P1',skin:final.skin,
            solver:final.solved.selected}];
        if (p2?.feasible) candidates.push({name:'AVW',
            skin:skinFrom(p,entry.W2,system,p2.weights).skin,solver:p2});
        report[entry.fixture].candidates=candidates.map(candidate=>{
            const validationStarted=performance.now();
            const canonical=runtimeSummary(p,candidate.skin,entry.support);
            const t=canonical.find(v=>v.kind==='translation'&&v.magnitude===60);
            const r=canonical.find(v=>v.kind==='rotation'&&v.magnitude===45);
            const angular=sweep(p,candidate.skin,system);
            const minAbs=Math.min(...[t,r].flatMap(v=>v.areas
                .filter(a=>a.support!=='transparent-only').map(a=>a.area)));
            const minRatio=Math.min(...[t,r].flatMap(v=>v.areas
                .filter(a=>a.support!=='transparent-only').map(a=>a.ratio)));
            const good=canonical.every(v=>v.inversion===0)
                &&angular.allFailures.length===0
                &&t.targetAlpha>=.85&&r.targetAlpha>=.85
                &&t.retention>=.85&&r.retention>=.85
                &&t.overlap===0&&r.overlap===0;
            const tolerance=1e-9;
            const robustness=minRatio<=100*tolerance?'NUMERICALLY FRAGILE'
                :minRatio<=1000*tolerance?'MARGINAL':'ROBUST NUMERIC MARGIN';
            const target=entry.p.fixture.movingBoneId;
            const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
            const gradientSummary=gradients(metadata,candidate.skin,target);
            const originalFailIds=new Set(r53Runtime.flatMap(v=>
                v.failing.map(item=>item.id)));
            const criticalIds=[...new Set([29,30,31,33,35,37,39,41,
                ...entry.lp.activeTriangles.filter(id=>[31,33,35,39,41].includes(id)),
                ...originalFailIds])].filter(id=>id<p.mesh.triangles.length)
                .sort((a,b)=>a-b);
            const critical=criticalIds.map(id=>({id,
                role:t.areas[id].role,
                translation60A2:t.areas[id].area,
                rotation45A2:r.areas[id].area,
                minimumCanonicalRatio:Math.min(...canonical.map(v=>v.areas[id].ratio)),
                r53Failure:originalFailIds.has(id)}));
            const activeRows=canonical.flatMap(v=>v.areas
                .filter(a=>a.support!=='transparent-only'
                    &&Math.abs(a.ratio-candidate.solver.margin)<1e-5)
                .map(a=>({id:a.id,role:a.role,kind:v.kind,
                    magnitude:v.magnitude,ratio:a.ratio})));
            const sectors=Object.fromEntries([['translation:60',t],['rotation:45',r]]
                .map(([name,v])=>[name,Object.fromEntries(Object.entries(v.sectors)
                    .map(([sector,area])=>[sector,area.bind>0
                        ?area.posed/area.bind:null]))]));
            const weights=system.variables.map(v=>{
                const row=candidate.skin.vertexWeights.find(x=>x.vertexId===v.vertexId);
                return row.influences.find(x=>x.boneId===v.boneId)?.weight||0;
            });
            return {name:candidate.name,good,margin:candidate.solver.margin,
                minimumAbsoluteArea:minAbs,minimumRatio:minRatio,
                tolerance,marginToTolerance:minRatio/tolerance,
                robustness:good?robustness:null,
                sweep:{minimum:angular.allMinimum,
                    failureCount:angular.allFailures.length,step:angular.step},
                boundary:summarizeBoundary(p,system,candidate.skin),
                alphaConstraintActive:{translation:Math.abs(t.proxyTarget-.875)<1e-6,
                    rotation:Math.abs(r.proxyTarget-.875)<1e-6},
                dominanceActive:system.dominance.filter(([own,sibling])=>
                    Math.abs(weights[own]-weights[sibling])<1e-7).length,
                active:{total:activeRows.length,rows:activeRows.slice(0,20)},
                sectors,critical,
                areaDistribution:{translation:areaDistributions(t.areas),
                    rotation:areaDistributions(r.areas)},
                gradients:Object.fromEntries(Object.entries(gradientSummary)
                    .map(([role,stats])=>[role,stats.target])),
                interfaceToChildGradient:interfaceChildGradients(p,system,candidate.skin),
                energy:energy(p,candidate.skin),
                rootAndBrush:rootAndBrush(p,candidate.skin,system),
                runtimeValidationMs:performance.now()-validationStarted,
                canonical:canonical.map(({areas,...v})=>v)};
        });
    }
    const branchStage=report['branched-skeleton'];
    if (branchStage.stage2?.stopped) report.classification='E';
    else if (branchStage.candidates?.some(v=>v.good)) {
        const accepted=branchStage.candidates.find(v=>v.good);
        report.classification=accepted.robustness==='NUMERICALLY FRAGILE'?'F':'A';
    } else report.classification='B';
}
console.log('verify-rig-all-visible-pose-feasibility: PASS');
console.log(JSON.stringify(report,null,2));
