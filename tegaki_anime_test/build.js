const fs = require('fs');
const path = require('path');

console.log('🔨 Building tegaki_anime.js with inline Worker...');

// 出力ファイルのヘッダー
let output = `// ========================================
// Tegaki Anime Bundle
// UPNG.js + pako.js + GIF.js + TegakiAnimeCore
// Build: ${new Date().toISOString()}
// ========================================

`;

// 結合するライブラリファイルのリスト
const libraryFiles = [
    'libs/upng.js',
    'libs/pako.js',
    'libs/gif.js'
];

// ライブラリを順次読み込んで結合
libraryFiles.forEach(file => {
    console.log(`📦 Reading: ${file}`);
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    output += `\n// ========== ${file} ==========\n`;
    output += content + '\n';
});

// Worker ファイルをBase64に変換
console.log('🔧 Encoding gif.worker.js to Base64...');
const workerCode = fs.readFileSync(
    path.join(__dirname, 'libs/gif.worker.js'), 
    'utf8'
);
const workerBase64 = Buffer.from(workerCode).toString('base64');
console.log(`✓ Worker size: ${workerCode.length} bytes`);
console.log(`✓ Base64 size: ${workerBase64.length} bytes`);

// Worker をインライン化するコード
output += `
// ========== GIF.js Worker Inline ==========
(function() {
    'use strict';
    
    // GIFライブラリが読み込まれているか確認
    if (typeof window === 'undefined' || !window.GIF) {
        console.warn('GIF.js not loaded, skipping Worker inline');
        return;
    }
    
    // Base64からWorkerコードをデコード
    const workerCodeBase64 = '${workerBase64}';
    const workerCode = atob(workerCodeBase64);
    
    // Blob URL を生成
    const blob = new Blob([workerCode], { 
        type: 'application/javascript' 
    });
    const workerUrl = URL.createObjectURL(blob);
    
    // GIF.js のデフォルト Worker を上書き
    if (window.GIF.prototype) {
        window.GIF.prototype.options = window.GIF.prototype.options || {};
        window.GIF.prototype.options.workerScript = workerUrl;
        console.log('✅ GIF.js Worker inlined successfully');
    }
})();
`;

// ライブラリをグローバルに公開
output += `
// ========== Global Exports ==========
(function() {
    'use strict';
    
    if (typeof window !== 'undefined') {
        // UPNG.js の公開
        if (typeof UPNG !== 'undefined') {
            window.UPNG = UPNG;
        }
        
        // pako.js の公開
        if (typeof pako !== 'undefined') {
            window.pako = pako;
            window.Zlib = pako;  // UPNG.jsが期待する名前
        }
        
        // GIF.js の公開
        if (typeof GIF !== 'undefined') {
            window.GIF = GIF;
        }
        
        console.log('✅ Libraries exposed to window:', {
            UPNG: !!window.UPNG,
            pako: !!window.pako,
            Zlib: !!window.Zlib,
            GIF: !!window.GIF
        });
    }
})();
`;

// src/tegaki_anime_core.js が存在する場合は追加
const coreFile = 'src/tegaki_anime_core.js';
if (fs.existsSync(path.join(__dirname, coreFile))) {
    console.log(`📦 Reading: ${coreFile}`);
    const coreContent = fs.readFileSync(path.join(__dirname, coreFile), 'utf8');
    output += `\n// ========== ${coreFile} ==========\n`;
    output += coreContent + '\n';
} else {
    console.warn(`⚠️  ${coreFile} not found - skipping core integration`);
}

// dist フォルダが存在しない場合は作成
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('📁 Created dist/ directory');
}

// ファイル出力
const outputPath = path.join(distDir, 'tegaki_anime.js');
fs.writeFileSync(outputPath, output, 'utf8');

// 統計情報の表示
const stats = fs.statSync(outputPath);
console.log('✅ Build complete!');
console.log(`📄 Output: ${outputPath}`);
console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`📦 Lines: ${output.split('\n').length}`);