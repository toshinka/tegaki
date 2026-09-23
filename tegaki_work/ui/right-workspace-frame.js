/**
 * ROLE: Single right workspace geometry, visibility and focus projection.
 * AUTHORITY: The Transform panel `show` class owns Transform sessions; the
 * runtime-only RIG lens is a view projection. LayerPanelRenderer supplies CAF
 * selection and RIG status. No edit, selection, or persistence state is owned.
 * INVARIANTS: Mount once before gestures; retain one Transform DOM; measure the
 * existing Drawing grid (including rail/scroll gutter), never add width.
 * RELATED: dom-builder.js, layer-panel-renderer.js, layer-transform.js.
 */
import { isTransformTimelineKeyTarget } from '../system/animation/transform-edit-transaction.js';

export class RightWorkspaceFrame {
    constructor(container, getTarget, layerSystem) {
        this.root = container?.closest?.('.right-panel');
        this.drawing = this.root?.querySelector('.layer-panel-container');
        this.host = this.root?.querySelector('#layer-panel-context-inspector');
        this.panel = document.getElementById('layer-transform-panel');
        this.getTarget = getTarget;
        this.layerSystem = layerSystem;
        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.rigLensReturnMode = 'basic';
        this.rigEntryMessage = '';
        this.lastRigTargetKey = null;
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
        this.actions = this.panel.querySelector('.transform-popup-actions');
        this.heading = this.panel.querySelector('.transform-popup-heading');
        this.endButton = document.createElement('button');
        this.endButton.type = 'button';
        this.endButton.className = 'gui-control gui-control--s transform-terminal-btn transform-terminal-confirm';
        this.endButton.textContent = '✓';
        this.endButton.title = 'Transformを確定して終了（V）';
        this.endButton.setAttribute('aria-keyshortcuts', 'V');
        this.endButton.addEventListener('click', () => {
            window.KeyboardHandler?.toggleLayerTransform?.('right-workspace');
        });
        this.cancelButton = document.createElement('button');
        this.cancelButton.type = 'button';
        this.cancelButton.className = 'gui-control gui-control--s transform-terminal-btn transform-terminal-cancel';
        this.cancelButton.textContent = '×';
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
        this.selectionHint.className = 'transform-selection-hint';
        this.selectionHint.textContent = '選択変形：既存の確定／取消操作';
        this.actions?.append(this.endButton, this.cancelButton);
        this.heading?.appendChild(this.selectionHint);

        this.rigEntryRow = document.createElement('div');
        this.rigEntryRow.className = 'right-workspace-rig-entry';
        this.rigEntryButton = document.createElement('button');
        this.rigEntryButton.type = 'button';
        this.rigEntryButton.className = 'gui-control gui-control--s';
        this.rigEntryButton.textContent = 'RIGを編集';
        this.rigEntryButton.setAttribute('aria-label', '選択中のCAF RasterのRIG SETUPを開く');
        this.rigEntryButton.title = 'Transformを終了してCAF内RasterのRIG SETUPを表示';
        this._rigEntryClickHandler = () => this._enterRigLens();
        this.rigEntryButton.addEventListener('click', this._rigEntryClickHandler);
        this.rigEntryMessageNode = document.createElement('span');
        this.rigEntryMessageNode.className = 'right-workspace-rig-entry-message';
        this.rigEntryMessageNode.setAttribute('role', 'status');
        this.rigEntryMessageNode.setAttribute('aria-live', 'polite');
        this.rigEntryRow.append(this.rigEntryButton, this.rigEntryMessageNode);
        this.panel.querySelector('.layer-transform-mode-strip')?.after(this.rigEntryRow);
        if (!this.rigEntryRow.parentElement) this.panel.appendChild(this.rigEntryRow);

        this.rigView = this._createRigLensView();
        this.host.append(this.title, this.rigView, this.panel);
        this.panel.classList.add('is-context-inspector');
        this.observer = new MutationObserver(() => this.sync());
        this.observer.observe(this.panel, { attributes: true, attributeFilter: ['class'] });
        this.resizeObserver = new ResizeObserver(() => this.measure());
        this.resizeObserver.observe(this.drawing);
        this.measure();
        this.sync();
    }

