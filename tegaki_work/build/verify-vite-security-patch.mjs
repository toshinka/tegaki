import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd());
const readJson = (relativePath) => JSON.parse(
    fs.readFileSync(path.join(root, relativePath), 'utf8')
);
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};
const compareVersion = (actual, minimum) => {
    const actualParts = actual.split('.').map(Number);
    const minimumParts = minimum.split('.').map(Number);
    for (let index = 0; index < Math.max(actualParts.length, minimumParts.length); index += 1) {
        const difference = (actualParts[index] || 0) - (minimumParts[index] || 0);
        if (difference !== 0) return difference;
    }
    return 0;
};

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const installedVite = readJson('node_modules/vite/package.json');
const installedPostcss = readJson('node_modules/postcss/package.json');
const installedNanoid = readJson('node_modules/nanoid/package.json');
const lockPackage = (name) => packageLock.packages?.[`node_modules/${name}`];

assert(
    packageJson.devDependencies?.vite === '8.0.16',
    'package.json must pin Vite to exact 8.0.16'
);
assert(
    packageLock.packages?.['']?.devDependencies?.vite === '8.0.16',
    'package-lock root must pin Vite to exact 8.0.16'
);
assert(lockPackage('vite')?.version === '8.0.16', 'package-lock Vite must be 8.0.16');
assert(installedVite.version === '8.0.16', 'installed Vite must be 8.0.16');
assert(
    lockPackage('postcss')?.version === installedPostcss.version
        && compareVersion(installedPostcss.version, '8.5.23') >= 0,
    'PostCSS lock / installed must match and be at least 8.5.23'
);
assert(
    lockPackage('nanoid')?.version === installedNanoid.version
        && compareVersion(installedNanoid.version, '3.3.17') >= 0,
    'Nanoid lock / installed must match and be at least 3.3.17'
);
assert(
    packageJson.dependencies?.['pixi.js'] === '8.19.0'
        && packageLock.packages?.['']?.dependencies?.['pixi.js'] === '8.19.0'
        && lockPackage('pixi.js')?.version === '8.19.0',
    'Phase 7u must retain exact PixiJS 8.19.0'
);
assert(
    packageJson.scripts?.build === 'vite build'
        && packageJson.scripts?.dev === 'vite'
        && packageJson.scripts?.preview === 'vite preview',
    'Phase 7u must retain the existing Vite script contract'
);
assert(fs.existsSync(path.join(root, 'vite.config.js')), 'existing vite.config.js must remain present');

console.log(
    `verify-vite-security-patch: Vite ${installedVite.version}, `
    + `PostCSS ${installedPostcss.version}, Nanoid ${installedNanoid.version}, PixiJS 8.19.0`
);
