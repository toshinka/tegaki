/**
 * build/verify-history-display-dpr-resolution.mjs
 *
 * 画面DPR(表示解像度)と作品解像度の分離契約の静的検証。
 * PixiJS v8 の extract / generateTexture は、Sprite / Container を対象にすると
 * resolution未指定時に画面rendererの解像度(DPR)で読み出す。画面だけをDPRで描くと、
 * History snapshot・保存・書き出しが2倍画素になり、undoでLayerが2倍へ壊れる。
 * そのため、texture以外を対象にするextract呼び出しは resolution を明示しなければならない。
 *
 * 実ブラウザでのDPR1/DPR2画素一致確認(Layer・snapshot・undo/redo・History・PNG)は
 * STATUS記録の手順で行う。本verifierは新しい読み出し箇所の指定漏れを防ぐ。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['system', 'ui'].map(dir => path.join(workRoot, dir));
const extraFiles = ['core-engine.js', 'core-initializer.js'].map(file => path.join(workRoot, file));

const listFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
});

const files = [...scanRoots.flatMap(listFiles), ...extraFiles.filter(file => fs.existsSync(file))];

// texture(RenderTexture)を直接読む呼び出しはtexture自身の解像度(=1x)で読まれるため安全。
const TEXTURE_TARGET = /^(?:[\w.]*(?:renderTexture|RenderTexture|Texture|texture|RT|Rt)|rt|fullRT|tempRT|target)$/;

const violations = [];
let objectCalls = 0;

for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const callPattern = /\.extract\.(pixels|canvas|base64|image|texture)\(\s*\{/g;
    let match;
    while ((match = callPattern.exec(text))) {
        // コメント内のコード例は対象外。
        const lineStart = text.lastIndexOf('\n', match.index) + 1;
        const linePrefix = text.slice(lineStart, match.index).trim();
        if (linePrefix.startsWith('//') || linePrefix.startsWith('*') || linePrefix.startsWith('/*')) continue;
        objectCalls++;
        // 対応する閉じ括弧までをobject literalとして取り出す。
        let depth = 0;
        let end = match.index + match[0].length - 1;
        for (; end < text.length; end++) {
            if (text[end] === '{') depth++;
            else if (text[end] === '}') {
                depth--;
                if (depth === 0) break;
            }
        }
        const body = text.slice(match.index + match[0].length - 1, end + 1);
        const targetMatch = body.match(/target\s*:\s*([\w.]+)/) || body.match(/\{\s*(target)\s*[,}]/);
        const target = targetMatch ? targetMatch[1] : '(unknown)';
        const hasResolution = /\bresolution\s*[:,}]/.test(body);
        if (!hasResolution && !TEXTURE_TARGET.test(target)) {
            const line = text.slice(0, match.index).split('\n').length;
            violations.push(`${path.relative(workRoot, file)}:${line} extract.${match[1]}({ target: ${target} }) has no explicit resolution`);
        }
    }

    let index = text.indexOf('.generateTexture(');
    while (index !== -1) {
        const call = text.slice(index, index + 300);
        if (!/resolution/.test(call)) {
            const line = text.slice(0, index).split('\n').length;
            violations.push(`${path.relative(workRoot, file)}:${line} generateTexture without an explicit resolution`);
        }
        index = text.indexOf('.generateTexture(', index + 1);
    }
}

assert.ok(objectCalls >= 10, `expected to scan the existing extract calls (found ${objectCalls})`);
assert.deepEqual(violations, [], `extract calls on Sprite / Container must pass resolution:\n${violations.join('\n')}`);

// 既知の作品側読み出し(History / snapshot / thumbnail)が1x指定を保っていること。
const requireOneX = [
    ['system/layer-system.js', /target:\s*tempSprite,[\s\S]{0,200}?resolution:\s*1,/],
    ['system/drawing/brush-core.js', /target:\s*baselineSprite,[\s\S]{0,200}?resolution:\s*1,/],
    ['system/drawing/brush-core.js', /target:\s*tempSprite,[\s\S]{0,200}?resolution:\s*1,/],
    ['system/drawing/brush-core.js', /target:\s*sprite,[\s\S]{0,200}?resolution:\s*1,/],
    ['system/drawing/thumbnail-system.js', /target:\s*_tempSprite,[\s\S]{0,200}?resolution:\s*1,/]
];
for (const [relative, pattern] of requireOneX) {
    const text = fs.readFileSync(path.join(workRoot, relative), 'utf8');
    assert.ok(pattern.test(text), `${relative} keeps resolution: 1 on its document-side extract`);
}

// 画面DPRは設定(displayDevicePixelRatio)で切り替える。値はboolean。
const configText = fs.readFileSync(path.join(workRoot, 'config.js'), 'utf8');
assert.match(configText, /displayDevicePixelRatio:\s*(true|false)/, 'display DPR switch exists in config');
const initializerText = fs.readFileSync(path.join(workRoot, 'core-initializer.js'), 'utf8');
assert.match(initializerText, /resolution:\s*getDisplayResolution\(\)/, 'renderer resolution goes through getDisplayResolution');
assert.match(initializerText, /displayDevicePixelRatio !== true\) return fixed/, 'DPR is used only when explicitly enabled');

console.log(`verify-history-display-dpr-resolution: ${objectCalls} extract calls scanned, all document-side reads are DPR independent`);
