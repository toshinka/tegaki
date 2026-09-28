// R-59 diagnostic only: reproduce the R-58 witness and present CPU rasters.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixtures } from './verify-rig-hybrid-domain-patch.mjs';
import { preparePoseAttribution } from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights } from './junction-harmonic-weight-diagnostic.mjs';
import { hashes, hash, systemFor, lpSoft, skinFrom } from './verify-rig-pose-envelope-feasibility.mjs';
import { sourceSupport } from './alpha-area-support-diagnostic.mjs';
import { allVisibleSystemFor } from './all-visible-pose-diagnostic.mjs';
import { writeCanonicalWeightComparison } from './r54-avw-visualizer.mjs';

const verifier=fileURLToPath(new URL('./verify-rig-area-preservation-feasibility.mjs',
    import.meta.url));
const result=spawnSync(process.execPath,[verifier,'--emit-weights'],{
    encoding:'utf8',maxBuffer:16*1024*1024,timeout:180000});
assert.equal(result.status,0,result.stderr||`R-58 verifier exited ${result.status}`);
assert.ok(result.stdout.startsWith('verify-rig-area-preservation-feasibility: PASS'));
const report=JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
assert.equal(report.classification,'A');
assert.equal(report.sameSkinBindingPerPose,true);
assert.ok(Array.isArray(report.avwWeights)&&Array.isArray(report.apwWeights));
const apw=report.phaseB.selectedWitness===report.phaseB.nearBaselineSafetyWitness?.label
    ?report.phaseB.nearBaselineSafetyWitness:report.phaseB.runtime;
assert.ok(apw?.safe);
const fixture=fixtures.find(v=>v.id==='branched-skeleton');
const p=preparePoseAttribution(fixture);
assert.equal(hash(p),hashes[fixture.id]);
assert.equal(report.topology.fingerprint,hashes[fixture.id]);
assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],[61,80]);
const W2=createJunctionHarmonicWeights(p.topology,p.context);
assert.equal(W2.ok,true);
const junction=systemFor(p,W2),soft=lpSoft(junction);
assert.ok(soft);
const system=allVisibleSystemFor(p,W2,junction,sourceSupport(p));
const avwSkin=skinFrom(p,W2,system,report.avwWeights).skin;
const apwSkin=skinFrom(p,W2,system,report.apwWeights).skin;
const written=writeCanonicalWeightComparison(p,avwSkin,apwSkin,{
    fingerprint:hashes[fixture.id],avw:report.baseline,apw});
const htmlHash=createHash('sha256').update(readFileSync(written.outputPath)).digest('hex');
console.log('generate-rig-avw-apw-comparison: PASS');
console.log(JSON.stringify({html:written.outputPath,htmlHash,
    topology:written.payload.topology,avwHash:written.payload.avwHash,
    apwHash:written.payload.apwHash,
    panels:written.payload.states.map(v=>v.label),
    avw:{T60:report.baseline.translation,R45:report.baseline.rotation},
    apw:{T60:apw.translation,R45:apw.rotation},
    sameApwSkinBinding:true},null,2));
