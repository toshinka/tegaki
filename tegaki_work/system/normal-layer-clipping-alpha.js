/** ROLE: Derived binary alpha for normal Canvas clipping sources, including
 * source/ancestor clipping. No renderer, Project or History authority.
 * Caller: LayerSystem refreshClippingMasks; cache lives for one refresh only.
 */
import { CLIPPING_MODES, getClippingMode } from './clipping-mode.js';

export function createNormalClippingAlphaResolver({ layers, width, height, getSources, getSnapshot, isVisible }) {
    const byId = new Map(layers.map(layer => [layer.layerData?.id, layer]));
    const cache = new Map(), pending = new Set();
    const mode = layer => layer.layerData?.animationDisplayClippingMode || getClippingMode(layer.layerData);
    const owners = layer => {
        const result = [], seen = new Set();
        while (layer && !seen.has(layer)) {
            seen.add(layer); result.push(layer);
            layer = byId.get(layer.layerData?.parentId);
        }
        return result;
    };
    const union = sourceLayers => {
        const result = new Uint8Array(width * height);
        for (const source of sourceLayers) {
            const alpha = alphaFor(source);
            for (let i = 0; i < result.length; i++) result[i] ||= alpha[i];
        }
        return result;
    };
    const alphaFor = layer => {
        if (cache.has(layer)) return cache.get(layer);
        const alpha = new Uint8Array(width * height);
        if (pending.has(layer) || !isVisible(layer)) return alpha;
        pending.add(layer);
        const snapshot = getSnapshot(layer);
        if (snapshot?.pixels) {
            const bounds = snapshot.rasterBounds || {x:0,y:0};
            for (let y=0;y<snapshot.height;y++) for (let x=0;x<snapshot.width;x++) {
                const dx=x+bounds.x,dy=y+bounds.y;
                if (dx>=0&&dx<width&&dy>=0&&dy<height&&snapshot.pixels[(y*snapshot.width+x)*4+3]) alpha[dy*width+dx]=1;
            }
        }
        for (const owner of owners(layer)) {
            const clipping = mode(owner);
            if (clipping === CLIPPING_MODES.NONE) continue;
            const sourceAlpha = union(getSources(owner));
            for (let i=0;i<alpha.length;i++) alpha[i] = alpha[i] && (clipping === CLIPPING_MODES.INVERSE ? !sourceAlpha[i] : sourceAlpha[i]);
        }
        pending.delete(layer); cache.set(layer,alpha); return alpha;
    };
    const sourceKey = sourceLayers => {
        const keys = new Set(), seen = new Set();
        const visit = layer => {
            if (seen.has(layer)) return;
            seen.add(layer); keys.add(layer.layerData.id);
            for (const owner of owners(layer)) {
                const clipping=mode(owner);
                if (clipping === CLIPPING_MODES.NONE) continue;
                keys.add(owner.layerData.id); keys.add(`mode:${owner.layerData.id}:${clipping}`);
                getSources(owner).forEach(visit);
            }
        };
        sourceLayers.forEach(visit); return [...keys].join(',');
    };
    return { union, sourceKey };
}
