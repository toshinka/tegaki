// R-61 diagnostic only: render exact MSW/JBW from saved verifier results.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fixtures } from './verify-rig-hybrid-domain-patch.mjs';
import { preparePoseAttribution } from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights } from './junction-harmonic-weight-diagnostic.mjs';
import { hashes, hash, systemFor, skinFrom }
    from './verify-rig-pose-envelope-feasibility.mjs';
import { sourceSupport } from './alpha-area-support-diagnostic.mjs';
import { allVisibleSystemFor } from './all-visible-pose-diagnostic.mjs';
import { writeCanonicalJunctionBalanceComparison } from './r54-avw-visualizer.mjs';

const [r60Path,r61Path]=process.argv.slice(2);
assert.ok(r60Path&&r61Path,'pass saved R-60 and R-61 verifier reports');
function readReport(path,prefix) {
    const raw=readFileSync(path,'utf8');
    assert.ok(raw.startsWith(prefix));
    return JSON.parse(raw.slice(raw.indexOf('{')));
}
const r60=readReport(r60Path,'verify-rig-weight-direction-boundary: PASS');
const r61=readReport(r61Path,'verify-rig-junction-shape-balance: PASS');
assert.equal(r61.technicalClassification,'JBW_FEASIBLE');
assert.equal(r60.largestStablePass.lambda,r61.mswLambda);
assert.ok(Array.isArray(r60.mswWeights)&&Array.isArray(r61.jbwWeights));
const fixture=fixtures.find(v=>v.id==='branched-skeleton');
const p=preparePoseAttribution(fixture);
assert.equal(hash(p),hashes[fixture.id]);
assert.equal(r61.topology.fingerprint,hashes[fixture.id]);
const W2=createJunctionHarmonicWeights(p.topology,p.context);
assert.equal(W2.ok,true);
const junction=systemFor(p,W2);
const system=allVisibleSystemFor(p,W2,junction,sourceSupport(p));
const mswSkin=skinFrom(p,W2,system,r60.mswWeights).skin;
const jbwSkin=skinFrom(p,W2,system,r61.jbwWeights).skin;
const written=writeCanonicalJunctionBalanceComparison(p,mswSkin,jbwSkin,{
    fingerprint:hashes[fixture.id],msw:r61.msw,jbw:r61.candidate});
const htmlHash=createHash('sha256').update(readFileSync(written.outputPath))
    .digest('hex');
console.log('generate-rig-junction-balance-comparison: PASS');
console.log(JSON.stringify({html:written.outputPath,htmlHash,
    topology:written.payload.topology,
    hashes:{msw:written.payload.mswHash,jbw:written.payload.jbwHash},
    panels:written.payload.states.map(v=>v.label),
    msw:{T60:r61.msw.translation,R45:r61.msw.rotation},
    jbw:{T60:r61.candidate.translation,R45:r61.candidate.rotation},
    sameJbwSkinBinding:true},null,2));
