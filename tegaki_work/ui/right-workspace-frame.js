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
        this.eventBus = this.layerSystem?.eventBus || window.TegakiEventBus;
        this.statusPanel = document.querySelector('.status-panel');
        this.statusAnchor = null;
        this.dock = document.getElementById('animation-table-popup');
        this._popupShownHandler = null;
        this._popupHiddenHandler = null;
        this._dockStateHandler = null;
        if (!this.root || !this.drawing || !this.host || !this.panel) return;

        this.root.classList.add('right-workspace-frame');
        this._mountModeSwitch();
        this._mountStatusPanel();
        this._subscribeLayoutEvents();
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
        this.endButton.className = 'gui-control gui-control--l gui-control--primary';
        this.endButton.textContent = '✓ 確定';
        this.endButton.title = 'Transformを確定して終了（V）';
        this.endButton.setAttribute('aria-keyshortcuts', 'V');
        this.endButton.addEventListener('click', () => {
            window.KeyboardHandler?.toggleLayerTransform?.('right-workspace');
        });
        this.cancelButton = document.createElement('button');
        this.cancelButton.type = 'button';
        this.cancelButton.className = 'gui-control gui-control--l';
        this.cancelButton.textContent = '× 取消';
        this.cancelButton.title = 'Transformを取り消して終了（Esc）';
        this.cancelButton.setAttribute('aria-keyshortcuts', 'Escape');
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

    _mountModeSwitch() {
        this.modeSwitch = this.root.querySelector(':scope > .right-workspace-mode-switch');
        if (!this.modeSwitch) {
            this.modeSwitch = document.createElement('div');
            this.modeSwitch.className = 'right-workspace-mode-switch';
            this.modeSwitch.setAttribute('role', 'group');
            this.modeSwitch.setAttribute('aria-label', '右Workspaceの表示');

            this.layerModeButton = document.createElement('button');
            this.layerModeButton.type = 'button';
            this.layerModeButton.className = 'right-workspace-mode-segment';
            this.layerModeButton.dataset.workspaceMode = 'layer';
            this.layerModeButton.textContent = 'LAYER';

            this.transformModeButton = document.createElement('button');
            this.transformModeButton.type = 'button';
            this.transformModeButton.className = 'right-workspace-mode-segment';
            this.transformModeButton.dataset.workspaceMode = 'transform';
            this.transformModeButton.textContent = 'TRANSFORM';

            this.modeSwitch.append(this.layerModeButton, this.transformModeButton);
            this.root.insertBefore(this.modeSwitch, this.drawing);
        } else {
            this.layerModeButton = this.modeSwitch.querySelector('[data-workspace-mode="layer"]');
            this.transformModeButton = this.modeSwitch.querySelector('[data-workspace-mode="transform"]');
        }

        this._layerModeClickHandler = () => this._requestWorkspaceMode('layer');
        this._transformModeClickHandler = () => this._requestWorkspaceMode('transform');
        this.layerModeButton?.addEventListener('click', this._layerModeClickHandler);
        this.transformModeButton?.addEventListener('click', this._transformModeClickHandler);
    }

    _requestWorkspaceMode(mode) {
        const transformActive = this.panel?.classList.contains('show') === true;
        if (mode === 'transform') {
            if (transformActive) return;
            // The existing V entry remains the sole guard and state owner.
            window.KeyboardHandler?.toggleLayerTransform?.('right-workspace-segment');
            this.sync();
            return;
        }
        if (!transformActive) return;

        const layerEditing = this.layerSystem?.transform?.isVKeyPressed === true;
        const commitState = this.layerSystem?.getLayerMoveCommitState?.() || null;
        if (layerEditing && commitState?.hasPendingTransform === true) {
            // A segment change must not choose confirm or cancel for the user.
            // Keep Transform projected and move focus to the existing terminal.
            this.hint?.classList.add('is-exit-choice-requested');
            this.endButton?.focus?.({ preventScroll: true });
            return;
        }
        if (!layerEditing) {
            // Selection Transform owns its own terminal; do not route it through
            // the Layer V contract merely because the shared panel is visible.
            this.title?.focus?.({ preventScroll: true });
            return;
        }
        window.KeyboardHandler?.toggleLayerTransform?.('right-workspace-segment');
        this.sync();
    }

    _mountStatusPanel() {
        if (!this.statusPanel) return;
        if (this.statusPanel.parentElement !== this.root) {
            this.statusAnchor = document.createComment('right-workspace-status-anchor');
            this.statusPanel.parentNode?.insertBefore(this.statusAnchor, this.statusPanel);
            this.root.appendChild(this.statusPanel);
        }
        this.statusPanel.classList.add('right-workspace-status');
        document.documentElement.classList.add('right-workspace-status-active');
        this._syncStatusMount();
    }

    _subscribeLayoutEvents() {
        if (!this.eventBus?.on) return;
        this._popupShownHandler = (payload = {}) => {
            if (payload.name === 'animationTable') this._syncStatusMount();
        };
        this._popupHiddenHandler = (payload = {}) => {
            if (payload.name === 'animationTable') this._syncStatusMount();
        };
        this._dockStateHandler = () => this._syncStatusMount();
        this.eventBus.on('popup:shown', this._popupShownHandler);
        this.eventBus.on('popup:hidden', this._popupHiddenHandler);
        this.eventBus.on('animation-table:dock-state-changed', this._dockStateHandler);
    }

    _getDockStatusSlot(state) {
        if (!this.dock) return null;
        const selector = state === 'collapsed'
            ? '.anim-dock-status-slot--compact'
            : '.anim-dock-status-slot--footer';
        return this.dock.querySelector(selector);
    }

    _syncStatusMount() {
        if (!this.statusPanel || !this.root) return;
        const dockVisible = this.dock
            && this.dock.classList.contains('is-bottom-dock')
            && this.dock.style.display !== 'none';
        const transformActive = this.panel?.classList.contains('show') === true;
        const dockState = this.dock?.dataset?.dockState || 'compact';
        const dockSlot = dockVisible && !transformActive
            ? this._getDockStatusSlot(dockState)
            : null;
        const target = dockSlot || this.root;
        const inDock = target !== this.root;
        if (this.statusPanel.parentElement !== target) target.appendChild(this.statusPanel);
        this.statusPanel.classList.toggle('right-workspace-status', !inDock);
        this.statusPanel.classList.toggle('animation-table-dock-status', inDock);
    }

    _restoreStatusPanel() {
        if (!this.statusPanel) return;
        if (this.statusAnchor?.parentNode) {
            this.statusAnchor.parentNode.insertBefore(this.statusPanel, this.statusAnchor.nextSibling);
        }
        this.statusPanel.classList.remove('right-workspace-status', 'animation-table-dock-status');
        document.documentElement.classList.remove('right-workspace-status-active');
        this.statusAnchor?.remove();
        this.statusAnchor = null;
    }

    measure() {
        // Drawing stays laid out but inert/invisible while Transform is shown.
        // Its natural grid therefore remains the live budget, including coarse
        // input and scrollbar changes, without transiently exposing its controls.
        const width = this.drawing?.getBoundingClientRect().width;
        if (width > 0) {
            // Publish the existing single measurement to all layout surfaces.
            // Dock and Canvas inherit this budget; neither measures the rail.
            document.documentElement.style.setProperty('--right-workspace-width', `${width}px`);
            window.coreEngine?.getApp?.()?.resize?.();
        }
    }

    sync() {
        if (!this.host || !this.panel || !this.drawing) return;
        const active = this.panel.classList.contains('show');
        const outgoing = active ? this.drawing : this.host;
        const hadFocus = outgoing.contains(document.activeElement);
        this.layerModeButton?.classList.toggle('is-selected', !active);
        this.layerModeButton?.setAttribute('aria-pressed', String(!active));
        this.transformModeButton?.classList.toggle('is-selected', active);
        this.transformModeButton?.setAttribute('aria-pressed', String(active));
        if (!active) this.hint?.classList.remove('is-exit-choice-requested');
        this.root.classList.toggle('has-transform-workspace', active);
        document.documentElement.classList.toggle('right-workspace-transform-active', active);
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
        this._syncStatusMount();
        if (hadFocus) {
            if (active) this.title.focus({ preventScroll: true });
            else document.getElementById('layer-transform-tool')?.focus({ preventScroll: true });
        }
    }

    destroy() {
        this.observer?.disconnect();
        this.resizeObserver?.disconnect();
        this.layerModeButton?.removeEventListener('click', this._layerModeClickHandler);
        this.transformModeButton?.removeEventListener('click', this._transformModeClickHandler);
        this.modeSwitch?.remove();
        if (this.eventBus?.off) {
            this.eventBus.off('popup:shown', this._popupShownHandler);
            this.eventBus.off('popup:hidden', this._popupHiddenHandler);
            this.eventBus.off('animation-table:dock-state-changed', this._dockStateHandler);
        }
        document.documentElement.classList.remove('right-workspace-transform-active');
        this._restoreStatusPanel();
        // Teardown does not move a live editing DOM or finish its transaction.
    }
}
