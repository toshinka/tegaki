/**
 * ================================================================================
 * slider-utils.js v8.14.0 - PointerEvent配信問題修正版
 * ================================================================================
 * 
 * 📁 親ファイル依存: なし（独立モジュール）
 * 
 * 📄 子ファイル使用先:
 *   - ui/dom-builder.js (スライダー生成)
 *   - ui/settings-popup.js (設定UI)
 *   - ui/quick-access-popup.js (クイックアクセスUI)
 * 
 * 【責務】
 * - スライダーUI生成・管理
 * - 慣性スクロール実装
 * - タブレットペン対応
 * 
 * 【Phase 1-1改修内容】
 * 🔧 document全体のpointermove capture削除
 * 🔧 setPointerCaptureによる厳密な制御
 * 🔧 描画用pointermoveの横取り防止
 * 
 * 【PixiJS使用制限】
 * - 本ファイルはPixiJS非依存
 * - WebGPU描画処理への干渉を完全に排除
 * 
 * ================================================================================
 */

window.TegakiUI = window.TegakiUI || {};

window.TegakiUI.SliderUtils = {
    createSlider(options) {
        const {
            container, min = 0, max = 100, initial = 50,
            step = null, onChange = null, onCommit = null, format = null
        } = options;
        
        const containerEl = typeof container === 'string' 
            ? document.getElementById(container) : container;
            
        if (!containerEl) return null;
        if (containerEl._sliderListenerSetup) return containerEl._sliderInstance;
        
        const track = containerEl.querySelector('.slider-track');
        const handle = containerEl.querySelector('.slider-handle');
        const valueDisplay = containerEl.parentNode?.querySelector('.slider-value');
        
        if (!track || !handle) return null;
        
        let currentValue = initial;
        let dragging = false;
        let rafId = null;
        let pendingUpdate = null;
        let activePointerId = null;
        
        let velocity = 0;
        let lastMoveTime = 0;
        let lastMoveValue = initial;
        let momentumRafId = null;
        
        const updateUI = (newValue) => {
            currentValue = Math.max(min, Math.min(max, newValue));
            if (step !== null) {
                currentValue = Math.round(currentValue / step) * step;
            }
            
            const percentage = ((currentValue - min) / (max - min)) * 100;
            track.style.width = percentage + '%';
            handle.style.left = percentage + '%';
            
            if (valueDisplay) {
                valueDisplay.textContent = format 
                    ? format(currentValue) 
                    : currentValue.toFixed(1);
            }
        };
        
        const scheduleOnChange = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            
            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (onChange && pendingUpdate !== null) {
                    onChange(pendingUpdate);
                    pendingUpdate = null;
                }
            });
        };
        
        const applyMomentum = () => {
            if (!dragging && Math.abs(velocity) > 0.5) {
                currentValue += velocity;
                currentValue = Math.max(min, Math.min(max, currentValue));
                
                updateUI(currentValue);
                pendingUpdate = currentValue;
                scheduleOnChange();
                
                velocity *= 0.92;
                momentumRafId = requestAnimationFrame(applyMomentum);
            } else {
                velocity = 0;
                if (momentumRafId) {
                    cancelAnimationFrame(momentumRafId);
                    momentumRafId = null;
                }
            }
        };
        
        const getValue = (clientX) => {
            const rect = containerEl.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return min + (percentage * (max - min));
        };
        
        const handlePointerDown = (e) => {
            if (e.button !== 0) return;
            
            dragging = true;
            activePointerId = e.pointerId;
            velocity = 0;
            if (momentumRafId) {
                cancelAnimationFrame(momentumRafId);
                momentumRafId = null;
            }
            
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            
            lastMoveValue = newValue;
            lastMoveTime = performance.now();
            pendingUpdate = currentValue;
            scheduleOnChange();
            
            // 🔧 setPointerCaptureで厳密に制御
            try {
                containerEl.setPointerCapture(e.pointerId);
            } catch (err) {
                console.warn('[SliderUtils] setPointerCapture failed:', err);
            }
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handlePointerMove = (e) => {
            // 🔧 activePointerIdで厳密にチェック
            if (!dragging || e.pointerId !== activePointerId) return;
            
            const now = performance.now();
            const dt = Math.max(1, now - lastMoveTime);
            
            const newValue = getValue(e.clientX);
            updateUI(newValue);
            
            velocity = (newValue - lastMoveValue) / dt * 16;
            
            lastMoveValue = newValue;
            lastMoveTime = now;
            
            pendingUpdate = currentValue;
            scheduleOnChange();
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handlePointerUp = (e) => {
            if (!dragging || e.pointerId !== activePointerId) return;
            
            dragging = false;
            activePointerId = null;
            
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            if (Math.abs(velocity) > 0.5) {
                applyMomentum();
            }
            
            if (onCommit) {
                setTimeout(() => onCommit(currentValue), 50);
            }
            
            try {
                containerEl.releasePointerCapture(e.pointerId);
            } catch (err) {
                console.warn('[SliderUtils] releasePointerCapture failed:', err);
            }
            
            e.stopPropagation();
        };
        
        const handlePointerCancel = (e) => {
            if (!dragging || e.pointerId !== activePointerId) return;
            
            dragging = false;
            activePointerId = null;
            velocity = 0;
            
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (momentumRafId) {
                cancelAnimationFrame(momentumRafId);
                momentumRafId = null;
            }
            
            try {
                containerEl.releasePointerCapture(e.pointerId);
            } catch (err) {}
        };
        
        // 🔧 containerElのみにイベント登録（document全体への登録を削除）
        containerEl.addEventListener('pointerdown', handlePointerDown, { passive: false });
        containerEl.addEventListener('pointermove', handlePointerMove, { passive: false });
        containerEl.addEventListener('pointerup', handlePointerUp);
        containerEl.addEventListener('pointercancel', handlePointerCancel);
        
        updateUI(initial);
        containerEl._sliderListenerSetup = true;
        
        const instance = {
            getValue: () => currentValue,
            setValue: (value) => {
                updateUI(value);
                if (onChange) onChange(currentValue);
            },
            destroy: () => {
                if (rafId !== null) cancelAnimationFrame(rafId);
                if (momentumRafId) cancelAnimationFrame(momentumRafId);
                containerEl.removeEventListener('pointerdown', handlePointerDown);
                containerEl.removeEventListener('pointermove', handlePointerMove);
                containerEl.removeEventListener('pointerup', handlePointerUp);
                containerEl.removeEventListener('pointercancel', handlePointerCancel);
                containerEl._sliderListenerSetup = false;
                containerEl._sliderInstance = null;
            }
        };
        
        containerEl._sliderInstance = instance;
        return instance;
    },
    
    createSimpleSlider(containerId, min, max, initial, callback, onCommit) {
        return this.createSlider({
            container: containerId, min, max, initial,
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

console.log('✅ slider-utils.js v8.14.0 loaded');
console.log('   🔧 PointerEvent配信問題修正完了');