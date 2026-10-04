/** WP-028 bounded FontComparison information/samples UI contract. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const comparison = await readFile(new URL('../ui/font-comparison.js', import.meta.url), 'utf8');
const balloon = await readFile(new URL('../ui/balloon-popup.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles/components/panel-layout-popup.css', import.meta.url), 'utf8');

assert.match(comparison, /constructor\(\{ container, getLoadedFont, warmFonts, onCommit, onClose, onMove(?:, [^}]+)? \}/);
assert.match(comparison, /data-mode="samples"[^>]*>見本比較/);
assert.match(comparison, /data-mode="information"[^>]*>情報・整理/);
assert.match(comparison, /setMode\(mode\)/);
assert.match(comparison, /attachInformation\(element\)/);
assert.match(comparison, /setTargetLabel\(label\)/);
assert.match(comparison, /this\._mode === 'information'\) this\.onMove\(placement\)/);
assert.match(comparison, /canMove: this\._mode === 'information' && row\.canMove !== false/);
assert.match(comparison, /if \(this\._mode !== 'samples'\) return;/);

assert.match(balloon, /data-role="font-comparison-toggle"[^>]*>書体/);
assert.doesNotMatch(balloon, /<button[^>]*data-role="font-information-toggle"/);
assert.match(balloon, /onMove: \(placement\) => this\._moveOrganizationNode\(placement\)/);
assert.match(balloon, /this\.fontComparison\.attachInformation\(this\.elements\.fontCard\)/);
assert.match(balloon, /data-role="font-manager" open/);
assert.match(balloon, /data-role="font-organization" open/);
assert.match(balloon, /setTargetLabel\(selected\?\.label \|\| ''\)/);

assert.match(styles, /\.pl-font-comparison__tabs/);
assert.match(styles, /\.pl-font-comparison__information/);
assert.match(styles, /\.pl-font-card\[data-font-comparison-mounted\] > summary \{ display: none; \}/);
assert.match(styles, /\.pl-font-information-toggle/);

console.log('font comparison information verifier: samples/information tabs, mounted detail card, target label, and information-only D&D contract PASS');
