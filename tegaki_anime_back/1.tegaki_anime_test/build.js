// ========== Pako Compatibility Shim ==========
(function() {
    // upng.js が pako を探す前に window.pako が利用可能にする
    if (typeof window !== 'undefined' && !window.pako && typeof pako !== 'undefined') {
        window.pako = pako;
    }
})();

const fs = require('fs');
const path = require('path');

console.log('🔨 Building tegaki_anime.js with inline Worker...');
console.log('📂 Current directory:', __dirname);

// 出力ファイルのヘッダー
let output = `// ========================================
// Tegaki Anime Bundle
// UPNG.js + pako.js + GIF.js + TegakiAnimeCore
// Build: ${new Date().toISOString()}
// ========================================

`;

// 結合するライブラリファイルのリスト
const libraryFiles = [
    'libs/pako.js',    // pako を最初に読み込む（UPNG が依存）
    'libs/upng.js',
    'libs/gif.js', 
    'src/tegaki_anime_core.js' 
];

// ファイル存在確認
console.log('\n📋 Checking required files...');
let allFilesExist = true;

libraryFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✓ ${file}`);
    } else {
        console.error(`  ✗ ${file} - NOT FOUND`);
        allFilesExist = false;
    }
});

const workerFile = 'libs/gif.worker.js';
const workerPath = path.join(__dirname, workerFile);
if (fs.existsSync(workerPath)) {
    console.log(`  ✓ ${workerFile}`);
} else {
    console.error(`  ✗ ${workerFile} - NOT FOUND`);
    allFilesExist = false;
}

const coreFile = 'src/tegaki_anime_core.js';
const corePath = path.join(__dirname, coreFile);
if (fs.existsSync(corePath)) {
    console.log(`  ✓ ${coreFile}`);
} else {
    console.warn(`  ⚠ ${coreFile} - NOT FOUND (will skip core integration)`);
}

if (!allFilesExist) {
    console.error('\n❌ Build failed: Required library files are missing');
    process.exit(1);
}

console.log('\n🔄 Reading and combining files...\n');

// ライブラリを順次読み込んで結合
libraryFiles.forEach(file => {
    console.log(`📦 Reading: ${file}`);
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    output += `\n// ========== ${file} ==========\n`;
    output += content + '\n';
});

// Worker ファイルをBase64に変換
console.log('🔧 Encoding gif.worker.js to Base64...');
const workerCode = fs.readFileSync(workerPath, 'utf8');
const workerBase64 = Buffer.from(workerCode).toString('base64');
console.log(`  ✓ Worker size: ${workerCode.length} bytes`);
console.log(`  ✓ Base64 size: ${workerBase64.length} bytes`);

// Worker をインライン化するコード（即座に実行）
output += `
// ========== GIF.js Worker Inline ==========
(function() {
    'use strict';
    
    // 即座に Worker を初期化
    if (typeof window !== 'undefined' && typeof GIF !== 'undefined') {
        try {
            // Base64からWorkerコードをデコード
            const workerCodeBase64 = '${workerBase64}';
            const workerCode = atob(workerCodeBase64);
            
            // Blob URL を生成
            const blob = new Blob([workerCode], { 
                type: 'application/javascript' 
            });
            const workerUrl = URL.createObjectURL(blob);
            
            // グローバル変数にも保存（フォールバック用）
            window.__gifWorkerUrl = workerUrl;
            
            // GIF.js のプロトタイプを確認して設定
            if (GIF.prototype) {
                if (!GIF.prototype.options) {
                    GIF.prototype.options = {};
                }
                GIF.prototype.options.workerScript = workerUrl;
                
                // GIFコンストラクタのデフォルト値も上書き
                const originalGIF = window.GIF;
                window.GIF = function(options) {
                    options = options || {};
                    if (!options.workerScript) {
                        options.workerScript = workerUrl;
                    }
                    return originalGIF.call(this, options);
                };
                window.GIF.prototype = originalGIF.prototype;
                
                console.log('✅ GIF.js Worker inlined successfully');
                console.log('   Worker URL:', workerUrl);
            } else {
                console.error('❌ GIF.prototype not found');
            }
        } catch (error) {
            console.error('❌ Worker inline failed:', error);
        }
    } else {
        console.warn('⚠️  GIF.js not loaded yet, Worker inline skipped');
    }
})();
`;

// ライブラリをグローバルに公開
output += `
// ========== Global Exports ==========
(function() {
    'use strict';
    
    if (typeof window !== 'undefined') {
        // ★ 1. 順序保証: pako を先に公開
        if (typeof pako !== 'undefined') {
            window.pako = pako;
            window.Zlib = pako;
            console.log('✓ pako exposed');
        } else {
            console.warn('✗ pako not found');
        }
        
        // ★ 2. UPNG を公開（pako が先に公開されたので安全）
        if (typeof UPNG !== 'undefined') {
            window.UPNG = UPNG;
            console.log('✓ UPNG exposed');
        } else {
            console.warn('✗ UPNG not found');
        }
        
        // ★ 3. GIF を公開
        if (typeof GIF !== 'undefined') {
            window.GIF = GIF;
            console.log('✓ GIF exposed');
        } else {
            console.warn('✗ GIF not found');
        }
        
        // ★ 4. 最終確認
        console.log('📦 Final library check:', {
            pako: !!window.pako,
            Zlib: !!window.Zlib,
            UPNG: !!window.UPNG,
            GIF: !!window.GIF
        });
    }
})();
`;

// src/tegaki_anime_core.js が存在する場合は追加
if (fs.existsSync(corePath)) {
    console.log(`📦 Reading: ${coreFile}`);
    const coreContent = fs.readFileSync(corePath, 'utf8');
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
console.log('\n✅ Build complete!');
console.log(`📄 Output: ${outputPath}`);
console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`📦 Lines: ${output.split('\n').length}`);
console.log(`📦 Characters: ${output.length.toLocaleString()}`);

// 最終確認
console.log('\n🔍 Verification:');
console.log(`  File exists: ${fs.existsSync(outputPath)}`);

console.log('\n✨ Next steps:');
console.log('  1. Test locally: python -m http.server 8000');
console.log('  2. Open: http://localhost:8000/TegakiAniTest.html');
console.log('  3. Check console for library status');
console.log('  4. Deploy to GitHub Pages');