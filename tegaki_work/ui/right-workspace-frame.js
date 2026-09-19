/**
 * ROLE: Single right workspace geometry, visibility and focus projection.
 * AUTHORITY: The existing Transform panel's `show` class owns visibility;
 * LayerPanelRenderer owns Drawing/CAF/RIG content. No edit/selection state here.
 * INVARIANTS: Mount once before gestures; retain one Transform DOM; measure the
 * existing Drawing grid (including rail/scroll gutter), never add width.
 * RELATED: dom-builder.js, layer-panel-renderer.js, layer-transform.js.
 */
export class RightWorkspaceFrame {
    constructor(container, getTarget, layerSystem) {
        this.root = container?.closest?.('.right-panel');
        this.drawing = this.root?.querySelector('.layer-panel-container');
        this.host = this.root?.querySelector('#layer-panel-context-inspector');
        this.panel = document.getElementById('layer-transform-panel');
        this.getTarget = getTarget;
        this.layerSystem = layerSystem;
        if (!this.root || !this.drawing || !this.host || !this.panel) return;

        this.root.classList.add('right-workspace-frame');
        this.host.setAttribute('aria-label', 'Transform 作業面');
        this.title = document.createElement('div');
        this.title.className = 'right-workspace-target';
        this.title.tabIndex = -1;
        this.thumbnail = document.createElement('img');
        this.thumbnail.alt = '';
        this.label = document.createElement('span');
        this.title.append(this.thumbnail, this.label);
        this.hint = document.createElement('div');
        this.hint.className = 'right-workspace-terminal';
        this.endButton = document.createElement('button');
        this.endButton.type = 'button';
        this.endButton.textContent = '確定して終了 · V';
        this.endButton.addEventListener('click', () => {
            window.KeyboardHandler?.toggleLayerTransform?.('right-workspace');
        });
        this.cancelButton = document.createElement('button');
        this.cancelButton.type = 'button';
        this.cancelButton.textContent = '取消 · Esc';
        this.cancelButton.addEventListener('click', () => {
            // Same capture rescue and event payload as the existing Escape route.
            const selection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
            if (selection?.isTransformPreviewCaptureActive?.()) {
                selection.exitTransformPreviewCapture({ cancelSourceTransform: true });
            }
            this.layerSystem?.eventBus?.emit('keyboard:vkey-state-changed', {
                pressed: false, cancelled: true
            });
        });
        this.selectionHint = document.createElement('span');
        this.selectionHint.textContent = '選択変形：既存の確定／取消操作';
        this.hint.append(this.endButton, this.cancelButton, this.selectionHint);
        this.host.append(this.title, this.panel, this.hint);
        this.panel.classList.add('is-context-inspector');
        this.observer = new MutationObserver(() => this.sync());
        this.observer.observe(this.panel, { attributes: true, attributeFilter: ['class'] });
        this.resizeObserver = new ResizeObserver(() => this.measure());
        this.resizeObserver.observe(this.drawing);
        this.measure();
        this.sync();
    }

    measure() {
        // Drawing stays laid out but inert/invisible while Transform is shown.
        // Its natural grid therefore remains the live budget, including coarse
        // input and scrollbar changes, without transiently exposing its controls.
        const width = this.drawing?.getBoundingClientRect().width;
        if (width > 0) this.root.style.setProperty('--right-workspace-width', `${width}px`);
    }

    sync() {
        if (!this.host || !this.panel || !this.drawing) return;
        const active = this.panel.classList.contains('show');
        const outgoing = active ? this.drawing : this.host;
        const hadFocus = outgoing.contains(document.activeElement);
        this.root.classList.toggle('has-transform-workspace', active);
        this.drawing.inert = active;
        if (active) this.drawing.setAttribute('aria-hidden', 'true');
        else this.drawing.removeAttribute('aria-hidden');
        this.host.hidden = !active;
        this.host.inert = !active;
        const label = this.getTarget?.()?.label || 'Transform';
        this.label.textContent = label;
        this.title.title = label;
        const source = this.drawing.querySelector('.layer-panel-card-row.is-selected img');
        this.thumbnail.hidden = !source;
        if (source && this.thumbnail.getAttribute('src') !== source.getAttribute('src')) {
            this.thumbnail.setAttribute('src', source.getAttribute('src'));
        }
        const layerEditing = this.layerSystem?.transform?.isVKeyPressed === true;
        this.endButton.hidden = !layerEditing;
        this.cancelButton.hidden = !layerEditing;
        this.selectionHint.hidden = layerEditing;
        if (hadFocus) {
            if (active) this.title.focus({ preventScroll: true });
            else document.getElementById('layer-transform-tool')?.focus({ preventScroll: true });
        }
    }

    destroy() {
        this.observer?.disconnect();
        this.resizeObserver?.disconnect();
        // Teardown does not move a live editing DOM or finish its transaction.
    }
}
