import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd());
const readJson = (relativePath) => JSON.parse(
    fs.readFileSync(path.join(root, relativePath), 'utf8')
);
const readText = (relativePath) => fs.readFileSync(
    path.join(root, relativePath),
    'utf8'
);
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};
const collectSourceFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(absolutePath);
        return entry.isFile() && /\.(?:js|mjs)$/.test(entry.name) ? [absolutePath] : [];
    });

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const installedPackage = readJson('node_modules/pixi.js/package.json');
const coreInitializer = readText('core-initializer.js');
const pixiSkillRoot = path.join(root, 'node_modules/pixi.js/skills');

assert(
    packageJson.dependencies?.['pixi.js'] === '8.19.0',
    'package.json must pin pixi.js to exactly 8.19.0'
);
assert(
    packageLock.packages?.['']?.dependencies?.['pixi.js'] === '8.19.0',
    'package-lock root dependency must pin pixi.js to exactly 8.19.0'
);
assert(
    packageLock.packages?.['node_modules/pixi.js']?.version === '8.19.0',
    'package-lock installed pixi.js entry must be 8.19.0'
);
assert(
    packageLock.packages?.['node_modules/parse-svg-path']?.version === '0.2.0',
    'package-lock must retain the PixiJS 8.19 parse-svg-path dependency'
);
assert(installedPackage.version === '8.19.0', 'installed pixi.js must be 8.19.0');
assert(
    coreInitializer.includes('version: `v${PIXI.VERSION}-esm`'),
    'core:ready must report the actual PixiJS VERSION instead of a handwritten version'
);
assert(
    coreInitializer.includes('const app = new PIXI.Application();')
        && coreInitializer.includes('await app.init({')
        && coreInitializer.includes('document.body.appendChild(app.canvas);'),
    'Application must keep the PixiJS v8 async init and app.canvas contract'
);
assert(
    !coreInitializer.includes('pixi.js/html-source'),
    'PixiJS HTML source is outside Phase 7s and must remain opt-in'
);
assert(
    !coreInitializer.includes('preference:'),
    'Phase 7s must not change the existing renderer preference / fallback order'
);

const projectSourceFiles = [
    ...fs.readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.js$/.test(entry.name))
        .map((entry) => path.join(root, entry.name)),
    ...collectSourceFiles(path.join(root, 'system')),
    ...collectSourceFiles(path.join(root, 'ui'))
];
const affectedPixiExports = new Set([
    'FillPattern',
    'ParticleContainer',
    'Text',
    'HTMLText',
    'BitmapText'
]);
for (const sourceFile of projectSourceFiles) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    const relativePath = path.relative(root, sourceFile);
    assert(
        !source.includes('pixi.js/html-source'),
        `PixiJS HTML source remains outside Phase 7s: ${relativePath}`
    );
    for (const match of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]pixi\.js['"]/g)) {
        const importedNames = match[1]
            .split(',')
            .map((name) => name.trim().split(/\s+as\s+/)[0])
            .filter(Boolean);
        const affectedImport = importedNames.find((name) => affectedPixiExports.has(name));
        assert(
            !affectedImport,
            `PixiJS 8.18/8.19 affected export requires a new compatibility Gate: ${affectedImport} in ${relativePath}`
        );
    }
    const namespaceUse = source.match(/\bPIXI\.(FillPattern|ParticleContainer|Text|HTMLText|BitmapText)\b/);
    assert(
        !namespaceUse,
        `PixiJS 8.18/8.19 affected namespace API requires a new compatibility Gate: ${namespaceUse?.[1]} in ${relativePath}`
    );
}

const skillDirectories = fs.readdirSync(pixiSkillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
for (const requiredSkill of [
    'pixijs',
    'pixijs-application',
    'pixijs-core-concepts',
    'pixijs-scene-mesh',
    'pixijs-performance',
    'pixijs-migration-v8'
]) {
    assert(
        skillDirectories.includes(requiredSkill),
        `PixiJS package is missing official skill: ${requiredSkill}`
    );
    assert(
        fs.existsSync(path.join(pixiSkillRoot, requiredSkill, 'SKILL.md')),
        `PixiJS official skill has no SKILL.md: ${requiredSkill}`
    );
}
assert(
    skillDirectories.length === 26,
    `expected router + 25 PixiJS skills, found ${skillDirectories.length}`
);

console.log('PixiJS 8.19 dependency and official Agent Skills verified.');
