const fs = require('fs');
const path = require('path');

console.log('🔨 Building tegaki_anime.js with modular architecture...');

// 出力ファイルのヘッダー
let output = `// ========================================
// Tegaki Anime Bundle (Modular Architecture)
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
console.log('📦 Loading libraries...');
libraryFiles.forEach(file => {
    console.log(`  - ${file}`);
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
console.log(`  ✓ Worker size: ${workerCode.length} bytes`);
console.log(`  ✓ Base64 size: ${workerBase64.length} bytes`);

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
    
    // グローバルに保存（ExportManagerから参照可能に）
    window.__gifWorkerUrl = workerUrl;
    
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

// コアモジュールファイルのリスト（依存関係順）
const coreFiles = [
    'src/utils/constants.js',
    'src/utils/helpers.js',
    'src/modules/CanvasManager.js',
    'src/modules/LayerManager.js',
    'src/modules/DrawingEngine.js',
    'src/modules/HistoryManager.js',
    'src/modules/KeyboardManager.js',
    'src/modules/UIBuilder.js',
    'src/modules/ExportManager.js',
    'src/tegaki_anime_core.js'  // 最後に統合クラス
];

// コアモジュールを順次読み込んで結合
console.log('📦 Loading core modules...');
coreFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`  - ${file}`);
        const content = fs.readFileSync(filePath, 'utf8');
        output += `\n// ========== ${file} ==========\n`;
        output += content + '\n';
    } else {
        console.warn(`  ⚠️  ${file} not found - skipping`);
    }
});

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
console.log('\n✅ Build complete!');
console.log(`📄 Output: ${outputPath}`);
console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`📦 Lines: ${output.split('\n').length}`);
console.log(`\n🎉 Ready to test with TegakiAniTest.html`);