    _createRigLensView() {
        const view = document.createElement('section');
        view.className = 'right-workspace-rig-lens';
        view.setAttribute('aria-label', 'RIG SETUP');

        const header = document.createElement('div');
        header.className = 'right-workspace-rig-lens-header';
        const heading = document.createElement('h2');
        heading.textContent = 'RIG SETUP';
        this.rigReturnButton = document.createElement('button');
        this.rigReturnButton.type = 'button';
        this.rigReturnButton.className = 'gui-control gui-control--s';
        this.rigReturnButton.textContent = '← Transform';
        this.rigReturnButton.setAttribute('aria-label', '通常Transformへ戻る');
        this._rigReturnClickHandler = () => this._returnToTransform();
        this.rigReturnButton.addEventListener('click', this._rigReturnClickHandler);
        header.append(heading, this.rigReturnButton);

        const makeRegion = (label, className) => {
            const region = document.createElement('section');
            region.className = `right-workspace-rig-lens-region ${className}`;
            const title = document.createElement('h3');
            title.textContent = label;
            region.appendChild(title);
            return region;
        };

        this.rigLensWarning = document.createElement('p');
        this.rigLensWarning.className = 'right-workspace-rig-lens-warning';
        this.rigLensWarning.setAttribute('role', 'status');
        this.rigLensWarning.setAttribute('aria-live', 'polite');

        const target = makeRegion('TARGET', 'right-workspace-rig-lens-target');
        this.rigLensTargetName = document.createElement('strong');
        this.rigLensTargetKind = document.createElement('span');
        this.rigLensSharedAsset = document.createElement('span');
        target.append(this.rigLensTargetName, this.rigLensTargetKind, this.rigLensSharedAsset);

        const structure = makeRegion('STRUCTURE', 'right-workspace-rig-lens-structure');
        this.rigLensStructureContent = document.createElement('div');
        structure.appendChild(this.rigLensStructureContent);

        const properties = makeRegion('PROPERTIES / CANVAS TOOLS', 'right-workspace-rig-lens-properties');
        this.rigLensPropertiesContent = document.createElement('p');
        this.rigLensPropertiesContent.textContent = 'Root／Boneの編集操作は次の実装段階で接続します。';
        properties.appendChild(this.rigLensPropertiesContent);

        view.append(header, this.rigLensWarning, target, structure, properties);
        view.hidden = true;
        return view;
    }

    _showRigEntryMessage(message) {
        this.rigEntryMessage = message || '';
        this.rigEntryMessageNode.textContent = this.rigEntryMessage;
        this.rigEntryMessageNode.hidden = !this.rigEntryMessage;
    }

    _enterRigLens() {
        const target = this.getTarget?.()?.rigTarget || null;
        if (!target?.eligible || !target.assetId || !target.internalLayerId) {
            this._showRigEntryMessage(target?.reason || 'CAF内のRasterを選択してください。');
            return false;
        }

        const selection = window.CoreRuntime?.api?.selection;
        const pixelSelection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
        if (selection?.getState?.()?.transformSessionActive === true
            || pixelSelection?.getState?.()?.transformSessionActive === true) {
            this._showRigEntryMessage('選択範囲のTransformを確定または取消してから入場してください。');
            return false;
        }
        if (selection?.hasSelection?.() === true || pixelSelection?.hasSelection?.() === true) {
            this._showRigEntryMessage('選択範囲を解除してからRIG SETUPへ入場してください。');
            return false;
        }

        const keyboardActive = window.KeyboardHandler?.isVKeyPressed?.() === true;
        const layerActive = this.layerSystem?.transform?.isVKeyPressed === true;
        if (keyboardActive !== layerActive) {
            this._showRigEntryMessage('Transform状態を同期できません。通常の確定・取消経路を確認してください。');
            return false;
        }
        if (this.panel?.classList.contains('show') && !layerActive) {
            this._showRigEntryMessage('別のTransform操作が終了してから入場してください。');
            return false;
        }
        const commitState = this.layerSystem?.getLayerMoveCommitState?.() || null;
        if (commitState?.hasPendingTransform === true) {
            this._showRigEntryMessage('未確定の変形があります。SOURCE確定またはKEY確定／取消を先に行ってください。');
            return false;
        }

        this.rigLensReturnMode = this.layerSystem?.transform?.getTransformMode?.() === 'warp'
            ? 'warp'
            : 'basic';
        if (layerActive) {
            const exited = window.KeyboardHandler?.toggleLayerTransform?.('right-workspace-rig-lens-entry');
            if (exited !== true
                || window.KeyboardHandler?.isVKeyPressed?.() === true
                || this.layerSystem?.transform?.isVKeyPressed === true) {
                this._showRigEntryMessage('Transformを終了できませんでした。既存の確定・取消状態を確認してください。');
                return false;
            }
        }

        this.rigLensTarget = {
            assetId: target.assetId,
            internalLayerId: target.internalLayerId,
            assetName: target.assetName,
            layerName: target.layerName
        };
        this._showRigEntryMessage('');
        this.rigLensActive = true;
        this.sync();
        this.rigReturnButton.focus({ preventScroll: true });
        return true;
    }

