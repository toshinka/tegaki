// ===== ui/slider-utils.js =====
// 責務: スライダーUIの統一実装
// SOLID原則: 単一責任（スライダーの生成と制御のみ）

window.TegakiUI = window.TegakiUI || {};

/**
 * スライダー統一ユーティリティ
 * settings-popup.js と ui-panels.js の両方で使用可能
 */
window.TegakiUI.SliderUtils = {
    
    /**
     * スライダーを作成
     * @param {Object} options - 設定オプション
     * @returns {Object} スライダー制御用オブジェクト
     */
    createSlider(options) {
        const {
            container,      // HTMLElement または ID文字列
            min = 0,
            max = 100,
            initial = 50,
            step = null,    // null の場合は連続値
            onChange = null,  // (value) => {} : リアルタイム変更時
            onCommit = null,  // (value) => {} : 確定時（mouseup）
            format = null     // (value) => string : 表示フォーマット
        } = options;
        
        // コンテナ取得
        const containerEl = typeof container === 'string' 
            ? document.getElementById(container)
            : container;
            
        if (!containerEl) {
            console.error('[SliderUtils] Container not found:', container);
            return null;
        }
        
        // 既存のスライダーリスナーをクリア
        if (containerEl._sliderListenerSetup) {
            return containerEl._sliderInstance;
        }
        
        // HTML要素取得
        const track = containerEl.querySelector('.slider-track');
        const handle = containerEl.querySelector('.slider-handle');
        const valueDisplay = containerEl.parentNode?.querySelector('.slider-value');
        
        if (!track || !handle) {
            console.error('[SliderUtils] Slider elements not found in container');
            return null;
        }
        
        // 内部状態
        let currentValue = initial;
        let dragging = false;
        
        /**
         * 値を更新してUIに反映
         */
        const updateUI = (newValue) => {
            // 範囲制限
            currentValue = Math.max(min, Math.min(max, newValue));
            
            // step指定がある場合は丸める
            if (step !== null) {
                currentValue = Math.round(currentValue / step) * step;
            }
            
            // パーセンテージ計算
            const percentage = ((currentValue - min) / (max - min)) * 100;
            
            // UIを更新
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            
            // 値の表示
            if (valueDisplay) {
                valueDisplay.textContent = format 
                    ? format(currentValue) 
                    : currentValue.toFixed(1);
            }
        };
        
        /**
         * クライアントX座標から値を計算
         */
        const getValue = (clientX) => {
            const rect = containerEl.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        /**
         * マウスダウンハンドラ
         */
        const handleMouseDown = (e) => {
            dragging = true;
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            
            if (onChange) {
                onChange(currentValue);
            }
            
            e.preventDefault();
        };
        
        /**
         * マウスムーブハンドラ
         */
        const handleMouseMove = (e) => {
            if (!dragging) return;
            
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            
            if (onChange) {
                onChange(currentValue);
            }
        };
        
        /**
         * マウスアップハンドラ
         */
        const handleMouseUp = () => {
            if (!dragging) return;
            
            dragging = false;
            
            if (onCommit) {
                onCommit(currentValue);
            }
        };
        
        // イベントリスナー登録
        containerEl.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // 初期値を設定
        updateUI(initial);
        
        // フラグを立てて二重登録を防ぐ
        containerEl._sliderListenerSetup = true;
        
        // 制御用インスタンス
        const instance = {
            getValue: () => currentValue,
            setValue: (value) => {
                updateUI(value);
                if (onChange) onChange(currentValue);
            },
            destroy: () => {
                containerEl.removeEventListener('mousedown', handleMouseDown);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                containerEl._sliderListenerSetup = false;
                containerEl._sliderInstance = null;
            }
        };
        
        containerEl._sliderInstance = instance;
        return instance;
    },
    
    /**
     * HTMLからスライダーを生成
     * settings-popup.js で使う形式
     * @param {string} containerId
     * @param {number} min
     * @param {number} max
     * @param {number} initial
     * @param {Function} callback - (value) => formattedString
     * @param {Function} onCommit - (value) => void
     */
    createSimpleSlider(containerId, min, max, initial, callback, onCommit) {
        return this.createSlider({
            container: containerId,
            min,
            max,
            initial,
            onChange: (value) => {
                const container = document.getElementById(containerId);
                const valueDisplay = container?.parentNode?.querySelector('.slider-value');
                if (valueDisplay && callback) {
                    valueDisplay.textContent = callback(value);
                }
            },
            onCommit: onCommit || (() => {}),
            format: callback
        });
    }
};

console.log('✅ ui/slider-utils.js loaded');
console.log('   - 責務: スライダーUIの統一実装');
console.log('   - DRY原則: settings-popup.js と ui-panels.js で共有');
console.log('   - API: createSlider() / createSimpleSlider()');