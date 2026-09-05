/** Current external index: local route coverage, no archived review material; no network claim. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(repositoryRoot, 'Claude_GPT_Review/GITHUB.txt'), 'utf8');
const prefix = 'https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/';
const urls = [...source.matchAll(/https:\/\/[^\s<>"'`]+/gu)].map(match => match[0]);
assert.equal(new Set(urls).size, urls.length, 'duplicate URL');
assert(urls.length > 0, 'empty index');
const targets = new Set();
for (const url of urls) {
    assert(url.startsWith(prefix), `unexpected URL prefix: ${url}`);
    const relative = decodeURIComponent(url.slice(prefix.length));
    const absolute = path.resolve(repositoryRoot, relative);
    const canonical = path.relative(repositoryRoot, absolute).split(path.sep).join('/');
    assert(!path.isAbsolute(canonical) && !canonical.startsWith('../'), 'path escapes repository');
    assert(!/(^|\/)(Archive|Review|Claude_GPT_Review|Backup|PastFiles|Backup-tegaki_work|node_modules|dist)(\/|$)/.test(canonical), `excluded route: ${canonical}`);
    assert(/^(AGENTS\.md|README\.md|docs\/|tegaki_work\/)/.test(canonical), `out-of-scope route: ${canonical}`);
    assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `missing local target: ${canonical}`);
    targets.add(canonical);
}
const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'docs/harness.json'), 'utf8'));
for (const required of ['AGENTS.md', 'docs/README.md', 'docs/STATUS.md', 'docs/PRODUCT.md',
    'docs/TECHNICAL.md', 'docs/ARCHITECTURE.md', 'docs/VOCABULARY.md', 'docs/ROADMAP.md',
    'docs/DEVELOPMENT.md', 'docs/harness.json', 'tegaki_work/package.json',
    ...manifest.packages.map(item => item.document)]) {
    assert(targets.has(required), `missing current route: ${required}`);
}
console.log(`verify-github-url-index: ${urls.length} unique current local targets OK; remote publication not tested`);
