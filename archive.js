/**
 * ============================================================================
 * ファイル名: archive.js
 * 責務: tegaki_work/ を PastFiles/tegaki_phase[フェーズ名] へコピーし、
 *       コピー先の中の GitHubURL.txt 内のURLを一括置換する自動化スクリプト。
 * 使用方法: node archive.js [フェーズ名] (例: node archive.js 2p)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// 引数チェック
const phaseInput = process.argv[2];
const force = process.argv.includes('--force') || process.argv.includes('-f');

if (!phaseInput) {
  console.error("エラー: フェーズ名または連番を指定してください。");
  console.error("使用例: node archive.js 2p");
  console.error("使用例: node archive.js tegaki_phase2p");
  process.exit(1);
}

// フェーズ名の正規化 (例: "2p" -> "tegaki_phase2p")
let phaseName = phaseInput;
if (!phaseName.startsWith('tegaki_phase')) {
  // "phase2p" -> "2p" のように "phase" を取り除いてから整形
  const cleanNum = phaseName.replace(/^phase/, '');
  phaseName = `tegaki_phase${cleanNum}`;
}

const sourceDir = path.join(__dirname, 'tegaki_work');
const targetDir = path.join(__dirname, 'PastFiles', phaseName);

console.log(`[アーカイブ開始]`);
console.log(`ソース: ${sourceDir}`);
console.log(`コピー先: ${targetDir}`);

// コピー先が既に存在する場合のハンドリング
if (fs.existsSync(targetDir)) {
  if (force) {
    console.log(`警告: コピー先が既に存在しますが、--force (-f) が指定されているため上書きします。`);
    fs.rmSync(targetDir, { recursive: true, force: true });
  } else {
    console.error(`エラー: コピー先ディレクトリ '${targetDir}' は既に存在します。`);
    console.error(`上書きする場合は '--force' または '-f' オプションを付けて実行してください。`);
    console.error(`例: node archive.js ${phaseInput} --force`);
    process.exit(1);
  }
}

// フォルダ再帰コピー関数の定義（node_modules と dist を除外）
function copyFolderRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // 除外フォルダの判定
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // コピーの実行
  copyFolderRecursive(sourceDir, targetDir);
  console.log(`ファイルをコピーしました（node_modules, dist は除外）。`);

  // コピー先の中の GitHubURL.txt 内のURLを更新
  const githubUrlPath = path.join(targetDir, 'GitHubURL.txt');
  if (fs.existsSync(githubUrlPath)) {
    let content = fs.readFileSync(githubUrlPath, 'utf8');

    // /tegaki_work/ を /PastFiles/tegaki_phaseX/ に一括置換
    const targetUrlSegment = `/PastFiles/${phaseName}/`;
    content = content.replaceAll('/tegaki_work/', targetUrlSegment);

    fs.writeFileSync(githubUrlPath, content, 'utf8');
    console.log(`コピー先の GitHubURL.txt 内のURLを '${targetUrlSegment}' へ書き換えました。`);
  } else {
    console.log(`警告: コピー先に GitHubURL.txt が見つかりませんでした。`);
  }

  console.log(`[アーカイブ成功] フェーズ '${phaseName}' の保存が完了しました。`);

} catch (error) {
  console.error(`アーカイブ処理中にエラーが発生しました:`, error);
  process.exit(1);
}
