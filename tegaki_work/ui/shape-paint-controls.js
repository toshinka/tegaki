/** ROLE: Compact QTP switches for closed-shape action and inner color.
 * AUTHORITY: Existing AreaToolController UI options; no drawing or save authority.
 * INVARIANTS: Missing paint keeps legacy defaults. null specified color follows Canvas.
 * All paint choices share one icon row. Lasso outline is an explicit choice.
 */
import { UI_ICONS } from './ui-icons.js';

export class ShapePaintControls {
    constructor({ host, getState, setOptions }) {
        this.host = host; this.getState = getState; this.setOptions = setOptions;
        this.fillChoice = 'custom';
        host.innerHTML = `<div class="qa-shape-paint-row" role="group" aria-label="図形の線と内側色">
            <button type="button" data-fill aria-label="内側を塗る" title="内側を塗る / OFFで線のみ">${UI_ICONS.fill}</button>
            <button type="button" data-outline aria-label="輪郭線の切替" title="輪郭線あり（線幅＝SIZE）">${UI_ICONS.borderFrame}</button>
            <div class="qa-shape-switch qa-shape-color-switch" data-switch="color" role="group" aria-label="内側の色">
                <label title="同色：描画色と同じ色で内側を塗る"><input type="radio" name="qa-shape-color" value="same" aria-label="描画色と同じ内側色"><span data-same-dot>●</span></label>
                <label title="指定色：内側の色を指定。初期はCanvas背景色"><input type="radio" name="qa-shape-color" value="custom" aria-label="指定した内側色"><span data-custom-dot>◯</span></label>
            </div><label class="qa-shape-color-picker" title="内側の色を変更（指定色に切替）">${UI_ICONS.innerColorPicker}<input type="color" aria-label="図形の内側色"></label>
            <button type="button" data-background aria-label="内側の色をCanvas色へ戻す" title="内側の色をCanvas背景色へ戻す・背景色に追従">${UI_ICONS.rotateCcw}</button></div>
        <div data-polygon-hint hidden title="点をドラッグ / Backspaceで末尾削除 / Escで取消 / Shiftで45度補助">点を追加 → 始点/Enterで確定</div>`;
        host.addEventListener('pointerdown', event => event.stopPropagation());
        host.addEventListener('wheel', event => event.stopPropagation());
        host.addEventListener('keydown', event => event.stopPropagation());
        host.addEventListener('keyup', event => event.stopPropagation());
        host.querySelector('[data-fill]').addEventListener('click', () => {
            this._setPaint(host.querySelector('[data-fill]').getAttribute('aria-pressed') !== 'true', this.fillChoice);
        });
        host.querySelectorAll('input[type="radio"]').forEach(input => input.addEventListener('change', () => {
            this.fillChoice = input.value; this._setPaint(true, this.fillChoice);
        }));
        host.querySelector('[data-background]').addEventListener('click', () => {
            this.fillChoice = 'custom'; this._setPaint(true, 'custom', null);
        });
        host.querySelector('[data-outline]').addEventListener('click', () => {
            this.setOptions({ shape: { lassoOutline: this.getState().shape?.lassoOutline === false, lassoOutlineUserSet: true } });
            this.render();
        });
        this.color = host.querySelector('input[type="color"]');
        this.color.addEventListener('input', () => {
            this.fillChoice = 'custom'; this._setPaint(true, 'custom', this.color.value);
        });
    }

    _setPaint(fill, choice, fillColor = undefined) {
        const paint = !fill ? 'line' : choice;
        this.setOptions({ shape: { paint, ...(fillColor !== undefined ? { fillColor } : {}) } });
        this.render();
    }

    render() {
        const { tool, shape = {}, background = '#f0e0d6', main = '#800000' } = this.getState();
        const isLasso = tool === 'lasso-fill';
        const paint = shape.paint || 'legacy';
        const mode = paint === 'legacy' ? (isLasso || tool === 'shape-polygon' ? 'same' : 'line') : paint;
        const fill = mode !== 'line';
        if (fill) this.fillChoice = mode;
        const fillButton = this.host.querySelector('[data-fill]');
        fillButton.classList.toggle('active', fill);
        fillButton.setAttribute('aria-pressed', String(fill));
        fillButton.title = fill ? '内側を塗る：ON・クリックで線のみ' : '内側を塗る：OFF（線のみ）・クリックで塗り';
        this.host.querySelectorAll('[name="qa-shape-color"]').forEach(input => { input.checked = input.value === this.fillChoice; input.disabled = !fill; });
        this.host.querySelector('[data-switch="color"]').classList.toggle('is-disabled', !fill);
        this.host.querySelector('[data-polygon-hint]').hidden = tool !== 'shape-polygon';
        this.color.value = /^#[0-9a-f]{6}$/i.test(shape.fillColor || '') ? shape.fillColor : background;
        this.host.querySelector('[data-same-dot]').style.setProperty('--qa-shape-dot-color', main);
        this.host.querySelector('[data-custom-dot]').style.setProperty('--qa-shape-dot-color', this.color.value);
        this.color.disabled = !fill;
        this.color.closest('label').style.setProperty('--qa-shape-dot-color', this.color.value);
        this.color.closest('label').classList.toggle('is-disabled', !fill);
        const backgroundButton = this.host.querySelector('[data-background]');
        backgroundButton.disabled = !fill;
        const followsBackground = fill && this.fillChoice === 'custom' && shape.fillColor == null;
        backgroundButton.classList.toggle('active', followsBackground);
        backgroundButton.setAttribute('aria-pressed', String(followsBackground));
        const outline = this.host.querySelector('[data-outline]');
        const hasOutline = shape.lassoOutline !== false;
        outline.hidden = !isLasso;
        outline.disabled = !fill;
        outline.classList.toggle('active', hasOutline);
        outline.setAttribute('aria-pressed', String(hasOutline));
        outline.title = hasOutline ? '輪郭線あり（線幅＝SIZE）・クリックでなし' : '輪郭線なし・クリックであり';
    }
}

/** Erase has no paint colors. The same compact shelf explains its own gesture. */
export class ShapeEraseControls {
    constructor({ host, getState, setOptions }) {
        this.host = host; this.getState = getState;
        host.innerHTML = `<div class="qa-shape-switch" role="group" aria-label="多角形で消す範囲">
            <label title="SIZEの幅で輪郭の線を消す"><input type="radio" name="qa-polygon-erase" value="line"><span>線のみ</span></label>
            <label title="囲んだ内側を消す"><input type="radio" name="qa-polygon-erase" value="fill"><span>領域</span></label>
        </div><span data-erase-hint></span>`;
        host.addEventListener('pointerdown', event => event.stopPropagation());
        host.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
            setOptions({ shape: { erasePolygonMode: input.value } }); this.render();
        }));
    }
    render() {
        const { tool, shape = {} } = this.getState();
        this.host.querySelector('.qa-shape-switch').hidden = tool !== 'erase-polygon';
        this.host.querySelectorAll('input').forEach(input => { input.checked = input.value === (shape.erasePolygonMode || 'line'); });
        this.host.querySelector('[data-erase-hint]').textContent = tool === 'erase-polygon'
            ? '点を追加 → 始点/Enterで確定 · Esc取消' : '囲んで離すと内側を消去 · Esc取消';
    }
}
