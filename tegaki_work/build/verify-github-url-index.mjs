/** Deterministically verifies GitHubURL.txt HTTPS and local Raw URL coverage. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const workRoot = path.resolve(process.cwd());
const repositoryRoot = path.resolve(workRoot, '..');
const rawPrefix = 'https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/';
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const normalizeUrl = (url) => url.replace(/[.,;]+$/u, '');
const source = fs.readFileSync(path.join(workRoot, 'GitHubURL.txt'), 'utf8');
const urls = [...source.matchAll(/https:\/\/[^\s<>"'`]+/gu)]
    .map((match) => normalizeUrl(match[0]));

const uniqueUrls = new Set(urls);
assert(uniqueUrls.size === urls.length, 'GitHubURL.txt contains duplicate HTTPS URLs');

const currentPhaseDirectory = path.join(repositoryRoot, 'task-codex');
const currentPhaseFiles = fs.readdirSync(currentPhaseDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^phase.*\.md$/u.test(entry.name));
assert(
    currentPhaseFiles.length === 1,
    `expected exactly one current task-codex/phase*.md file, found ${currentPhaseFiles.length}`
);

const currentPhaseRelativePath = path.relative(
    repositoryRoot,
    path.join(currentPhaseDirectory, currentPhaseFiles[0].name)
).split(path.sep).join('/');
const currentPhaseUrl = `${rawPrefix}${currentPhaseRelativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
assert(
    uniqueUrls.has(currentPhaseUrl),
    `GitHubURL.txt is missing the current phase Raw URL: ${currentPhaseUrl}`
);

const excludedRelativeRoots = [
    'Backup',
    'PastFiles',
    '開発用資料保管庫/Backup-tegaki_work',
    '開発用資料保管庫/proposals/過去計画（アイデアのサルベージ時に使う。基本読み込まない）'
];
const toRepositoryRelativePath = (absolutePath) => path.relative(
    repositoryRoot,
    absolutePath
).split(path.sep).join('/');
const isExcludedPath = (relativePath) => excludedRelativeRoots.some(
    (excludedRoot) => relativePath === excludedRoot || relativePath.startsWith(`${excludedRoot}/`)
);
const isWithinRoot = (absolutePath) => {
    const relativePath = path.relative(repositoryRoot, absolutePath);
    return relativePath === ''
        || (!path.isAbsolute(relativePath)
            && relativePath !== '..'
            && !relativePath.startsWith(`..${path.sep}`));
};

const rawUrls = urls.filter((url) => url.startsWith(rawPrefix));
const missingLocalPaths = [];
for (const url of rawUrls) {
    const encodedRelativePath = url.slice(rawPrefix.length);
    let decodedRelativePath;
    try {
        decodedRelativePath = decodeURIComponent(encodedRelativePath);
    } catch {
        throw new Error(`Raw URL path is not valid percent-encoding: ${url}`);
    }

    assert(decodedRelativePath.length > 0, `Raw URL has an empty local path: ${url}`);
    const localPath = path.resolve(repositoryRoot, decodedRelativePath);
    assert(isWithinRoot(localPath), `Raw URL escapes the repository root: ${url}`);

    const repositoryRelativePath = toRepositoryRelativePath(localPath);
    assert(
        !isExcludedPath(repositoryRelativePath),
        `Raw URL targets an excluded path: ${url}`
    );

    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
        missingLocalPaths.push(repositoryRelativePath);
    }
}

assert(
    missingLocalPaths.length === 0,
    `GitHubURL.txt has missing local Raw targets: ${missingLocalPaths.join(', ')}`
);

console.log(
    `verify-github-url-index: HTTPS total=${urls.length}, Raw total=${rawUrls.length}, `
    + `duplicates=${urls.length - uniqueUrls.size}, local missing=${missingLocalPaths.length}`
);
