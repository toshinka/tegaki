/**
 * ROLE: Current-document routing checks and deterministic verifier selection.
 * AUTHORITY: docs/harness.json owns routes/package status; production state is untouched.
 * INVARIANTS: fixed work CWD; no shell commands, network, fixture-write flags or archive scans.
 * RELATED: docs/DEVELOPMENT.md. Source checks are not Browser or pixel acceptance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const repoRoot = path.dirname(workRoot);
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs/harness.json'), 'utf8'));
const excluded = /(^|\/)(Backup|PastFiles|Backup-tegaki_work|ComfyUIPortable|EasyReforgeExtension|RegionalLoRALab)(\/|$)/;

function repositoryFile(relative) {
    assert.equal(typeof relative, 'string', 'route must be a string');
    const absolute = path.resolve(repoRoot, relative);
    const normalized = path.relative(repoRoot, absolute).split(path.sep).join('/');
    assert(normalized && !normalized.startsWith('../') && !path.isAbsolute(normalized), `route escapes repo: ${relative}`);
    assert(!excluded.test(normalized), `route targets excluded area: ${relative}`);
    assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `missing file: ${relative}`);
    return absolute;
}

function verifierFiles() {
    return fs.readdirSync(buildRoot).filter(name => /^verify-[a-z0-9-]+\.mjs$/.test(name)).sort();
}

function validateManifest(value) {
    assert.equal(value.version, 1, 'unsupported manifest version');
    assert(value.documents.includes(value.checkpoint), 'checkpoint must be registered');
    assert.equal(new Set(value.documents).size, value.documents.length, 'duplicate documents');
    value.documents.forEach(repositoryFile);
    const ids = new Set(value.packages.map(item => item.id));
    assert.equal(ids.size, value.packages.length, 'duplicate package IDs');
    const byId = new Map(value.packages.map(item => [item.id, item]));
    for (const item of value.packages) {
        assert(/^WP-\d{3}$/.test(item.id), `invalid package ID: ${item.id}`);
        assert(['READY', 'BLOCKED', 'ACTIVE', 'VERIFIED', 'DONE'].includes(item.status), `invalid package status: ${item.id}`);
        const body = fs.readFileSync(repositoryFile(item.document), 'utf8');
        assert(body.includes(item.id), `package document ID mismatch: ${item.id}`);
        for (const field of ['Goal', 'Scope', 'Contract', 'Tasks', 'Acceptance', 'Verification', 'Stop', 'Completion']) {
            assert(body.includes(`## ${field}\n`) || body.includes(`## ${field}\r\n`), `${item.id}: missing ${field}`);
        }
        for (const id of item.dependsOn) {
            assert(ids.has(id) && id !== item.id, `${item.id}: invalid dependency ${id}`);
            if (['READY', 'ACTIVE'].includes(item.status)) assert.equal(byId.get(id).status, 'DONE', `${item.id}: dependency ${id} is not DONE`);
        }
    }
    const visited = new Set();
    const visit = (id, stack = new Set()) => {
        assert(!stack.has(id), `dependency cycle: ${id}`);
        if (visited.has(id)) return;
        const next = new Set(stack).add(id);
        byId.get(id).dependsOn.forEach(child => visit(child, next));
        visited.add(id);
    };
    ids.forEach(id => visit(id));
    const available = verifierFiles();
    for (const [name, domain] of Object.entries(value.domains)) {
        repositoryFile(domain.architecture);
        domain.entrypoints.forEach(repositoryFile);
        for (const expression of domain.patterns) {
            assert(expression.startsWith('^verify-'), `unscoped verifier pattern: ${name}`);
            assert(available.some(file => new RegExp(expression).test(file)), `empty verifier pattern: ${name} ${expression}`);
        }
    }
}

const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').trim().replace(/\s/g, '-');
function checkLinks(documents) {
    let links = 0;
    for (const document of documents) {
        const file = repositoryFile(document);
        const body = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
        for (const match of body.matchAll(/\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
            const target = match[1] || match[2];
            if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
            const [relative, fragment] = target.split('#');
            const absolute = relative ? path.resolve(path.dirname(file), decodeURIComponent(relative)) : file;
            const rel = path.relative(repoRoot, absolute);
            repositoryFile(rel);
            if (fragment && absolute.endsWith('.md')) {
                const headings = [...fs.readFileSync(absolute, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(item => slug(item[1]));
                assert(headings.includes(decodeURIComponent(fragment)), `${document}: missing anchor ${target}`);
            }
            links++;
        }
    }
    return links;
}

function check() {
    validateManifest(manifest);
    const documents = [...new Set([...manifest.documents, ...manifest.packages.map(item => item.document)])];
    const links = checkLinks(documents);
    const register = fs.readFileSync(repositoryFile('docs/DOCUMENT_REGISTER.md'), 'utf8');
    const proposalRoot = path.join(repoRoot, '開発用資料保管庫/proposals');
    const proposals = fs.readdirSync(proposalRoot, { withFileTypes: true }).filter(item => item.isFile() && item.name.endsWith('.md'));
    for (const { name } of proposals) {
        assert(register.includes(`\`${name}\``), `unregistered proposal: ${name}`);
        const intro = fs.readFileSync(path.join(proposalRoot, name), 'utf8').slice(0, 600);
        if (name !== 'UI_CSSスタイルガイド.md') assert(/状態: (REFERENCE|SUPERSEDED)/.test(intro), `proposal lacks state: ${name}`);
    }
    console.log(`harness check: ${documents.length} documents, ${links} local links, ${proposals.length} proposals, ${manifest.packages.length} packages OK`);
}

function selection(suite) {
    if (suite === 'all') return verifierFiles();
    const domain = manifest.domains[suite];
    assert(domain, `unknown suite ${suite}; available: all, ${Object.keys(manifest.domains).join(', ')}`);
    const patterns = domain.patterns.map(expression => new RegExp(expression));
    return verifierFiles().filter(file => patterns.some(pattern => pattern.test(file)));
}

function kind(name) {
    const text = fs.readFileSync(path.join(buildRoot, name), 'utf8');
    return /(?:from\s*|import\s*\()\s*['"][^'"]*(?:system|ui|coordinate|core|config)|new Function\s*\(/.test(text)
        ? 'code-execution-candidate (may include mocks)'
        : 'source/document-candidate';
}

const [command = 'check', suite = 'all'] = process.argv.slice(2);
try {
    if (command === 'check') check();
    else if (command === 'self-test') {
        validateManifest(manifest);
        assert.throws(() => repositoryFile('../outside.md'));
        assert.throws(() => repositoryFile('ComfyUIPortable/anything.md'));
        const duplicate = structuredClone(manifest);
        duplicate.packages.push(duplicate.packages[0]);
        assert.throws(() => validateManifest(duplicate), /duplicate package/);
        const blocked = structuredClone(manifest);
        blocked.packages.at(-1).status = 'READY';
        assert.throws(() => validateManifest(blocked), /not DONE/);
        assert.throws(() => selection('unknown-suite'));
        console.log('harness self-test: invalid routes, duplicate packages, unmet prerequisites and unknown suites rejected');
    } else if (command === 'list' || command === 'test') {
        validateManifest(manifest);
        const files = selection(suite);
        assert(files.length > 0, 'empty test selection');
        let failed = 0;
        for (const file of files) {
            const label = kind(file);
            if (command === 'list') { console.log(`${file} | ${label}`); continue; }
            const started = Date.now();
            const result = spawnSync(process.execPath, [path.join(buildRoot, file)], {
                cwd: workRoot, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024, windowsHide: true
            });
            const passed = result.status === 0 && !result.error;
            console.log(`${passed ? 'PASS' : 'FAIL'} ${file} (${Date.now() - started}ms) | ${label}`);
            if (!passed) {
                failed++;
                console.error(result.error?.message || `${result.stdout}\n${result.stderr}`);
            }
        }
        console.log(`${command}: ${files.length} selected, ${failed} failed; Browser/Owner acceptance not included`);
        if (failed) process.exitCode = 1;
    } else throw new Error('usage: development-harness.mjs check | self-test | list [suite] | test [suite]');
} catch (error) {
    console.error(`harness: ${error.message}`);
    process.exitCode = 1;
}
