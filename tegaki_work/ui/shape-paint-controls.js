/** ROLE: QTP closed-shape paint controls, replacing unsupported brush slots for shape tools.
 * AUTHORITY: Existing AreaToolController options own settings; this is a projection and entry point.
 * INVARIANTS: Missing paint preserves old lasso fill/line shapes. null custom color follows Canvas Background.
 * RELATED: quick-access-popup.js, selection-area-tools.js, closed-shape-paint.js, WP030.
 */
export class ShapePaintControls {
    constructor({ host, getState, setOptions }) {
        this.host = host;
        this.getState = getState;
        this.setOptions = setOptions;
        host.innerHTML = `<div class="qa-shape-paint-modes" role="group" aria-label="図形の内側">
            <button type="button" data-paint="legacy" title="従来の投げ縄塗り。輪郭線なし">線なし</button>
            <button type="button" data-paint="line" title="内側は透明。輪郭線だけ描く">塗りなし</button>
            <button type="button" data-paint="same" title="線と内側を同じ描画色にする">同色</button>
            <button type="button" data-paint="custom" title="輪郭は描画色、内側は自由色">自由色</button>
        </div><div class="qa-shape-paint-color">
            <label>内側 <input type="color" aria-label="図形の内側色"></label>
            <button type="button" data-background title="Canvasの背景色を内側に使用。背景色の変更にも追従">背景色</button>
            <span data-hint></span>
        </div>`;
        host.addEventListener('pointerdown', event => event.stopPropagation());
        host.addEventListener('wheel', event => event.stopPropagation());
        host.querySelectorAll('[data-paint]').forEach(button => button.addEventListener('click', () => {
            setOptions({ shape: { paint: button.dataset.paint } });
            this.render();
        }));
        host.querySelector('[data-background]').addEventListener('click', () => {
            setOptions({ shape: { paint: 'custom', fillColor: null } });
            this.render();
        });
        this.color = host.querySelector('input');
        this.color.addEventListener('input', () => {
            setOptions({ shape: { paint: 'custom', fillColor: this.color.value } });
            this.render();
        });
    }

    render() {
        const { tool, shape = {}, background = '#f0e0d6' } = this.getState();
        const isLasso = tool === 'lasso-fill';
        const paint = shape.paint || 'legacy';
        const mode = paint === 'legacy' && !isLasso ? (tool === 'shape-polygon' ? 'same' : 'line') : paint;
        this.host.querySelectorAll('[data-paint]').forEach(button => {
            button.hidden = button.dataset.paint === 'legacy' && !isLasso;
            button.classList.toggle('active', button.dataset.paint === mode);
            button.setAttribute('aria-pressed', String(button.dataset.paint === mode));
        });
        this.host.dataset.lasso = String(isLasso);
        this.color.value = /^#[0-9a-f]{6}$/i.test(shape.fillColor || '') ? shape.fillColor : background;
        this.color.disabled = mode !== 'custom';
        const backgroundButton = this.host.querySelector('[data-background]');
        const followsBackground = mode === 'custom' && shape.fillColor == null;
        backgroundButton.classList.toggle('active', followsBackground);
        backgroundButton.setAttribute('aria-pressed', String(followsBackground));
        this.host.querySelector('[data-hint]').textContent = mode === 'legacy' ? '塗りのみ' : '線幅＝SIZE';
    }
}
