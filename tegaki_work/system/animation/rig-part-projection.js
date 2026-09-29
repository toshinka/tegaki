/**
 * ROLE: Read-only projection of the existing PART rig data for the new RIG Lens.
 * AUTHORITY: ClipAsset.rigDefinition.parts (partId / parentPartId / bindTransform) and
 *   ClipAsset.internalLayers remain the only persistent PART source of truth. This module
 *   never mutates its input and never produces data that is written back.
 * CONTRACT:
 *   - `structure`: every stored Part, in hierarchy order, with parent, depth and pivot.
 *   - `support.editable`: true only for the simple rigid-raster case the new Lens owns
 *     (every Part is a top-level, non-background Raster without Mesh; no rigidBindings /
 *     warpAnchorConstraints; valid, closed hierarchy). Anything else is shown read-only and
 *     stays on the legacy RIG Workspace route; it is never flattened or converted here.
 * RELATED: part-rig.js (schema/validation), ui/animation-table-popup.js (getRigLensPartTarget),
 *   ui/right-workspace-frame.js (_renderRigPartLens).
 */
import { validateRigDefinition } from './part-rig.js';

export const RIG_PART_UNSUPPORTED_MESSAGES = Object.freeze({
    'invalid-rig-definition': 'RIG定義を検証できません。',
    'missing-layer': 'Partの対象Layerが見つかりません。',
    'folder-part': 'Folder Partを含みます。',
    'nested-part': 'Folder内のRaster Partを含みます。',
    'background-part': '背景LayerのPartを含みます。',
    'mesh-part': 'Mesh接続済みRasterのPartを含みます。',
    'rigid-binding': '旧RIGの全体PIVOT / Bone結合を含みます。',
    'warp-anchor': '旧RIGのWARP Anchor拘束を含みます。',
    'part-cycle': 'Partの親子が循環しています。'
});

const finiteOr = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/**
 * @param {object|null} asset ClipAsset-like object ({ internalLayers, rigDefinition, meshDefinitions })
 * @returns {{
 *   structure: Array<object>, registeredCount: number,
 *   support: { editable: boolean, reasons: string[], message: string }
 * }}
 */
export function projectRigPartStructure(asset) {
    const layers = Array.isArray(asset?.internalLayers) ? asset.internalLayers.filter(Boolean) : [];
    const layerById = new Map(layers.map(layer => [layer.id, layer]));
    const rig = asset?.rigDefinition || null;
    const parts = Array.isArray(rig?.parts) ? rig.parts.filter(part => part && typeof part === 'object') : [];
    const meshLayerIds = new Set((Array.isArray(asset?.meshDefinitions) ? asset.meshDefinitions : [])
        .map(mesh => mesh?.targetInternalLayerId).filter(Boolean));
    const partIds = new Set(parts.map(part => part.partId));
    const reasons = new Set();

    if (parts.length > 0) {
        const validation = validateRigDefinition(rig, layers);
        if (!validation.ok) reasons.add('invalid-rig-definition');
    }
    const rigidBindings = Array.isArray(rig?.rigidBindings) ? rig.rigidBindings : [];
    if (rigidBindings.some(binding => partIds.has(binding?.partId))) reasons.add('rigid-binding');
    if (Array.isArray(rig?.warpAnchorConstraints) && rig.warpAnchorConstraints.length > 0) {
        reasons.add('warp-anchor');
    }

    const describe = (part) => {
        const layer = layerById.get(part.partId) || null;
        const kind = !layer ? 'missing' : layer.type === 'folder' ? 'folder' : layer.type === 'raster' ? 'raster' : 'other';
        const topLevel = !!layer && layer.parentLayerId == null;
        let unsupported = null;
        if (!layer) unsupported = 'missing-layer';
        else if (kind === 'folder') unsupported = 'folder-part';
        else if (kind !== 'raster') unsupported = 'missing-layer';
        else if (layer.isBackground === true) unsupported = 'background-part';
        else if (!topLevel) unsupported = 'nested-part';
        else if (meshLayerIds.has(layer.id)) unsupported = 'mesh-part';
        if (unsupported) reasons.add(unsupported);
        const bind = part.bindTransform || {};
        return {
            partId: part.partId,
            name: layer?.name || part.partId || 'Part',
            layerKind: kind,
            topLevelRaster: kind === 'raster' && topLevel && layer.isBackground !== true,
            parentPartId: part.parentPartId || null,
            origin: { x: finiteOr(bind.x), y: finiteOr(bind.y) },
            rotation: finiteOr(bind.rotation),
            pivot: { x: finiteOr(bind.pivotX), y: finiteOr(bind.pivotY) },
            unsupportedReason: unsupported
        };
    };

    const described = new Map(parts.map(part => [part.partId, describe(part)]));
    const childrenOf = new Map();
    const roots = [];
    parts.forEach(part => {
        const parentId = part.parentPartId || null;
        if (parentId && described.has(parentId) && parentId !== part.partId) {
            if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
            childrenOf.get(parentId).push(part.partId);
        } else {
            roots.push(part.partId);
        }
    });

    const structure = [];
    const visited = new Set();
    const visit = (partId, depth) => {
        if (visited.has(partId)) return;
        visited.add(partId);
        const item = described.get(partId);
        const parent = item.parentPartId ? described.get(item.parentPartId) : null;
        structure.push({
            ...item,
            depth,
            parentName: item.parentPartId ? (parent?.name || null) : null,
            parentMissing: !!item.parentPartId && !parent
        });
        (childrenOf.get(partId) || []).forEach(childId => visit(childId, depth + 1));
    };
    roots.forEach(partId => visit(partId, 0));
    if (visited.size !== described.size) {
        // Parts only reachable through a cycle are still listed, never dropped.
        reasons.add('part-cycle');
        parts.forEach(part => visit(part.partId, 0));
    }
    if (structure.some(item => item.parentMissing)) reasons.add('invalid-rig-definition');

    const reasonList = [...reasons];
    return {
        structure,
        registeredCount: structure.length,
        support: {
            editable: reasonList.length === 0,
            reasons: reasonList,
            message: reasonList.map(reason => RIG_PART_UNSUPPORTED_MESSAGES[reason] || reason).join(' ')
        }
    };
}
