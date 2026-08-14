/**
 * 選択Raster / Mesh / BoneのSkin weightを表示するread-only SVG overlay。
 * Project、History、Skin evaluatorへ書き戻さず、pointer入力にも参加しない。
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const WEIGHT_EPSILON = 1e-6;

function formatPathNumber(value) {
    return String(Number(Number(value).toFixed(3)));
}

function appendTrianglePath(parts, vertices) {
    if (vertices.length !== 3) return;
    parts.push(`M ${formatPathNumber(vertices[0].x)} ${formatPathNumber(vertices[0].y)}`);
    parts.push(`L ${formatPathNumber(vertices[1].x)} ${formatPathNumber(vertices[1].y)}`);
    parts.push(`L ${formatPathNumber(vertices[2].x)} ${formatPathNumber(vertices[2].y)} Z`);
}

function resolveWeightBand(triangle) {
    const minWeight = Number(triangle?.minWeight) || 0;
    const maxWeight = Number(triangle?.maxWeight) || 0;
    if (!(maxWeight > WEIGHT_EPSILON)) return 'none';
    if (minWeight >= 1 - WEIGHT_EPSILON) return 'rigid';
    const averageWeight = Number.isFinite(Number(triangle?.averageWeight))
        ? Number(triangle.averageWeight)
        : (minWeight + maxWeight) / 2;
    if (averageWeight <= 0.08) return 'low';
    if (averageWeight <= 0.45) return 'mid';
    return 'high';
}

/**
 * DOM非依存の固定path plan。混合triangleは平均weightで段階化し、微小漏れもlow帯へ残す。
 */
export function createRigSkinWeightOverlayPathPlan(diagnostic) {
    if (!diagnostic?.ok || !Array.isArray(diagnostic.vertices) || !Array.isArray(diagnostic.triangles)) {
        return { ok: false, reason: 'diagnostic-required', paths: null };
    }
    const vertexById = new Map(diagnostic.vertices.map(vertex => [vertex?.vertexId, vertex]));
    const pathParts = {
        low: [],
        mid: [],
        high: [],
        rigid: [],
        outline: []
    };
    const counts = { none: 0, low: 0, mid: 0, high: 0, rigid: 0 };
    for (const triangle of diagnostic.triangles) {
        const vertices = (triangle?.vertexIds || []).map(vertexId => vertexById.get(vertexId));
        if (vertices.length !== 3 || vertices.some(vertex => (
            !vertex || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)
        ))) continue;
        appendTrianglePath(pathParts.outline, vertices);
        const band = resolveWeightBand(triangle);
        counts[band] += 1;
        if (band !== 'none') appendTrianglePath(pathParts[band], vertices);
    }
    return {
        ok: true,
        paths: Object.fromEntries(Object.entries(pathParts).map(([key, parts]) => [key, parts.join(' ')])),
        counts,
        stats: diagnostic.stats ? { ...diagnostic.stats } : null
    };
}

export class RigSkinWeightOverlay {
    constructor() {
        this.element = null;
        this.group = null;
        this.options = null;
        this.frameRequest = null;
        this.dirty = true;
        this.lastPlan = null;
    }

    activate(options = {}) {
        if (!options.coordinateSystem || typeof options.getDiagnostic !== 'function') return false;
        this.options = options;
        this._ensureElement();
        this.element.hidden = false;
        this.dirty = true;
        if (this.frameRequest === null) this._update();
        return true;
    }

    invalidate() {
        this.dirty = true;
    }

    deactivate() {
        if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
        this.frameRequest = null;
        this.options = null;
        this.lastPlan = null;
        this.element?.remove();
        this.element = null;
        this.group = null;
    }

    isActive() {
        return !!this.options;
    }

    getLastPlan() {
        return this.lastPlan;
    }

    _ensureElement() {
        if (this.element?.isConnected) return;
        document.querySelectorAll('.rig-skin-weight-overlay').forEach(element => element.remove());
        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.classList.add('rig-skin-weight-overlay');
        svg.setAttribute('aria-hidden', 'true');
        const group = document.createElementNS(SVG_NAMESPACE, 'g');
        group.classList.add('rig-skin-weight-overlay__group');
        [
            ['low', 'rig-skin-weight-overlay__low'],
            ['mid', 'rig-skin-weight-overlay__mid'],
            ['high', 'rig-skin-weight-overlay__high'],
            ['rigid', 'rig-skin-weight-overlay__rigid'],
            ['outline', 'rig-skin-weight-overlay__outline-underlay'],
            ['outline', 'rig-skin-weight-overlay__outline']
        ].forEach(([pathKey, className]) => {
            const path = document.createElementNS(SVG_NAMESPACE, 'path');
            path.classList.add(className);
            path.dataset.weightPath = pathKey;
            group.appendChild(path);
        });
        svg.appendChild(group);
        document.body.appendChild(svg);
        this.element = svg;
        this.group = group;
    }

    _toScreen(x, y) {
        const coordinateSystem = this.options?.coordinateSystem;
        const screen = coordinateSystem?.worldToScreenImmediate?.(x, y)
            || coordinateSystem?.worldToScreen?.(x, y);
        return screen && Number.isFinite(screen.clientX) && Number.isFinite(screen.clientY)
            ? { x: screen.clientX, y: screen.clientY }
            : null;
    }

    _syncScreenTransform() {
        const origin = this._toScreen(0, 0);
        const axisX = this._toScreen(1, 0);
        const axisY = this._toScreen(0, 1);
        if (!origin || !axisX || !axisY || !this.group) return false;
        const values = [
            axisX.x - origin.x,
            axisX.y - origin.y,
            axisY.x - origin.x,
            axisY.y - origin.y,
            origin.x,
            origin.y
        ].map(value => formatPathNumber(value));
        this.group.setAttribute('transform', `matrix(${values.join(' ')})`);
        return true;
    }

    _syncGeometry() {
        const diagnostic = this.options?.getDiagnostic?.() || null;
        const plan = createRigSkinWeightOverlayPathPlan(diagnostic);
        this.lastPlan = plan.ok ? plan : null;
        if (!plan.ok || !this.group) {
            if (this.element) this.element.hidden = true;
            return false;
        }
        this.group.querySelectorAll('[data-weight-path]').forEach(path => {
            path.setAttribute('d', plan.paths[path.dataset.weightPath] || '');
        });
        this.element.hidden = false;
        return true;
    }

    _update() {
        this.frameRequest = null;
        if (!this.options || !this.element) return;
        if (this.options.shouldDisplay?.() === false) {
            this.deactivate();
            return;
        }
        if (this.dirty) {
            this.dirty = false;
            this._syncGeometry();
        }
        if (!this._syncScreenTransform()) this.element.hidden = true;
        this.frameRequest = requestAnimationFrame(() => this._update());
    }
}

export const rigSkinWeightOverlay = new RigSkinWeightOverlay();
