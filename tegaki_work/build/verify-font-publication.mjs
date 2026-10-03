import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originals = /\.(?:ttf|otf|woff2?|ttc|zip|7z)$/i;
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), `public font symlink: ${full}`);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const directories = [path.join(root,'public','fonts')];
if (!process.argv.includes('--public-only')) directories.push(path.join(root,'dist','fonts'));
for (const dir of directories) {
  const files = walk(dir);
  assert.deepEqual(files.filter(file => originals.test(file)), [], `original font/archive leaked into ${dir}`);
}
const catalog = JSON.parse(fs.readFileSync(path.join(root,'public','fonts','catalog.json'),'utf8'));
assert.ok(catalog.fonts.length >= 27);
for (const font of catalog.fonts) {
  assert.equal(font.external, true, font.id);
  assert.ok(font.file.startsWith(`Library/${font.id}/`));
  assert.ok(!font.file.split('/').includes('..'));
  assert.match(font.sha256, /^[a-f0-9]{64}$/);
}
assert.equal(catalog.primaryId, 'bundled-genei-antique');
assert.equal(catalog.organization.placements['bundled-genei-antique'],null);
console.log(`font publication PASS: ${catalog.fonts.length} metadata-only external references; checked directories contain no originals`);
