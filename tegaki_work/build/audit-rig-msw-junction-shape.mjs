// R-61 diagnostic: one canonical MSW T60 Junction shape attribution pass.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtures } from './verify-rig-hybrid-domain-patch.mjs';
import { preparePoseAttribution, roleMetadata, summaryAtPose }
    from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights } from './junction-harmonic-weight-diagnostic.mjs';
import { hashes, hash, systemFor, skinFrom }
    from './verify-rig-pose-envelope-feasibility.mjs';
import { sourceSupport } from './alpha-area-support-diagnostic.mjs';
import { allVisibleSystemFor } from './all-visible-pose-diagnostic.mjs';

const path=process.argv[2];
assert.ok(path,'pass the saved R-60 verifier output path');
const raw=readFileSync(path,'utf8');
assert.ok(raw.startsWith('verify-rig-weight-direction-boundary: PASS'));
const r60=JSON.parse(raw.slice(raw.indexOf('{')));
assert.ok(r60.largestStablePass?.pass&&Array.isArray(r60.mswWeights));
const fixture=fixtures.find(v=>v.id==='branched-skeleton');
const p=preparePoseAttribution(fixture);
assert.equal(hash(p),hashes[fixture.id]);
assert.equal(r60.topology.fingerprint,hashes[fixture.id]);
const W2=createJunctionHarmonicWeights(p.topology,p.context);
assert.equal(W2.ok,true);
const junction=systemFor(p,W2);
const support=sourceSupport(p);
const system=allVisibleSystemFor(p,W2,junction,support);
const skin=skinFrom(p,W2,system,r60.mswWeights).skin;
const pose=summaryAtPose(p,skin,roleMetadata(p.mesh,p.topology.diagnostic),
    'translation',60);
assert.ok(Math.abs(pose.raster.alphaTotal-
    r60.largestStablePass.translation.wholeAlpha)<1e-9);
const byId=new Map(pose.posed.vertices.map(v=>[v.vertexId,v]));
const rows=p.mesh.triangles.map((triangle,id)=>{
    const vertices=triangle.map(vertexId=>byId.get(vertexId));
    const centroid={x:vertices.reduce((s,v)=>s+v.x,0)/3,
        y:vertices.reduce((s,v)=>s+v.y,0)/3};
    return {id,role:support.rows[id].role,source:support.rows[id].source,
        triangle,centroid,ratio:pose.areas[id].ratio,
        signedArea:pose.areas[id].current,
        bounds:{minX:Math.min(...vertices.map(v=>v.x)),
            maxX:Math.max(...vertices.map(v=>v.x)),
            minY:Math.min(...vertices.map(v=>v.y)),
            maxY:Math.max(...vertices.map(v=>v.y))}};
}).filter(v=>v.role==='JUNCTION:root'&&v.source>0);
assert.ok(rows.length>0);
const ratios=rows.map(v=>v.ratio).sort((a,b)=>a-b);
const rank=q=>ratios[Math.min(ratios.length-1,Math.round((ratios.length-1)*q))];
const fieldDistribution=weights=>{
    const fieldSkin=skinFrom(p,W2,system,weights).skin;
    const field=summaryAtPose(p,fieldSkin,
        roleMetadata(p.mesh,p.topology.diagnostic),'translation',60);
    const values=rows.map(v=>field.areas[v.id].ratio).sort((a,b)=>a-b);
    const at=q=>values[Math.min(values.length-1,
        Math.round((values.length-1)*q))];
    return {min:values[0],p10:at(.1),median:at(.5),
        p90:at(.9),max:values.at(-1)};
};
const report={topology:r60.topology,lambda:r60.largestStablePass.lambda,
    t60WholeAlpha:pose.raster.alphaTotal,junctionTriangleCount:rows.length,
    distribution:{min:ratios[0],p10:rank(.1),median:rank(.5),
        p90:rank(.9),max:ratios.at(-1)},
    comparisonDistributions:r60.avwWeights&&r60.apwWeights
        ?{AVW:fieldDistribution(r60.avwWeights),
            APW:fieldDistribution(r60.apwWeights)}:null,
    triangles:rows.sort((a,b)=>a.centroid.y-b.centroid.y||a.centroid.x-b.centroid.x)};
console.log('audit-rig-msw-junction-shape: PASS');
console.log(JSON.stringify(report,null,2));
