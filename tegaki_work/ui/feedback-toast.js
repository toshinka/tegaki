/**
 * 短時間の操作結果だけを通知する共通toast。
 * payloadや保存正本を参照せず、呼び出し時に確定した表示文字列だけを扱う。
 */

let hideTimer = null;

export function showFeedbackToast(message, options = {}) {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text || typeof document === 'undefined') return false;

    let toast = document.getElementById('tegaki-feedback-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'tegaki-feedback-toast';
        toast.className = 'tegaki-feedback-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toast);
    }

    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(hideTimer);
    const duration = Number.isFinite(options.duration)
        ? Math.max(600, options.duration)
        : 1600;
    hideTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
    return true;
}

export function formatCopyFeedback(kind, count = 1) {
    const normalizedCount = Math.max(1, Math.floor(Number(count) || 1));
    const label = kind === 'motion-key'
        ? 'Motion key'
        : (kind === 'caf' ? 'CAF' : 'Layer');
    return normalizedCount > 1
        ? `${label} ${normalizedCount}件をコピー`
        : `${label}をコピー`;
}