    _returnToTransform() {
        if (!this.rigLensActive) return false;
        const selection = window.CoreRuntime?.api?.selection;
        const pixelSelection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
        if (selection?.getState?.()?.transformSessionActive === true
            || pixelSelection?.getState?.()?.transformSessionActive === true
            || selection?.hasSelection?.() === true
            || pixelSelection?.hasSelection?.() === true) {
            this._showRigEntryMessage('選択範囲の操作を終えてから通常Transformへ戻ってください。');
            return false;
        }
        if (window.KeyboardHandler?.isVKeyPressed?.() === true
            && this.layerSystem?.transform?.isVKeyPressed === true) {
            this.rigLensActive = false;
            this.rigLensTarget = null;
            this.sync();
            return true;
        }

        const entered = window.KeyboardHandler?.toggleLayerTransform?.(
            'right-workspace-rig-lens-return',
            { preserveMotionWindow: true }
        );
        if (entered !== true
            || window.KeyboardHandler?.isVKeyPressed?.() !== true
            || this.layerSystem?.transform?.isVKeyPressed !== true) {
            this._showRigEntryMessage('通常Transformへ戻れませんでした。選択Layerと既存Transform guardを確認してください。');
            return false;
        }

        this.rigLensActive = false;
        this.rigLensTarget = null;
        this.sync();
        if (this.rigLensReturnMode === 'warp') {
            this.layerSystem?.transform?.setTransformMode?.('warp');
        }
        this.title.focus({ preventScroll: true });
        return true;
    }

