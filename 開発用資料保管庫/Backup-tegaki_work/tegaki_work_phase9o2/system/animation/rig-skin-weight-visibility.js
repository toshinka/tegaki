/**
 * RIG / Motion間で共有するSkin weight診断overlayのruntime visibility policy。
 * 保存state、History、Skin値を持たず、CORRECT / BRUSH / MESH EDITはRIG Setupだけへ限定する。
 */

export function resolveRigSkinWeightVisibility(options = {}) {
    const editorMode = ['rig', 'motion'].includes(options.editorMode)
        ? options.editorMode
        : 'other';
    const available = options.available === true;
    const visible = options.requestedVisible === true && available;
    const modeActive = editorMode === 'rig'
        ? options.rigSetupActive === true
        : editorMode === 'motion'
            ? options.motionBoneActive === true
            : false;
    const overlayActive = visible
        && options.playing !== true
        && modeActive;
    const correctionActive = overlayActive
        && editorMode === 'rig'
        && options.correctionRequested === true;
    const brushActive = overlayActive
        && editorMode === 'rig'
        && options.brushRequested === true;
    const topologyEditActive = overlayActive
        && editorMode === 'rig'
        && options.topologyEditRequested === true;

    return {
        editorMode,
        available,
        visible,
        overlayActive,
        correctionActive,
        brushActive,
        topologyEditActive,
        editing: correctionActive || brushActive || topologyEditActive
    };
}
