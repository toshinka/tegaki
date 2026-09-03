const SUPPORTED_COMPACT_MODES = new Set(['rig', 'motion']);

function normalizeEditorMode(value) {
    return ['rig', 'warp'].includes(value) ? value : 'motion';
}

/**
 * CLIP MOTIONのFocus shellは保存正本を持たず、既存editor modeとruntime要求から
 * 表示だけを導出する。WARPは操作列を省略できないためcompact対象外にする。
 */
export function createRigWorkspaceFocusShellPlan(options = {}) {
    const editorMode = normalizeEditorMode(options.editorMode);
    const compactSupported = SUPPORTED_COMPACT_MODES.has(editorMode);
    const compactRequested = options.compactRequested === true;
    const compactApplied = compactSupported && compactRequested;

    return {
        editorMode,
        compactSupported,
        compactRequested,
        compactApplied,
        detailExpanded: !compactApplied,
        buttonLabel: compactApplied ? 'DETAIL' : 'CANVAS',
        buttonTooltip: !compactSupported
            ? 'WARP編集中はGRID操作を保つため詳細表示を固定します'
            : compactApplied
                ? 'CLIP MOTIONの詳細を展開'
                : 'CLIP MOTIONをCanvas優先表示へ折りたたむ'
    };
}
