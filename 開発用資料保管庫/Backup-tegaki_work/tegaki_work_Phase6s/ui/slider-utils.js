/**
 * ============================================================================
 * ファイル名: ui/slider-utils.js
 * 責務: カスタムスライダーUIの生成と制御（慣性スクロール・タブレット対応）
 * 依存: なし
 * 被依存: ui-panels.js, quick-access-popup.js等
 * 公開API: SliderUtils
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.TegakiUI.SliderUtils
 * 実装状態: ♻️移植
 * ============================================================================
 */

export const SliderUtils = {
    createSlider(options) {
        const {
            container, min = 0, max = 100, initial = 50,
            step = null, onChange = null, onCommit = null, format = null,
            momentum = true
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
            if (e.button !== 0) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            dragging = true;
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
            
            if (containerEl.setPointerCapture) {
                try { containerEl.setPointerCapture(e.pointerId); } catch (err) {}
            }
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handlePointerMove = (e) => {
            if (!dragging) return;
            
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
            if (!dragging) return;
            
            dragging = false;
            
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            if (momentum && Math.abs(velocity) > 0.5) {
                applyMomentum();
            } else {
                velocity = 0;
            }
            
            if (onCommit) {
                setTimeout(() => onCommit(currentValue), 50);
            }
            
            if (containerEl.releasePointerCapture) {
                try { containerEl.releasePointerCapture(e.pointerId); } catch (err) {}
            }
            
            e.stopPropagation();
        };
        
        const handlePointerCancel = (e) => {
            if (!dragging) return;
            dragging = false;
            velocity = 0;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (momentumRafId) {
                cancelAnimationFrame(momentumRafId);
                momentumRafId = null;
            }
        };
        
        containerEl.addEventListener('pointerdown', handlePointerDown, { passive: false });
        document.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true });
        document.addEventListener('pointerup', handlePointerUp, { capture: true });
        document.addEventListener('pointercancel', handlePointerCancel, { capture: true });
        
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
                document.removeEventListener('pointermove', handlePointerMove);
                document.removeEventListener('pointerup', handlePointerUp);
                document.removeEventListener('pointercancel', handlePointerCancel);
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

// 下位互換性のためにグローバルに登録
window.TegakiUI = window.TegakiUI || {};
window.TegakiUI.SliderUtils = SliderUtils;
