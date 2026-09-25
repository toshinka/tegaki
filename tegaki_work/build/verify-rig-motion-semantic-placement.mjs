import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const frame = fs.readFileSync(path.join(workRoot, 'ui/right-workspace-frame.js'), 'utf8');
const surface = fs.readFileSync(
    path.join(workRoot, 'styles/components/layer-panel-surface.css'), 'utf8'
);

assert.match(frame,
    /this\.rigLensStructureContent\.appendChild\(artwork\);[\s\S]*?appendChild\(this\.rigStructureEditButton\);[\s\S]*?this\.rigCompactBoneTree = null;[\s\S]*?appendChild\(list\)/u,
    'structure overview utility precedes the selectable Bone list');
assert.match(frame,
    /this\.rigStructureEditButton\.className = 'gui-control gui-control--s right-workspace-rig-structure-open'/u,
    'structure overview remains a compact secondary control');
assert.match(frame,
    /this\.rigStructureEditButton\.hidden = isMotion \|\| !matchesTarget \|\| !canOpenStructure/u,
    'the existing mode/target visibility predicate is unchanged by the relocation');
assert.match(frame,
    /_openRigStructureEditor\(\) \{\s*if \(!this\.rigLensActive \|\| this\.rigAuthoringKind !== 'deform'\s*\|\| this\.rigLensMode !== 'setup'/u,
    'the existing SETUP-only structure editor contract remains intact');

const frameNavigationSource = frame.slice(
    frame.indexOf('    _renderRigFrameNavigation({'),
    frame.indexOf('    _registerRigPart()', frame.indexOf('    _renderRigFrameNavigation({'))
);
assert.match(frameNavigationSource,
    /keepFrameNumberWithKey = false/u,
    'the shared navigation preserves its existing default for PART');
assert.match(frameNavigationSource,
    /this\.rigPartFrameLabel\.hidden = !!commit && !keepFrameNumberWithKey/u,
    'the current Frame label stays visible only for the opted-in DEFORM layout');
assert.match(frameNavigationSource,
    /if \(keepFrameNumberWithKey\) controls\.push\(this\.rigPartFrameLabel\);[\s\S]*?controls\.push\(this\.rigPartFrameNext\);[\s\S]*?if \(keepFrameNumberWithKey && !this\.rigFrameKeyGroup\.hidden\) controls\.push\(this\.rigFrameKeyGroup\)/u,
    'DEFORM keeps the Frame number and projects KEY state/actions in the same row');
assert.match(frameNavigationSource,
    /keepFrameNumberWithKey\s*\?\s*'◆ KEY確定'\s*:/u,
    'the explicit action is labeled as KEY confirmation, not a duplicate Frame label');
assert.match(frame,
    /this\.rigKeyButton\.addEventListener\('click', \(\) => this\._commitRigPose\(\)\)/u,
    'the existing Motion KEY handler remains the sole button terminal');
assert.match(frame,
    /this\.rigKeyButton\.hidden = !isMotion \|\| !boneDraftMatches/u,
    'the explicit button remains conditional on a matching Motion draft');
assert.match(frame,
    /authoringKind: 'deform'[\s\S]*?keepFrameNumberWithKey: true/u,
    'only the DEFORM navigation opts to keep the Frame number beside the KEY button');
assert.doesNotMatch(frame.slice(
    frame.indexOf('    _renderRigPartLens(target, partTarget)'),
    frame.indexOf('    _mountModeSwitch()')
), /keepFrameNumberWithKey/u, 'PART Frame layout does not opt into the DEFORM placement');

assert.match(surface,
    /\.right-workspace-rig-frame-navigation\.has-frame-key\s*\{[\s\S]*?grid-template-columns: 24px minmax\(20px, 1fr\) 24px minmax\(54px, max-content\)/u,
    'DEFORM reserves a compact fourth slot for explicit KEY confirmation');
assert.match(surface,
    /\.right-workspace-rig-frame-navigation\.has-frame-key\.has-pose-cancel\s*\{[\s\S]*?26px/u,
    'pending Pose cancel remains a separate control slot');

console.log('PASS: structure utility order, DEFORM Frame/KEY placement, conditional visibility, and PART layout boundary');
