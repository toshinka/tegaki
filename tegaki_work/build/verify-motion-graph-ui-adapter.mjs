import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(source, /createMotionGraphViewModel\(/, 'UI adapter reads the pure Motion Graph view model');
assert.equal(source.split('id="anim-motion-graph-btn"').length - 1, 1, 'Motion Graph action remains unique');
assert.equal(source.split('id = \'animation-motion-graph-window\'').length - 1, 1, 'Motion Graph window remains unique');
assert.match(source, /_syncMotionGraphPanel\(motionState\);/);
assert.match(source, /_setMotionGraphWindowOpen\(this\.motionGraphPanel\?\.style\.display === 'none'\)/);
assert.match(source, /_setupMotionGraphEvents\(\);/);
assert.match(source, /this\.isPlaying \? this\._motionPlaybackClipId : null/);
assert.match(source, /const canOpen = !!this\._getMotionGraphViewModel\(state\)/);
assert.match(source, /if \(!canOpen && wasOpen\) panel\.style\.display = 'none'/);
assert.match(source, /if \(view\.cursor\.inRange\) \{/);
assert.match(source, /'OUT OF CLIP'/);
assert.match(source, /anim-motion-graph-window popup-panel--translucent transform-popup-shell ui-scrollbar/);
for (const group of ['position', 'scale', 'rotation', 'opacity', 'blend']) {
    assert.match(source, new RegExp(`data-motion-graph-group=\\"\\$\\{group\\.id\\}"`));
}

const graphSyncStart = source.indexOf('    _syncMotionGraphPanel(');
const graphSyncEnd = source.indexOf('    _setMotionGraphWindowOpen(', graphSyncStart);
assert.ok(graphSyncStart >= 0 && graphSyncEnd > graphSyncStart);
const graphSync = source.slice(graphSyncStart, graphSyncEnd);
assert.doesNotMatch(graphSync, /setClipTransformKeyframes|updateClipTransformKeyframes|_recordTimelineHistory|_captureTimelineHistoryState/);
assert.doesNotMatch(graphSync, /button\.title\s*=/, 'Graph button keeps the shared Futaba tooltip instead of native title');
assert.match(graphSync, /button\.dataset\.tooltip/);
assert.match(graphSync, /plot\.replaceChildren\(\)/);
assert.match(graphSync, /data-motion-graph-cursor/);
assert.match(css, /\.anim-motion-graph-window\s*\{/);
assert.match(css, /\.anim-motion-graph-window\s*\{[\s\S]*?left:\s*max\(8px,\s*calc\(50%\s*-\s*270px\)\)/);
assert.match(css, /\.anim-motion-graph-window\s*\{[\s\S]*?max-height:\s*calc\(76vh\s*-\s*8px\)/);
assert.match(css, /\.anim-motion-graph-path\.is-primary\s*\{[\s\S]*?var\(--active-border\)/);
assert.match(css, /\.anim-motion-graph-path\.is-secondary\s*\{[\s\S]*?var\(--futaba-maroon\)/);

console.log('verify-motion-graph-ui-adapter: read-only Graph wiring, groups, cursor, and palette styles OK');
