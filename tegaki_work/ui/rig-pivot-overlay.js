/**
 * RIG Setup中のCAF / Folder PIVOTを同時表示するCanvas overlay。
 * 表示とpointer gestureの一時状態だけを所有し、static Bind正本、History、座標代数は
 * AnimationTablePopupから受け取る。未設定Folderの導出PIVOTも同じ見た目で表示できる。
 * 重なったhit領域はDOM順ではなくpointerに最も近いroot / tailを選び、親子PIVOTの
 * 選択・wheel・dragが隣接PIVOTへ飛ばないようにする。
 */
export class RigPivotOverlay {
    constructor() {
        this.element = null;
        this.options = null;
        this.frameRequest = null;
        this.gesture = null;
        this.screenItems = [];
        this._escapeHandler = null;
        this._longPressTimer = null;
    }

    activate(options = {}) {
        if (!options.coordinateSystem || typeof options.getItems !== 'function') return false;
        this.options = options;
        this._ensureElement();
        this.element.classList.toggle('is-motion', options.mode === 'motion');
        this.element.classList.toggle('is-warp-anchor', options.mode === 'warp-anchor');
        this.element.hidden = false;
        if (this.frameRequest === null) this._update();
        return true;
    }

    deactivate() {
        if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
        this.frameRequest = null;
        if (this.gesture) this._finishGesture(null, true);
        this._clearLongPressTimer();
        this.options = null;
        this.screenItems = [];
        this.element?.remove();
        this.element = null;
        if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler, true);
        this._escapeHandler = null;
    }

    isActive() {
        return !!this.options;
    }

    getScreenItems() {
        return this.screenItems.map(item => ({
            ...item,
            root: { ...item.root },
            tail: { ...item.tail }
        }));
    }

    _ensureElement() {
        if (this.element?.isConnected) return;
        document.querySelectorAll('.rig-pivot-overlay').forEach(element => element.remove());
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(namespace, 'svg');
        svg.classList.add('rig-pivot-overlay');
        svg.setAttribute('aria-label', 'Rig pivots');
        document.body.appendChild(svg);
        this.element = svg;

        svg.addEventListener('pointerdown', event => {
            if (event.button !== 0 || !this.options || this.gesture) return;
            const target = this._resolvePointerTarget(event);
            if (!target) return;
            const { item, mode } = target;
            if ((mode === 'move' && item.canMove === false)
                || (mode === 'rotate' && item.canRotate === false)) {
                this.options.onSelect?.(item.id, event);
                return;
            }
            const canLink = this.options.enableLinkGesture === true
                && item.kind !== 'caf'
                && item.configured === true
                && (mode === 'move' || mode === 'link')
                && typeof this.options.onLinkEnd === 'function';
            if (canLink) {
                this.gesture = {
                    pointerId: event.pointerId,
                    itemId: item.id,
                    mode: 'pending-link',
                    fallbackMode: mode === 'move' ? 'move' : null,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    moved: false,
                    linkTargetId: null
                };
                this._longPressTimer = setTimeout(() => {
                    if (!this.gesture
                        || this.gesture.pointerId !== event.pointerId
                        || this.gesture.mode !== 'pending-link') return;
                    this._beginLinkGesture(this.gesture);
                }, 380);
                svg.setPointerCapture?.(event.pointerId);
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (this.options.onGestureStart?.(item.id, mode, event) === false) return;
            this.gesture = { pointerId: event.pointerId, itemId: item.id, mode, moved: false };
            svg.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
        });
        svg.addEventListener('pointermove', event => {
            if (!this.gesture || event.pointerId !== this.gesture.pointerId || !this.options) return;
            if (this.gesture.mode === 'pending-link') {
                const distance = Math.hypot(
                    event.clientX - this.gesture.startClientX,
                    event.clientY - this.gesture.startClientY
                );
                if (distance < 4) return;
                this._clearLongPressTimer();
                if (this.gesture.fallbackMode === 'move') {
                    const startEvent = {
                        clientX: this.gesture.startClientX,
                        clientY: this.gesture.startClientY,
                        pointerId: this.gesture.pointerId
                    };
                    if (this.options.onGestureStart?.(
                        this.gesture.itemId,
                        this.gesture.fallbackMode,
                        startEvent
                    ) === false) {
                        this._finishGesture(event, true);
                        return;
                    }
                    this.gesture.mode = this.gesture.fallbackMode;
                    this.gesture.moved = true;
                    this.options.onGestureMove?.(this.gesture.itemId, this.gesture.mode, event);
                } else {
                    this._beginLinkGesture(this.gesture);
                    this._moveLinkGesture(event);
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (this.gesture.mode === 'link') {
                this._moveLinkGesture(event);
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            this.gesture.moved = true;
            this.options.onGestureMove?.(this.gesture.itemId, this.gesture.mode, event);
            event.preventDefault();
            event.stopImmediatePropagation();
        });
        const finish = event => {
            if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
            this._finishGesture(event, event.type !== 'pointerup');
        };
        svg.addEventListener('pointerup', finish);
        svg.addEventListener('pointercancel', finish);
        svg.addEventListener('lostpointercapture', finish);
        svg.addEventListener('wheel', event => {
            if (!this.options) return;
            const target = this._resolvePointerTarget(event);
            if (!target) return;
            const { item } = target;
            this.options.onWheel?.(item.id, event);
            event.preventDefault();
            event.stopImmediatePropagation();
        }, { passive: false });
        this._escapeHandler = event => {
            if (event.key !== 'Escape' || !this.gesture) return;
            this._finishGesture(event, true);
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        document.addEventListener('keydown', this._escapeHandler, true);
    }

    _resolvePointerTarget(event) {
        const connection = event?.target?.closest?.('[data-rig-child-id]');
        if (connection) {
            const item = this.screenItems.find(candidate => candidate.id === connection.dataset.rigChildId);
            if (item) return { item, mode: 'link' };
        }
        const clientX = Number(event?.clientX);
        const clientY = Number(event?.clientY);
        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
            const hits = this.screenItems.flatMap((item, itemIndex) => [
                { item, itemIndex, mode: 'move', point: item.root },
                { item, itemIndex, mode: 'rotate', point: item.tail }
            ]).map(hit => ({
                ...hit,
                distance: Math.hypot(clientX - hit.point.x, clientY - hit.point.y)
            })).filter(hit => hit.distance <= 18);
            if (hits.length > 0) {
                hits.sort((a, b) => {
                    const distanceDelta = a.distance - b.distance;
                    if (Math.abs(distanceDelta) > 0.5) return distanceDelta;
                    if (a.item.active !== b.item.active) return a.item.active ? -1 : 1;
                    return b.itemIndex - a.itemIndex;
                });
                return hits[0];
            }
        }

        const group = event?.target?.closest?.('[data-rig-pivot-id]');
        if (!group) return null;
        const item = this.screenItems.find(candidate => candidate.id === group.dataset.rigPivotId);
        if (!item) return null;
        return {
            item,
            mode: event.target.closest?.('.rig-pivot-overlay__tail-hit') ? 'rotate' : 'move'
        };
    }

    _finishGesture(event, cancelled) {
        const gesture = this.gesture;
        if (!gesture) return;
        this._clearLongPressTimer();
        this.gesture = null;
        if (event?.pointerId != null && this.element?.hasPointerCapture?.(event.pointerId)) {
            this.element.releasePointerCapture(event.pointerId);
        }
        if (gesture.mode === 'pending-link') {
            this.options?.onSelect?.(gesture.itemId, event);
        } else if (gesture.mode === 'link') {
            const linkTargetId = cancelled ? null : gesture.linkTargetId || null;
            this._clearLinkPreview();
            this.options?.onLinkEnd?.(gesture.itemId, linkTargetId, {
                cancelled,
                event
            });
        } else {
            this.options?.onGestureEnd?.(gesture.itemId, gesture.mode, {
                cancelled,
                moved: gesture.moved,
                event
            });
        }
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
    }

    _clearLongPressTimer() {
        if (this._longPressTimer !== null) clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
    }

    _beginLinkGesture(gesture) {
        if (!gesture || gesture.mode === 'link') return;
        this._clearLongPressTimer();
        gesture.mode = 'link';
        gesture.moved = true;
        this.options?.onSelect?.(gesture.itemId, null);
        this.element?.classList.add('is-linking');
        this._renderLinkPreview(gesture);
    }

    _moveLinkGesture(event) {
        const gesture = this.gesture;
        if (!gesture || gesture.mode !== 'link') return;
        gesture.clientX = event.clientX;
        gesture.clientY = event.clientY;
        const candidates = this.screenItems
            .filter(item => item.id !== gesture.itemId && item.kind !== 'caf' && item.configured === true)
            .map(item => ({
                item,
                distance: Math.hypot(event.clientX - item.root.x, event.clientY - item.root.y)
            }))
            .filter(candidate => candidate.distance <= 22)
            .sort((a, b) => a.distance - b.distance);
        gesture.linkTargetId = candidates[0]?.item?.id || null;
        this._renderLinkPreview(gesture);
    }

    _renderLinkPreview(gesture) {
        if (!this.element || !gesture) return;
        const child = this.screenItems.find(item => item.id === gesture.itemId) || null;
        const preview = this.element.querySelector('.rig-pivot-overlay__link-preview');
        if (!child || !preview) return;
        preview.hidden = false;
        preview.setAttribute('x1', String(child.root.x));
        preview.setAttribute('y1', String(child.root.y));
        preview.setAttribute('x2', String(gesture.clientX ?? child.root.x));
        preview.setAttribute('y2', String(gesture.clientY ?? child.root.y));
        this.element.querySelectorAll('.rig-pivot-overlay__pivot.is-link-target').forEach(group => {
            group.classList.remove('is-link-target');
        });
        if (gesture.linkTargetId) {
            const target = [...this.element.querySelectorAll('[data-rig-pivot-id]')]
                .find(group => group.dataset.rigPivotId === gesture.linkTargetId);
            target?.classList.add('is-link-target');
        }
    }

    _clearLinkPreview() {
        this.element?.classList.remove('is-linking');
        const preview = this.element?.querySelector('.rig-pivot-overlay__link-preview');
        if (preview) preview.hidden = true;
        this.element?.querySelectorAll('.rig-pivot-overlay__pivot.is-link-target').forEach(group => {
            group.classList.remove('is-link-target');
        });
    }

    _toScreen(point) {
        const coordinateSystem = this.options?.coordinateSystem;
        const screen = coordinateSystem?.worldToScreenImmediate?.(point.x, point.y)
            || coordinateSystem?.worldToScreen?.(point.x, point.y);
        return screen && Number.isFinite(screen.clientX) && Number.isFinite(screen.clientY)
            ? { x: screen.clientX, y: screen.clientY }
            : null;
    }

    _update() {
        if (!this.options || !this.element) return;
        if (this.options.shouldDisplay?.() === false) {
            this.deactivate();
            return;
        }
        const items = (this.options.getItems?.() || []).flatMap(item => {
            const root = item?.root ? this._toScreen(item.root) : null;
            const tail = item?.tail ? this._toScreen(item.tail) : null;
            return root && tail ? [{ ...item, root, tail }] : [];
        });
        this.screenItems = items;
        this.element.hidden = items.length === 0;
        const ids = items.map(item => `${item.id}:${item.parentId || ''}`).join('|');
        if (this.element.dataset.itemIds !== ids) {
            this.element.dataset.itemIds = ids;
            this._rebuildGroups(items);
        }
        items.forEach(item => this._updateGroup(item));
        if (this.gesture?.mode === 'link') this._renderLinkPreview(this.gesture);
        this.frameRequest = requestAnimationFrame(() => this._update());
    }

    _rebuildGroups(items) {
        const namespace = 'http://www.w3.org/2000/svg';
        this.element.replaceChildren();
        const connections = document.createElementNS(namespace, 'g');
        connections.classList.add('rig-pivot-overlay__connections');
        items.forEach(item => {
            if (!item.parentId) return;
            const line = document.createElementNS(namespace, 'line');
            line.classList.add('rig-pivot-overlay__connection');
            line.dataset.rigChildId = item.id;
            connections.appendChild(line);
            const hitLine = document.createElementNS(namespace, 'line');
            hitLine.classList.add('rig-pivot-overlay__connection-hit');
            hitLine.dataset.rigChildId = item.id;
            connections.appendChild(hitLine);
        });
        const linkPreview = document.createElementNS(namespace, 'line');
        linkPreview.classList.add('rig-pivot-overlay__link-preview');
        linkPreview.hidden = true;
        connections.appendChild(linkPreview);
        this.element.appendChild(connections);
        items.forEach(item => {
            const group = document.createElementNS(namespace, 'g');
            group.classList.add('rig-pivot-overlay__pivot');
            group.dataset.rigPivotId = item.id;
            group.innerHTML = `
                <line class="rig-pivot-overlay__stem"></line>
                <path class="rig-pivot-overlay__tail" d="M 0 -9 L 6 5 L 0 10 L -6 5 Z"></path>
                <circle class="rig-pivot-overlay__root-hit" r="18"></circle>
                <circle class="rig-pivot-overlay__root" r="5"></circle>
                <circle class="rig-pivot-overlay__tail-hit" r="18"></circle>
                <g class="rig-pivot-overlay__tag">
                    <rect rx="5" ry="5"></rect>
                    <text></text>
                </g>`;
            this.element.appendChild(group);
        });
    }

    _updateGroup(item) {
        const group = [...this.element.querySelectorAll('[data-rig-pivot-id]')]
            .find(candidate => candidate.dataset.rigPivotId === item.id);
        if (!group) return;
        const dx = item.tail.x - item.root.x;
        const dy = item.tail.y - item.root.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        group.classList.toggle('is-active', item.active === true);
        group.classList.toggle('is-candidate', item.configured !== true);
        group.classList.toggle('is-caf', item.kind === 'caf');
        // 重なったPIVOTではtarget tabで選んだactive要素をhit-testの最前面にする。
        if (item.active === true && group !== this.element.lastElementChild) {
            this.element.appendChild(group);
        }
        const stem = group.querySelector('.rig-pivot-overlay__stem');
        stem.setAttribute('x1', String(item.root.x));
        stem.setAttribute('y1', String(item.root.y));
        stem.setAttribute('x2', String(item.tail.x));
        stem.setAttribute('y2', String(item.tail.y));
        const tail = group.querySelector('.rig-pivot-overlay__tail');
        tail.setAttribute('transform', `translate(${item.tail.x} ${item.tail.y}) rotate(${angle})`);
        const root = group.querySelector('.rig-pivot-overlay__root');
        const rootHit = group.querySelector('.rig-pivot-overlay__root-hit');
        const tailHit = group.querySelector('.rig-pivot-overlay__tail-hit');
        [root, rootHit].forEach(circle => {
            circle.setAttribute('cx', String(item.root.x));
            circle.setAttribute('cy', String(item.root.y));
        });
        tailHit.setAttribute('cx', String(item.tail.x));
        tailHit.setAttribute('cy', String(item.tail.y));
        const text = group.querySelector('.rig-pivot-overlay__tag text');
        const rect = group.querySelector('.rig-pivot-overlay__tag rect');
        const tag = group.querySelector('.rig-pivot-overlay__tag');
        tag.style.display = item.showLabel === false ? 'none' : '';
        text.textContent = item.label || 'PIVOT';
        text.setAttribute('x', String(item.root.x + 13));
        text.setAttribute('y', String(item.root.y - 11));
        const width = Math.max(34, Math.min(150, (item.label || 'PIVOT').length * 9 + 14));
        rect.setAttribute('x', String(item.root.x + 7));
        rect.setAttribute('y', String(item.root.y - 28));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', '22');
        const parent = item.parentId
            ? this.screenItems.find(candidate => candidate.id === item.parentId) || null
            : null;
        const connections = this.element.querySelectorAll(`[data-rig-child-id="${CSS.escape(item.id)}"]`);
        if (connections.length > 0 && parent) {
            connections.forEach(connection => {
                connection.setAttribute('x1', String(parent.root.x));
                connection.setAttribute('y1', String(parent.root.y));
                connection.setAttribute('x2', String(item.root.x));
                connection.setAttribute('y2', String(item.root.y));
            });
        }
    }
}

export const rigPivotOverlay = new RigPivotOverlay();
