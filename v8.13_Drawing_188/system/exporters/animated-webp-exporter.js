/**
 * ================================================================================
 * system/exporters/animated-webp-exporter.js - ffmpeg連携【v8.32.0】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - system/export-manager.js
 *   - system/exporters/png-exporter.js (連番PNG生成)
 *   - system/animation-system.js (フレーム情報)
 * 
 * 【依存関係 - Children】
 *   なし
 * 
 * 【責務】
 *   - 連番PNG一括出力
 *   - ffmpegコマンド生成
 *   - ffmpeg未導入時の案内表示
 * 
 * 【v8.32.0 新規作成】
 *   🔧 Animated WEBP専用エクスポーターとして分離
 *   🔧 連番PNG出力 + ffmpegコマンド生成
 *   🔧 APNGとは完全分離された実装
 * 
 * 【設計原則】
 *   - 連番PNG出力はexport-manager.jsのexportSequencePNG()を再利用
 *   - ffmpegコマンドを自動生成してユーザーに提示
 *   - file://プロトコル対応（外部ツール依存）
 * 
 * 【使用方法】
 *   1. 連番PNG出力（tegaki_YYYYMMDD_HHMMSS_0001.png, _0002.png, ...）
 *   2. ffmpegコマンドをコンソールに表示
 *   3. ユーザーがコマンドラインで手動実行
 * 
 * ================================================================================
 */

window.AnimatedWebPExporter = (function() {
    'use strict';
    
    class AnimatedWebPExporter {
        constructor(exportManager) {
            if (!exportManager) {
                throw new Error('AnimatedWebPExporter: exportManager is required');
            }
            this.manager = exportManager;
            this.isExporting = false;
        }
        
        /**
         * Animated WEBP出力（連番PNG + ffmpegコマンド生成）
         */
        async export(options = {}) {
            if (this.isExporting) {
                throw new Error('Export already in progress');
            }
            
            if (!this.manager?.animationSystem) {
                throw new Error('AnimationSystem not available');
            }
            
            const animData = this.manager.animationSystem.getAnimationData();
            if (!animData?.frames || animData.frames.length < 2) {
                throw new Error('Animated WEBPには2つ以上のフレームが必要です');
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:started', { 
                    format: 'animated-webp',
                    frames: animData.frames.length
                });
            }
            
            this.isExporting = true;
            
            try {
                // 連番PNG出力を実行
                const result = await this.manager.exportSequencePNG(options);
                
                // ffmpegコマンドをコンソールとUIに表示
                this._displayFFmpegInstructions(result);
                
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:completed', {
                        format: 'animated-webp',
                        method: 'sequence-png',
                        baseName: result.baseName,
                        frameCount: result.frameCount
                    });
                }
                
                return result;
                
            } catch (error) {
                if (window.TegakiEventBus) {
                    window.TegakiEventBus.emit('export:failed', { 
                        format: 'animated-webp',
                        error: error.message
                    });
                }
                throw error;
            } finally {
                this.isExporting = false;
            }
        }
        
        /**
         * ffmpeg変換手順の表示
         */
        _displayFFmpegInstructions(result) {
            const instructions = this._generateInstructions(result);
            
            console.log('\n' + '='.repeat(80));
            console.log('🎬 Animated WEBP変換手順');
            console.log('='.repeat(80));
            console.log(instructions);
            console.log('='.repeat(80) + '\n');
            
            // UI通知（任意：export-popup.jsで受け取り可能）
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('animated-webp:ffmpeg-instructions', {
                    instructions: instructions,
                    baseName: result.baseName,
                    frameCount: result.frameCount,
                    commands: result.ffmpegCommand
                });
            }
        }
        
        /**
         * ffmpeg変換手順のテキスト生成
         */
        _generateInstructions(result) {
            const cmd = result.ffmpegCommand.webp;
            
            return `
📦 連番PNG出力完了
   ファイル名: ${result.baseName}_0001.png ～ ${result.baseName}_${String(result.frameCount).padStart(4, '0')}.png
   フレーム数: ${result.frameCount}枚

🔧 Animated WEBP変換手順

【1】 ffmpegがインストールされているか確認
     ターミナル/コマンドプロンプトで実行:
     
     ffmpeg -version

【2】 連番PNGが保存されているフォルダへ移動
     例: cd ~/Downloads

【3】 以下のコマンドを実行してAnimated WEBP生成

     ${cmd}

【オプション説明】
  -framerate ${result.ffmpegCommand.webp.match(/-framerate (\d+)/)[1]} : フレームレート（FPS）
  -c:v libwebp : WEBPエンコーダー使用
  -lossless 0 : 非可逆圧縮（0=非可逆, 1=可逆）
  -quality 90 : 品質（0～100, 推奨: 80～95）
  -loop 0 : 無限ループ（0=無限, N=N回）

💡 その他の変換コマンド

【MP4に変換】
${result.ffmpegCommand.mp4}

【GIFに変換】
${result.ffmpegCommand.gif}
`;
        }
        
        /**
         * プレビュー生成（Animated WEBPはプレビュー不可）
         */
        async generatePreview(options = {}) {
            throw new Error('Animated WEBPのプレビューは未対応です。連番PNG出力をご利用ください。');
        }
        
        /**
         * Blob生成（Animated WEBPは直接生成不可）
         */
        async generateBlob(options = {}) {
            throw new Error('Animated WEBPの直接Blob生成は未対応です。連番PNG出力をご利用ください。');
        }
    }
    
    return AnimatedWebPExporter;
})();

console.log('✅ animated-webp-exporter.js v8.32.0 loaded');
console.log('   🔧 連番PNG出力 + ffmpegコマンド生成');
console.log('   🔧 file://プロトコル対応');