    _renderRigLens(target) {
        const rigTarget = target?.rigTarget || null;
        const matchesTarget = rigTarget?.assetId === this.rigLensTarget?.assetId
            && rigTarget?.internalLayerId === this.rigLensTarget?.internalLayerId;
        this.rigLensTargetName.textContent = matchesTarget
            ? `${rigTarget.assetName} / ${rigTarget.layerName}`
            : `${this.rigLensTarget?.assetName || 'CAF'} / ${this.rigLensTarget?.layerName || 'Raster'}`;
        this.rigLensTargetKind.textContent = matchesTarget ? 'CAF内 Raster' : '対象選択を確認';
        this.rigLensSharedAsset.textContent = matchesTarget
            ? 'Setupは共有CAF Assetへ保存され、同じ原画を使うClipにも反映されます。'
            : '';
        this.rigLensWarning.hidden = matchesTarget && !this.rigEntryMessage;
        this.rigLensWarning.textContent = !matchesTarget
            ? 'CAFまたはRasterの選択が変わっています。対象を確認してからTransformへ戻ってください。'
            : this.rigEntryMessage;
        this.rigLensStructureContent.replaceChildren();

        if (!matchesTarget) {
            const message = document.createElement('p');
            message.textContent = '現在の選択と入場時の対象が一致しないため、構造情報を表示していません。';
            this.rigLensStructureContent.appendChild(message);
            return;
        }

        const status = document.createElement('p');
        status.textContent = `状態: ${rigTarget.status || 'RIG未設定'}`;
        this.rigLensStructureContent.appendChild(status);
        if (rigTarget.bones?.length) {
            const list = document.createElement('ul');
            list.setAttribute('aria-label', '対象RasterのBone構造');
            rigTarget.bones.forEach(bone => {
                const item = document.createElement('li');
                const parent = bone.parentBoneId
                    ? ` · parent ${bone.parentBoneId}`
                    : ' · ROOT';
                item.textContent = `${bone.name}${parent}`;
                list.appendChild(item);
            });
            this.rigLensStructureContent.appendChild(list);
        } else if (rigTarget.unboundBoneCount > 0) {
            const candidates = document.createElement('p');
            candidates.textContent = `Asset内に未接続Bone候補 ${rigTarget.unboundBoneCount}件（このRasterへの接続は未確認）`;
            this.rigLensStructureContent.appendChild(candidates);
        } else {
            const empty = document.createElement('p');
            empty.textContent = 'Root／Boneは未設定です。';
            this.rigLensStructureContent.appendChild(empty);
        }

        if (rigTarget.hasMesh) {
            const mesh = document.createElement('p');
            mesh.textContent = `MESH: ${rigTarget.meshGeneratorLabel || '設定済み'} · ${rigTarget.meshState} / WEIGHT: ${rigTarget.weightState}`;
            this.rigLensStructureContent.appendChild(mesh);
        }
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
        if (this.rigLensActive) {
            if (mode === 'layer') {
                this.rigLensActive = false;
                this.rigLensTarget = null;
                this.sync();
                this.layerModeButton?.focus({ preventScroll: true });
            } else {
                this._returnToTransform();
            }
            return;
        }
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
            this.actions?.classList.add('is-exit-choice-requested');
            const target = this.layerSystem?.getActiveTransformEditTarget?.();
            const keyButton = isTransformTimelineKeyTarget(target)
                ? this.panel.querySelector('#layer-transform-key-commit-btn')
                : null;
            (keyButton && !keyButton.disabled ? keyButton : this.endButton)?.focus?.({ preventScroll: true });
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
            if (payload.name === 'animationTable') {
                this._syncStatusMount();
                this.sync();
            }
        };
        this._popupHiddenHandler = (payload = {}) => {
            if (payload.name === 'animationTable') {
                this._syncStatusMount();
                this.sync();
            }
        };
        this._dockStateHandler = () => {
            this._syncStatusMount();
            this.sync();
        };
        this.eventBus.on('popup:shown', this._popupShownHandler);
        this.eventBus.on('popup:hidden', this._popupHiddenHandler);
        this.eventBus.on('animation-table:dock-state-changed', this._dockStateHandler);
    }

    _syncTransformActions(layerEditing) {
        const target = this.layerSystem?.getActiveTransformEditTarget?.();
        const animate = isTransformTimelineKeyTarget(target);
        const resetButton = this.panel?.querySelector('#layer-transform-reset-btn');

        this.endButton.hidden = !layerEditing || animate;
        if (layerEditing && !animate) {
            this.endButton.textContent = '✓';
            this.endButton.title = '変形をSOURCE Rasterへ確定してTransformを終了（変更なしなら終了のみ、V）';
            this.endButton.setAttribute('aria-label', 'SOURCE変形をRasterへ確定してTransformを終了');
        }

        // Dirty display stays neutral: the shared pending projection can remain
        // true after a SOURCE Reset returns the artwork to its entry pose.
        resetButton?.classList.remove('is-transform-pending');
        resetButton?.setAttribute('aria-label', '変形をリセット');
        if (resetButton) {
            resetButton.title = '現在のTransformを初期状態へ戻す';
        }
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
        const transformActive = this.panel?.classList.contains('show') === true
            || this.rigLensActive;
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
        const transformSessionVisible = this.panel.classList.contains('show');
        if (transformSessionVisible && this.rigLensActive) {
            this.rigLensActive = false;
            this.rigLensTarget = null;
        }
        const rigLensVisible = this.rigLensActive;
        const active = transformSessionVisible || rigLensVisible;
        const surface = rigLensVisible ? 'rig' : (transformSessionVisible ? 'transform' : 'layer');
        const previousSurface = this.currentSurface || surface;
        this.layerModeButton?.classList.toggle('is-selected', !active);
        this.layerModeButton?.setAttribute('aria-pressed', String(!active));
        this.transformModeButton?.classList.toggle('is-selected', active);
        this.transformModeButton?.setAttribute('aria-pressed', String(active));
        if (!active) this.actions?.classList.remove('is-exit-choice-requested');
        this.root.classList.toggle('has-transform-workspace', active);
        this.root.classList.toggle('is-rig-lens-active', rigLensVisible);
        document.documentElement.classList.toggle('right-workspace-transform-active', active);
        this.drawing.inert = active;
        if (active) this.drawing.setAttribute('aria-hidden', 'true');
        else this.drawing.removeAttribute('aria-hidden');
        this.host.hidden = !active;
        this.host.inert = !active;
        this.host.setAttribute('aria-label', rigLensVisible ? 'RIG SETUP作業面' : 'Transform 作業面');
        this.rigView.hidden = !rigLensVisible;
        this.panel.hidden = rigLensVisible;
        this.rigEntryRow.hidden = rigLensVisible;
        const target = this.getTarget?.() || {};
        const label = target.label || 'Transform';
        this.label.textContent = label;
        this.title.title = label;
        const source = this.drawing.querySelector(
            '.layer-panel-card-row.is-selected img, .clip-layer-mirror-row.is-selected img'
        );
        this.thumbnail.hidden = !source;
        if (source && this.thumbnail.getAttribute('src') !== source.getAttribute('src')) {
            this.thumbnail.setAttribute('src', source.getAttribute('src'));
        }
        const rigTarget = target.rigTarget || null;
        const rigTargetKey = rigTarget?.assetId && rigTarget?.internalLayerId
            ? `${rigTarget.assetId}:${rigTarget.internalLayerId}`
            : '';
        if (rigTargetKey !== this.lastRigTargetKey) {
            this.lastRigTargetKey = rigTargetKey;
            this.rigEntryMessage = '';
        }
        const rigEntryMessage = this.rigEntryMessage
            || (rigTarget?.eligible === true
                ? ''
                : (rigTarget?.reason || 'CAF内のRasterを選択してからRIGを編集してください。'));
        this.rigEntryMessageNode.textContent = rigEntryMessage;
        this.rigEntryMessageNode.hidden = !rigEntryMessage;
        this._renderRigLens(target);
        const layerEditing = this.layerSystem?.transform?.isVKeyPressed === true;
        this.cancelButton.hidden = !layerEditing;
        this.selectionHint.hidden = layerEditing;
        this._syncTransformActions(layerEditing);
        this._syncStatusMount();
        if (surface !== previousSurface) {
            if (surface === 'rig') this.rigReturnButton.focus({ preventScroll: true });
            else if (surface === 'transform') this.title.focus({ preventScroll: true });
            else this.layerModeButton?.focus({ preventScroll: true });
        }
        this.currentSurface = surface;
    }

    destroy() {
        this.observer?.disconnect();
        this.resizeObserver?.disconnect();
        this.layerModeButton?.removeEventListener('click', this._layerModeClickHandler);
        this.transformModeButton?.removeEventListener('click', this._transformModeClickHandler);
        this.rigEntryButton?.removeEventListener('click', this._rigEntryClickHandler);
        this.rigReturnButton?.removeEventListener('click', this._rigReturnClickHandler);
        this.rigEntryRow?.remove();
        this.rigView?.remove();
        this.modeSwitch?.remove();
        if (this.eventBus?.off) {
            this.eventBus.off('popup:shown', this._popupShownHandler);
            this.eventBus.off('popup:hidden', this._popupHiddenHandler);
            this.eventBus.off('animation-table:dock-state-changed', this._dockStateHandler);
        }
        document.documentElement.classList.remove('right-workspace-transform-active');
        this.root?.classList.remove('has-transform-workspace', 'is-rig-lens-active');
        if (this.panel) this.panel.hidden = false;
        this._restoreStatusPanel();
        // Teardown does not move a live editing DOM or finish its transaction.
    }
}
