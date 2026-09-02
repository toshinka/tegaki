/* EasyReforge Manga Prompter - Main Prompt Live Sync & CSP-Style Panel Editor (v3.7.5)
   Logical Koma Reassignment & Style-First Ordering */

(function () {
    'use strict';

    const PANEL_COLORS = [
        '#E53935', // 赤 (コマ1)
        '#1E88E5', // 青 (コマ2)
        '#43A047', // 緑 (コマ3)
        '#FDD835', // 黄 (コマ4)
        '#8E24AA', // 紫 (コマ5)
        '#FB8C00', // 橙 (コマ6)
        '#00ACC1', // シアン (コマ7)
        '#D81B60', // ピンク (コマ8)
    ];

    function colorForKomaNumber(num) {
        const idx = Math.max(1, parseInt(num, 10) || 1) - 1;
        return PANEL_COLORS[idx % PANEL_COLORS.length];
    }

    const state = {
        panels: [],
        selectedIds: new Set(),
        primarySelectedId: null,
        toolMode: 'select', // 'select' | 'slice' | 'drawRect'
        interactionMode: 'exclusive', // 'exclusive' (コマ連結/くり抜き) | 'overlap' (重なり許可/共存)
        viewMode: 'color', // 'color' または 'lineart'
        sliceLine: null,
        sliceCandidate: null,
        drawRectBox: null,
        isDragging: false,
        draggedKomaIndex: null, // コマ番号ドラッグ＆ドロップ用
        history: [],
        historyIndex: -1,
        aspectRatio: 1216 / 832,
        width: 832,
        height: 1216,
        parsedPrompt: {
            style: '',
            page: '',
            regions: {}
        }
    };

    let isInitialized = false;

    function generateId() {
        return 'p_' + Math.random().toString(36).substr(2, 9);
    }

    function pushHistory() {
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push(JSON.stringify({
            panels: state.panels,
            interactionMode: state.interactionMode
        }));
        state.historyIndex++;
        if (state.history.length > 50) {
            state.history.shift();
            state.historyIndex--;
        }
        updateHistoryButtons();
    }

    window.mangaPrompterUndo = function () {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            const snap = JSON.parse(state.history[state.historyIndex]);
            state.panels = snap.panels;
            if (snap.interactionMode) state.interactionMode = snap.interactionMode;
            updateInteractionModeUI();
            render();
            syncToGradio();
            updateHistoryButtons();
        }
    };

    window.mangaPrompterRedo = function () {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const snap = JSON.parse(state.history[state.historyIndex]);
            state.panels = snap.panels;
            if (snap.interactionMode) state.interactionMode = snap.interactionMode;
            updateInteractionModeUI();
            render();
            syncToGradio();
            updateHistoryButtons();
        }
    };

    function updateHistoryButtons() {
        const undoBtn = document.getElementById('manga-btn-undo');
        const redoBtn = document.getElementById('manga-btn-redo');
        if (undoBtn) undoBtn.disabled = (state.historyIndex <= 0);
        if (redoBtn) redoBtn.disabled = (state.historyIndex >= state.history.length - 1);
    }

    // ツールモード切替 (Select / Slice / DrawRect)
    window.mangaPrompterSetTool = function (tool) {
        state.toolMode = tool;
        const btnSelect = document.getElementById('manga-btn-tool-select');
        const btnSlice = document.getElementById('manga-btn-tool-slice');
        const btnDrawRect = document.getElementById('manga-btn-tool-drawrect');
        const hintEl = document.getElementById('manga-canvas-hint-text');

        if (btnSelect) btnSelect.classList.toggle('active', tool === 'select');
        if (btnSlice) btnSlice.classList.toggle('active', tool === 'slice');
        if (btnDrawRect) btnDrawRect.classList.toggle('active', tool === 'drawRect');

        if (hintEl) {
            if (tool === 'select') {
                hintEl.innerHTML = '💡 <span>[選択モード] コマ選択 / 共通境界ドラッグ / ハンドル伸縮 / 右側☷でコマ番号入替</span>';
            } else if (tool === 'slice') {
                hintEl.innerHTML = '💡 <span>[スライスモード] コマ上を直線ドラッグで切断 (クリスタ風 枠線分割)</span>';
            } else if (tool === 'drawRect') {
                hintEl.innerHTML = '💡 <span>[矩形モード] キャンバス上をドラッグして新しい自由四角形コマを作成</span>';
            }
        }

        const svg = document.getElementById('manga-canvas-svg');
        if (svg) {
            svg.style.cursor = (tool === 'select') ? 'default' : 'crosshair';
        }
        render();
    };

    // 領域関係モード切替 (Exclusive ⇄ Overlap)
    window.mangaPrompterToggleInteractionMode = function () {
        state.interactionMode = (state.interactionMode === 'exclusive') ? 'overlap' : 'exclusive';
        updateInteractionModeUI();
        state.panels.forEach(p => p.interactionMode = state.interactionMode);
        pushHistory();
        render();
        syncToGradio();
    };

    function updateInteractionModeUI() {
        const btn = document.getElementById('manga-btn-interaction-mode');
        if (btn) {
            if (state.interactionMode === 'overlap') {
                btn.textContent = '◫ 重なり許可 (Overlap)';
                btn.classList.add('manga-btn-overlap', 'active');
                btn.title = '重なり許可: 同一シーン・人物近接・共存ブレンド';
            } else {
                btn.textContent = '🔗 コマ連結 (Exclusive)';
                btn.classList.remove('manga-btn-overlap', 'active');
                btn.title = 'コマ連結: 別コマ・くり抜き・干渉防止';
            }
        }
    }

    // 表示モード切り替え（カラー ⇄ 白黒線画）「押したら何になるか」を表示
    window.mangaPrompterToggleViewMode = function () {
        state.viewMode = (state.viewMode === 'color') ? 'lineart' : 'color';
        updateViewModeUI();
        render();
    };

    function updateViewModeUI() {
        const btn = document.getElementById('manga-btn-viewmode');
        if (btn) {
            if (state.viewMode === 'color') {
                btn.textContent = '⬛ 白黒表示へ';
                btn.title = '白黒線画モードに切替（ControlNet用）';
            } else {
                btn.textContent = '🎨 カラー表示へ';
                btn.title = 'カラー確認モードに切替';
            }
        }
    }

    // コマ枠線画のPNGエクスポート（ControlNet用）
    window.mangaPrompterExportLineart = function () {
        const canvas = document.createElement('canvas');
        canvas.width = state.width;
        canvas.height = state.height;
        const ctx = canvas.getContext('2d');

        // 白背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 黒枠線
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;

        const sortedForDraw = [...state.panels].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        sortedForDraw.forEach(p => {
            const px = p.rect.x * canvas.width;
            const py = p.rect.y * canvas.height;
            const pw = p.rect.w * canvas.width;
            const ph = p.rect.h * canvas.height;

            ctx.strokeRect(px + 3, py + 3, Math.max(0, pw - 6), Math.max(0, ph - 6));
        });

        const link = document.createElement('a');
        link.download = `manga_layout_${state.width}x${state.height}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    // 初期作成・プリセット時のみの自動読み順ソート（右上 → 左上 → 右下）
    function autoAssignPanelsByReadingOrder() {
        if (state.panels.length === 0) return;
        const tolerance = 0.08;

        const sorted = [...state.panels].sort((a, b) => {
            const yDiff = a.rect.y - b.rect.y;
            if (Math.abs(yDiff) > tolerance) {
                return yDiff;
            }
            const xDiff = b.rect.x - a.rect.x;
            if (Math.abs(xDiff) > 0.05) {
                return xDiff;
            }
            return (b.zIndex || 0) - (a.zIndex || 0);
        });

        sorted.forEach((p, idx) => {
            p.index = idx + 1;
            p.name = `コマ ${idx + 1}` + (p.zIndex > 0 ? ' (重なり)' : '');
            p.color = colorForKomaNumber(idx + 1);
            if (p.weight === undefined) p.weight = 1.0;
            p.interactionMode = state.interactionMode;
        });
    }

    // --- コマ番号スワップ（論理コマ番号の再割当） ---
    window.mangaPrompterSwapKomaNumbers = function (komaA, komaB) {
        if (komaA === komaB) return;
        const panelA = state.panels.find(p => p.index === komaA);
        const panelB = state.panels.find(p => p.index === komaB);

        if (!panelA || !panelB) return;

        // 物理矩形 (x, y, w, h) や stable ID はそのまま、論理番号 (index) と 色のみをスワップ
        panelA.index = komaB;
        panelB.index = komaA;
        panelA.color = colorForKomaNumber(panelA.index);
        panelB.color = colorForKomaNumber(panelB.index);
        panelA.name = `コマ ${panelA.index}` + (panelA.zIndex > 0 ? ' (重なり)' : '');
        panelB.name = `コマ ${panelB.index}` + (panelB.zIndex > 0 ? ' (重なり)' : '');

        pushHistory();
        render();
        renderSummaryList();
        syncToGradio();
    };

    // メインプロンプト欄のリアルタイム解析 (v3.7.5: STYLE -> PAGE -> REGIONS)
    function parseMainPrompt() {
        const mainPromptEl = document.querySelector('#txt2img_prompt textarea') || 
                             document.querySelector('#img2img_prompt textarea') ||
                             document.querySelector('#prompt textarea');
        if (!mainPromptEl) return;

        const text = mainPromptEl.value.trim();
        if (!text) {
            state.parsedPrompt = { style: '', page: '', regions: {} };
            renderSummaryList();
            return;
        }

        const chunks = text.split(/\bBREAK\b/i).map(c => c.trim()).filter(c => c.length > 0);
        const style = chunks.length > 0 ? chunks[0] : '';
        const page = chunks.length > 1 ? chunks[1] : '';
        const regions = {};

        const tagRegex = /^(\[?(コマ|koma|panel|p)\s*(\d+)\]?|(\d+)\s*(コマ|koma|panel|p))\s*:?\s*/i;

        for (let i = 2; i < chunks.length; i++) {
            const chunk = chunks[i];
            const match = chunk.match(tagRegex);
            let pNum = i - 1;
            let cleanText = chunk;

            if (match) {
                const numStr = match[3] || match[4];
                if (numStr) pNum = parseInt(numStr, 10);
                cleanText = chunk.replace(tagRegex, '').trim();
            }
            regions[pNum] = cleanText;
        }

        state.parsedPrompt = { style, page, regions };
        renderSummaryList();
    }

    // メインプロンプト欄へのテンプレート挿入 (v3.7.5: STYLE -> PAGE -> koma 1..N)
    window.mangaPrompterInsertTemplateToMainPrompt = function () {
        const mainPromptEl = document.querySelector('#txt2img_prompt textarea') || 
                             document.querySelector('#img2img_prompt textarea') ||
                             document.querySelector('#prompt textarea');
        if (!mainPromptEl) return;

        const sorted = [...state.panels].sort((a, b) => (a.index || 0) - (b.index || 0));
        const numPanels = sorted.length;
        let curVal = mainPromptEl.value.trim();

        const chunks = curVal.split(/\bBREAK\b/i).map(c => c.trim()).filter(c => c.length > 0);
        let stylePart = chunks.length > 0 ? chunks[0] : 'clean illustration, clear subjects, simple composition';
        let pagePart = chunks.length > 1 ? chunks[1] : `${numPanels}koma manga`;

        let templateLines = [
            stylePart,
            'BREAK',
            pagePart
        ];

        sorted.forEach(p => {
            templateLines.push(`BREAK\nkoma ${p.index}: `);
        });

        mainPromptEl.value = templateLines.join('\n');
        mainPromptEl.dispatchEvent(new Event('input', { bubbles: true }));
        mainPromptEl.dispatchEvent(new Event('change', { bubbles: true }));
        mainPromptEl.focus();

        parseMainPrompt();
    };

    // クイックスプリット（横分割 / 縦分割）
    window.mangaPrompterSplit = function (direction) {
        let target = state.panels.find(p => p.id === state.primarySelectedId) || state.panels[0];
        if (!target) return;

        const r = target.rect;
        let newRect1, newRect2;

        if (direction === 'h') {
            newRect1 = { x: r.x, y: r.y, w: r.w, h: r.h / 2 };
            newRect2 = { x: r.x, y: r.y + r.h / 2, w: r.w, h: r.h / 2 };
        } else {
            newRect1 = { x: r.x, y: r.y, w: r.w / 2, h: r.h };
            newRect2 = { x: r.x + r.w / 2, y: r.y, w: r.w / 2, h: r.h };
        }

        target.rect = newRect1;
        const newIndex = state.panels.length + 1;
        const newPanel = {
            id: generateId(),
            rect: newRect2,
            zIndex: target.zIndex || 0,
            index: newIndex,
            color: colorForKomaNumber(newIndex),
            name: `コマ ${newIndex}`,
            weight: target.weight || 1.0,
            interactionMode: state.interactionMode
        };

        state.panels.push(newPanel);
        state.selectedIds.clear();
        state.selectedIds.add(newPanel.id);
        state.primarySelectedId = newPanel.id;

        pushHistory();
        render();
        syncToGradio();
    };

    // コマ結合
    window.mangaPrompterMerge = function () {
        if (state.panels.length <= 1) return;

        if (state.selectedIds.size > 1) {
            const selectedList = state.panels.filter(p => state.selectedIds.has(p.id));
            let minX = 1, minY = 1, maxX = 0, maxY = 0;

            selectedList.forEach(p => {
                minX = Math.min(minX, p.rect.x);
                minY = Math.min(minY, p.rect.y);
                maxX = Math.max(maxX, p.rect.x + p.rect.w);
                maxY = Math.max(maxY, p.rect.y + p.rect.h);
            });

            const keepPanel = selectedList[0];
            keepPanel.rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

            state.panels = state.panels.filter(p => p.id === keepPanel.id || !state.selectedIds.has(p.id));
            state.selectedIds.clear();
            state.selectedIds.add(keepPanel.id);
            state.primarySelectedId = keepPanel.id;

            // 連番の再正規化 (1..N)
            state.panels.sort((a, b) => a.index - b.index).forEach((p, i) => {
                p.index = i + 1;
                p.color = colorForKomaNumber(p.index);
            });

            pushHistory();
            render();
            syncToGradio();
            return;
        }

        const target = state.panels.find(p => p.id === state.primarySelectedId);
        if (!target) return;

        const r1 = target.rect;
        let bestNeighbor = null;
        let mergedRect = null;

        for (let other of state.panels) {
            if (other.id === target.id) continue;
            const r2 = other.rect;

            if (Math.abs(r1.y - r2.y) < 0.02 && Math.abs(r1.h - r2.h) < 0.02) {
                if (Math.abs(r1.x + r1.w - r2.x) < 0.02) {
                    bestNeighbor = other;
                    mergedRect = { x: r1.x, y: r1.y, w: r1.w + r2.w, h: r1.h };
                    break;
                } else if (Math.abs(r2.x + r2.w - r1.x) < 0.02) {
                    bestNeighbor = other;
                    mergedRect = { x: r2.x, y: r1.y, w: r1.w + r2.w, h: r1.h };
                    break;
                }
            }

            if (Math.abs(r1.x - r2.x) < 0.02 && Math.abs(r1.w - r2.w) < 0.02) {
                if (Math.abs(r1.y + r1.h - r2.y) < 0.02) {
                    bestNeighbor = other;
                    mergedRect = { x: r1.x, y: r1.y, w: r1.w, h: r1.h + r2.h };
                    break;
                } else if (Math.abs(r2.y + r2.h - r1.y) < 0.02) {
                    bestNeighbor = other;
                    mergedRect = { x: r1.x, y: r2.y, w: r1.w, h: r1.h + r2.h };
                    break;
                }
            }
        }

        if (bestNeighbor && mergedRect) {
            target.rect = mergedRect;
            state.panels = state.panels.filter(p => p.id !== bestNeighbor.id);
            state.panels.sort((a, b) => a.index - b.index).forEach((p, i) => {
                p.index = i + 1;
                p.color = colorForKomaNumber(p.index);
            });
            pushHistory();
            render();
            syncToGradio();
        }
    };

    // コマ削除
    window.mangaPrompterDelete = function (id) {
        if (state.panels.length <= 1) return;
        state.panels = state.panels.filter(p => p.id !== id);
        state.selectedIds.delete(id);
        if (state.primarySelectedId === id) {
            state.primarySelectedId = state.panels[0].id;
            state.selectedIds.add(state.primarySelectedId);
        }

        // コマ番号を 1..N に再連番化
        state.panels.sort((a, b) => a.index - b.index).forEach((p, i) => {
            p.index = i + 1;
            p.color = colorForKomaNumber(p.index);
        });

        pushHistory();
        render();
        syncToGradio();
    };

    // 全初期化
    window.mangaPrompterReset = function () {
        const newId = generateId();
        state.panels = [
            {
                id: newId,
                rect: { x: 0, y: 0, w: 1, h: 1 },
                zIndex: 0,
                color: PANEL_COLORS[0],
                name: 'コマ 1 (全体)',
                index: 1,
                weight: 1.0,
                interactionMode: state.interactionMode
            }
        ];
        state.selectedIds.clear();
        state.selectedIds.add(newId);
        state.primarySelectedId = newId;
        state.history = [];
        state.historyIndex = -1;
        pushHistory();
        render();
        syncToGradio();
    };

    // プリセット適用
    window.mangaPrompterApplyPreset = function (presetKey) {
        const presets = {
            '4koma': [
                { rect: { x: 0, y: 0, w: 1, h: 0.25 }, zIndex: 0 },
                { rect: { x: 0, y: 0.25, w: 1, h: 0.25 }, zIndex: 0 },
                { rect: { x: 0, y: 0.5, w: 1, h: 0.25 }, zIndex: 0 },
                { rect: { x: 0, y: 0.75, w: 1, h: 0.25 }, zIndex: 0 },
            ],
            '3panel': [
                { rect: { x: 0, y: 0, w: 1, h: 0.55 }, zIndex: 0 },
                { rect: { x: 0.5, y: 0.55, w: 0.5, h: 0.45 }, zIndex: 0 },
                { rect: { x: 0, y: 0.55, w: 0.5, h: 0.45 }, zIndex: 0 },
            ],
            '5panel': [
                { rect: { x: 0, y: 0, w: 1, h: 0.35 }, zIndex: 0 },
                { rect: { x: 0.5, y: 0.35, w: 0.5, h: 0.35 }, zIndex: 0 },
                { rect: { x: 0, y: 0.35, w: 0.5, h: 0.35 }, zIndex: 0 },
                { rect: { x: 0.5, y: 0.7, w: 0.5, h: 0.3 }, zIndex: 0 },
                { rect: { x: 0, y: 0.7, w: 0.5, h: 0.3 }, zIndex: 0 },
            ],
            '6panel': [
                { rect: { x: 0.5, y: 0, w: 0.5, h: 0.333 }, zIndex: 0 },
                { rect: { x: 0, y: 0, w: 0.5, h: 0.333 }, zIndex: 0 },
                { rect: { x: 0.5, y: 0.333, w: 0.5, h: 0.333 }, zIndex: 0 },
                { rect: { x: 0, y: 0.333, w: 0.5, h: 0.333 }, zIndex: 0 },
                { rect: { x: 0.5, y: 0.666, w: 0.5, h: 0.334 }, zIndex: 0 },
                { rect: { x: 0, y: 0.666, w: 0.5, h: 0.334 }, zIndex: 0 },
            ]
        };

        const template = presets[presetKey];
        if (!template) return;

        state.panels = template.map(t => ({
            id: generateId(),
            rect: { ...t.rect },
            zIndex: t.zIndex,
            color: '#888888',
            name: '',
            weight: 1.0,
            interactionMode: state.interactionMode
        }));

        state.selectedIds.clear();
        state.selectedIds.add(state.panels[0].id);
        state.primarySelectedId = state.panels[0].id;
        autoAssignPanelsByReadingOrder();
        pushHistory();
        render();
        syncToGradio();
    };

    function syncToGradio() {
        const jsonInput = document.querySelector('#manga-prompter-json-bridge textarea');
        if (jsonInput) {
            jsonInput.value = JSON.stringify(state.panels);
            jsonInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        renderSummaryList();
    }

    // --- クリスタ風 スライス交差判定 (Liang-Barsky Line Clipping) ---
    function computeLineRectIntersection(p1, p2, rect) {
        let t0 = 0.0, t1 = 1.0;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        const p = [-dx, dx, -dy, dy];
        const q = [
            p1.x - rect.x,
            rect.x + rect.w - p1.x,
            p1.y - rect.y,
            rect.y + rect.h - p1.y
        ];

        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) {
                if (q[i] < 0) return null;
            } else {
                const r = q[i] / p[i];
                if (p[i] < 0) {
                    if (r > t1) return null;
                    if (r > t0) t0 = r;
                } else {
                    if (r < t0) return null;
                    if (r < t1) t1 = r;
                }
            }
        }

        const enterPt = { x: p1.x + t0 * dx, y: p1.y + t0 * dy };
        const exitPt = { x: p1.x + t1 * dx, y: p1.y + t1 * dy };
        return { enter: enterPt, exit: exitPt, t0, t1 };
    }

    function findSliceCandidate(line) {
        const dx = line.end.x - line.start.x;
        const dy = line.end.y - line.start.y;
        const isHorizontal = Math.abs(dx) >= Math.abs(dy);

        let bestCandidate = null;
        let maxCoverage = 0;

        for (let p of state.panels) {
            const hit = computeLineRectIntersection(line.start, line.end, p.rect);
            if (!hit) continue;

            let coverage = 0;
            if (isHorizontal) {
                coverage = Math.abs(hit.exit.x - hit.enter.x) / p.rect.w;
            } else {
                coverage = Math.abs(hit.exit.y - hit.enter.y) / p.rect.h;
            }

            const isSelected = (p.id === state.primarySelectedId);
            const effectiveThreshold = isSelected ? 0.40 : 0.80;

            if (coverage >= effectiveThreshold && coverage > maxCoverage) {
                maxCoverage = coverage;
                const midX = (hit.enter.x + hit.exit.x) / 2;
                const midY = (hit.enter.y + hit.exit.y) / 2;
                bestCandidate = {
                    panel: p,
                    coverage,
                    isHorizontal,
                    cutPos: isHorizontal ? midY : midX
                };
            }
        }

        return bestCandidate;
    }

    function applySlice(candidate) {
        if (!candidate || !candidate.panel) return;

        const target = candidate.panel;
        const r = target.rect;
        let newRect1, newRect2;

        if (candidate.isHorizontal) {
            const cutY = Math.max(r.y + 0.05, Math.min(r.y + r.h - 0.05, candidate.cutPos));
            const h1 = cutY - r.y;
            const h2 = r.h - h1;
            newRect1 = { x: r.x, y: r.y, w: r.w, h: h1 };
            newRect2 = { x: r.x, y: cutY, w: r.w, h: h2 };
        } else {
            const cutX = Math.max(r.x + 0.05, Math.min(r.x + r.w - 0.05, candidate.cutPos));
            const w1 = cutX - r.x;
            const w2 = r.w - w1;
            newRect1 = { x: r.x, y: r.y, w: w1, h: r.h };
            newRect2 = { x: cutX, y: r.y, w: w2, h: r.h };
        }

        target.rect = newRect1;
        const newIndex = state.panels.length + 1;
        const newPanel = {
            id: generateId(),
            rect: newRect2,
            zIndex: target.zIndex || 0,
            index: newIndex,
            color: colorForKomaNumber(newIndex),
            name: `コマ ${newIndex}`,
            weight: target.weight || 1.0,
            interactionMode: state.interactionMode
        };

        state.panels.push(newPanel);
        state.selectedIds.clear();
        state.selectedIds.add(newPanel.id);
        state.primarySelectedId = newPanel.id;

        pushHistory();
        render();
        syncToGradio();
    }

    // --- メイン SVG レンダリング ---
    function render() {
        const svg = document.getElementById('manga-canvas-svg');
        if (!svg) return;

        svg.innerHTML = '';

        const vW = 1000;
        const vH = 1000 * state.aspectRatio;
        svg.setAttribute('viewBox', `0 0 ${vW} ${vH}`);

        const isLineart = (state.viewMode === 'lineart');

        // 背景
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', vW);
        bg.setAttribute('height', vH);
        bg.setAttribute('fill', isLineart ? '#ffffff' : '#f4f4f6');
        bg.setAttribute('stroke', isLineart ? '#000000' : '#d1d5db');
        bg.setAttribute('stroke-width', '4');

        bg.addEventListener('pointerdown', (e) => {
            if (state.toolMode === 'select') {
                state.selectedIds.clear();
                state.primarySelectedId = null;
                render();
                renderSummaryList();
            }
        });
        svg.appendChild(bg);

        const sortedForDraw = [...state.panels].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        sortedForDraw.forEach(p => {
            const isSelected = state.selectedIds.has(p.id);
            const isSliceCandidate = (state.sliceCandidate && state.sliceCandidate.panel.id === p.id);
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `manga-panel-group ${isSelected ? 'selected' : ''}`);
            g.setAttribute('data-id', p.id);

            const px = p.rect.x * vW;
            const py = p.rect.y * vH;
            const pw = p.rect.w * vW;
            const ph = p.rect.h * vH;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', px + 3);
            rect.setAttribute('y', py + 3);
            rect.setAttribute('width', Math.max(0, pw - 6));
            rect.setAttribute('height', Math.max(0, ph - 6));

            const curColor = p.color || colorForKomaNumber(p.index);

            if (isLineart) {
                rect.setAttribute('fill', '#ffffff');
                rect.setAttribute('stroke', isSelected ? '#3b82f6' : '#000000');
                rect.setAttribute('stroke-width', isSelected ? '6' : '4');
            } else {
                rect.setAttribute('fill', curColor + (isSelected ? '33' : '18'));
                if (isSliceCandidate) {
                    rect.setAttribute('stroke', '#ea580c');
                    rect.setAttribute('stroke-width', '4');
                    rect.setAttribute('stroke-dasharray', '6 3');
                } else {
                    rect.setAttribute('stroke', isSelected ? '#2563eb' : curColor);
                    rect.setAttribute('stroke-width', isSelected ? '3.5' : '2');
                }
            }
            rect.setAttribute('rx', '4');

            // Selectモードでのコマ選択・ドラッグ移動
            rect.addEventListener('pointerdown', (e) => {
                if (state.toolMode !== 'select') return;
                e.stopPropagation();

                if (e.shiftKey) {
                    if (state.selectedIds.has(p.id)) {
                        state.selectedIds.delete(p.id);
                        if (state.primarySelectedId === p.id) {
                            state.primarySelectedId = Array.from(state.selectedIds)[0] || null;
                        }
                    } else {
                        state.selectedIds.add(p.id);
                        state.primarySelectedId = p.id;
                    }
                } else {
                    state.selectedIds.clear();
                    state.selectedIds.add(p.id);
                    state.primarySelectedId = p.id;
                }

                // Overlapモード時はパネル移動ドラッグを開始
                if (state.interactionMode === 'overlap') {
                    startPanelMove(e, p, vW, vH);
                }

                render();
                renderSummaryList();
            });

            g.appendChild(rect);

            // コマ番号バッジ
            const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            textBg.setAttribute('x', px + 8);
            textBg.setAttribute('y', py + 8);
            textBg.setAttribute('width', Math.min(pw - 16, 75));
            textBg.setAttribute('height', '22');
            textBg.setAttribute('rx', '3');
            textBg.setAttribute('fill', isLineart ? '#e5e7eb' : curColor);
            g.appendChild(textBg);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', px + 14);
            text.setAttribute('y', py + 23);
            text.setAttribute('fill', isLineart ? '#000000' : '#ffffff');
            text.setAttribute('font-size', '11.5');
            text.setAttribute('font-weight', 'bold');
            text.textContent = `[コマ${p.index}]`;
            g.appendChild(text);

            // Overlapモード時: 選択中コマに 8 方向リサイズハンドルを描画
            if (state.interactionMode === 'overlap' && isSelected && !isLineart) {
                renderOverlapHandles(g, p, px, py, pw, ph, vW, vH);
            }

            svg.appendChild(g);
        });

        // Exclusiveモード時: コマ連結境界 (Group Gutters) を描画
        if (state.interactionMode === 'exclusive' && state.toolMode === 'select' && !isLineart) {
            renderGroupGutters(svg, vW, vH);
        }

        // スライス線・プレビュー描画
        if (state.sliceLine) {
            const sLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            sLine.setAttribute('x1', state.sliceLine.start.x * vW);
            sLine.setAttribute('y1', state.sliceLine.start.y * vH);
            sLine.setAttribute('x2', state.sliceLine.end.x * vW);
            sLine.setAttribute('y2', state.sliceLine.end.y * vH);
            sLine.setAttribute('stroke', state.sliceCandidate ? '#ea580c' : '#9ca3af');
            sLine.setAttribute('stroke-width', '3');
            sLine.setAttribute('stroke-dasharray', '5 3');
            svg.appendChild(sLine);
        }

        // 矩形作成プレビュー描画
        if (state.drawRectBox) {
            const bx = Math.min(state.drawRectBox.start.x, state.drawRectBox.end.x) * vW;
            const by = Math.min(state.drawRectBox.start.y, state.drawRectBox.end.y) * vH;
            const bw = Math.abs(state.drawRectBox.end.x - state.drawRectBox.start.x) * vW;
            const bh = Math.abs(state.drawRectBox.end.y - state.drawRectBox.start.y) * vH;

            const rBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rBox.setAttribute('x', bx);
            rBox.setAttribute('y', by);
            rBox.setAttribute('width', bw);
            rBox.setAttribute('height', bh);
            rBox.setAttribute('fill', 'rgba(59, 130, 246, 0.2)');
            rBox.setAttribute('stroke', '#3b82f6');
            rBox.setAttribute('stroke-width', '2');
            rBox.setAttribute('stroke-dasharray', '4 4');
            svg.appendChild(rBox);
        }
    }

    // --- Overlap モード: パネルドラッグ移動 ---
    function startPanelMove(e, panel, vW, vH) {
        const svg = document.getElementById('manga-canvas-svg');
        const svgRect = svg.getBoundingClientRect();
        const startX = (e.clientX - svgRect.left) / svgRect.width;
        const startY = (e.clientY - svgRect.top) / svgRect.height;
        const origX = panel.rect.x;
        const origY = panel.rect.y;

        const onMove = (moveEv) => {
            const curX = (moveEv.clientX - svgRect.left) / svgRect.width;
            const curY = (moveEv.clientY - svgRect.top) / svgRect.height;
            const dx = curX - startX;
            const dy = curY - startY;

            panel.rect.x = Math.max(0, Math.min(1 - panel.rect.w, origX + dx));
            panel.rect.y = Math.max(0, Math.min(1 - panel.rect.h, origY + dy));
            render();
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            pushHistory();
            syncToGradio();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }

    // --- Overlap モード: 8方向リサイズハンドル ---
    function renderOverlapHandles(g, panel, px, py, pw, ph, vW, vH) {
        const handles = [
            { id: 'nw', x: px, y: py, cursor: 'nwse-resize' },
            { id: 'n', x: px + pw / 2, y: py, cursor: 'ns-resize' },
            { id: 'ne', x: px + pw, y: py, cursor: 'nesw-resize' },
            { id: 'e', x: px + pw, y: py + ph / 2, cursor: 'ew-resize' },
            { id: 'se', x: px + pw, y: py + ph, cursor: 'nwse-resize' },
            { id: 's', x: px + pw / 2, y: py + ph, cursor: 'ns-resize' },
            { id: 'sw', x: px, y: py + ph, cursor: 'nesw-resize' },
            { id: 'w', x: px, y: py + ph / 2, cursor: 'ew-resize' },
        ];

        handles.forEach(h => {
            const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circ.setAttribute('cx', h.x);
            circ.setAttribute('cy', h.y);
            circ.setAttribute('r', '5.5');
            circ.setAttribute('fill', '#ffffff');
            circ.setAttribute('stroke', '#2563eb');
            circ.setAttribute('stroke-width', '2');
            circ.style.cursor = h.cursor;

            circ.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                startHandleResize(e, panel, h.id, vW, vH);
            });

            g.appendChild(circ);
        });
    }

    function startHandleResize(e, panel, handleId, vW, vH) {
        const svg = document.getElementById('manga-canvas-svg');
        const svgRect = svg.getBoundingClientRect();
        const startX = (e.clientX - svgRect.left) / svgRect.width;
        const startY = (e.clientY - svgRect.top) / svgRect.height;
        const orig = { ...panel.rect };

        const onMove = (moveEv) => {
            const curX = (moveEv.clientX - svgRect.left) / svgRect.width;
            const curY = (moveEv.clientY - svgRect.top) / svgRect.height;
            const dx = curX - startX;
            const dy = curY - startY;

            let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h;

            if (handleId.includes('w')) {
                const maxW = orig.x + orig.w - 0.05;
                nx = Math.max(0, Math.min(maxW, orig.x + dx));
                nw = orig.w - (nx - orig.x);
            }
            if (handleId.includes('e')) {
                nw = Math.max(0.05, Math.min(1 - orig.x, orig.w + dx));
            }
            if (handleId.includes('n')) {
                const maxH = orig.y + orig.h - 0.05;
                ny = Math.max(0, Math.min(maxH, orig.y + dy));
                nh = orig.h - (ny - orig.y);
            }
            if (handleId.includes('s')) {
                nh = Math.max(0.05, Math.min(1 - orig.y, orig.h + dy));
            }

            panel.rect = { x: nx, y: ny, w: nw, h: nh };
            render();
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            pushHistory();
            syncToGradio();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }

    // --- Exclusive モード: 境界グループ連動ドラッグ (Group Gutters) ---
    function renderGroupGutters(svg, vW, vH) {
        const tol = 0.015;
        const gutters = [];

        // 垂直境界の抽出
        for (let i = 0; i < state.panels.length; i++) {
            for (let j = i + 1; j < state.panels.length; j++) {
                const pA = state.panels[i];
                const pB = state.panels[j];

                if (Math.abs((pA.rect.x + pA.rect.w) - pB.rect.x) < tol) {
                    const yStart = Math.max(pA.rect.y, pB.rect.y);
                    const yEnd = Math.min(pA.rect.y + pA.rect.h, pB.rect.y + pB.rect.h);
                    if (yEnd - yStart > 0.02) {
                        gutters.push({
                            type: 'v',
                            pos: (pA.rect.x + pA.rect.w + pB.rect.x) / 2,
                            yStart,
                            yEnd,
                            leftPanels: [pA],
                            rightPanels: [pB]
                        });
                    }
                } else if (Math.abs((pB.rect.x + pB.rect.w) - pA.rect.x) < tol) {
                    const yStart = Math.max(pA.rect.y, pB.rect.y);
                    const yEnd = Math.min(pA.rect.y + pA.rect.h, pB.rect.y + pB.rect.h);
                    if (yEnd - yStart > 0.02) {
                        gutters.push({
                            type: 'v',
                            pos: (pB.rect.x + pB.rect.w + pA.rect.x) / 2,
                            yStart,
                            yEnd,
                            leftPanels: [pB],
                            rightPanels: [pA]
                        });
                    }
                }

                if (Math.abs((pA.rect.y + pA.rect.h) - pB.rect.y) < tol) {
                    const xStart = Math.max(pA.rect.x, pB.rect.x);
                    const xEnd = Math.min(pA.rect.x + pA.rect.w, pB.rect.x + pB.rect.w);
                    if (xEnd - xStart > 0.02) {
                        gutters.push({
                            type: 'h',
                            pos: (pA.rect.y + pA.rect.h + pB.rect.y) / 2,
                            xStart,
                            xEnd,
                            topPanels: [pA],
                            bottomPanels: [pB]
                        });
                    }
                } else if (Math.abs((pB.rect.y + pB.rect.h) - pA.rect.y) < tol) {
                    const xStart = Math.max(pA.rect.x, pB.rect.x);
                    const xEnd = Math.min(pA.rect.x + pA.rect.w, pB.rect.x + pB.rect.w);
                    if (xEnd - xStart > 0.02) {
                        gutters.push({
                            type: 'h',
                            pos: (pB.rect.y + pB.rect.h + pA.rect.y) / 2,
                            xStart,
                            xEnd,
                            topPanels: [pB],
                            bottomPanels: [pA]
                        });
                    }
                }
            }
        }

        // 同一線上の境界をグループ化
        const grouped = [];
        gutters.forEach(g => {
            const existing = grouped.find(grp => grp.type === g.type && Math.abs(grp.pos - g.pos) < tol);
            if (existing) {
                if (g.type === 'v') {
                    existing.yStart = Math.min(existing.yStart, g.yStart);
                    existing.yEnd = Math.max(existing.yEnd, g.yEnd);
                    g.leftPanels.forEach(lp => { if (!existing.leftPanels.includes(lp)) existing.leftPanels.push(lp); });
                    g.rightPanels.forEach(rp => { if (!existing.rightPanels.includes(rp)) existing.rightPanels.push(rp); });
                } else {
                    existing.xStart = Math.min(existing.xStart, g.xStart);
                    existing.xEnd = Math.max(existing.xEnd, g.xEnd);
                    g.topPanels.forEach(tp => { if (!existing.topPanels.includes(tp)) existing.topPanels.push(tp); });
                    g.bottomPanels.forEach(bp => { if (!existing.bottomPanels.includes(bp)) existing.bottomPanels.push(bp); });
                }
            } else {
                grouped.push(g);
            }
        });

        // グループ境界線の描画
        grouped.forEach(g => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            if (g.type === 'v') {
                line.setAttribute('x1', g.pos * vW);
                line.setAttribute('y1', g.yStart * vH);
                line.setAttribute('x2', g.pos * vW);
                line.setAttribute('y2', g.yEnd * vH);
                line.style.cursor = 'col-resize';
            } else {
                line.setAttribute('x1', g.xStart * vW);
                line.setAttribute('y1', g.pos * vH);
                line.setAttribute('x2', g.xEnd * vW);
                line.setAttribute('y2', g.pos * vH);
                line.style.cursor = 'row-resize';
            }

            line.setAttribute('stroke', '#3b82f6');
            line.setAttribute('stroke-width', '10');
            line.setAttribute('stroke-opacity', '0.01');
            line.setAttribute('class', 'manga-gutter-line');

            line.addEventListener('pointerenter', () => line.setAttribute('stroke-opacity', '0.6'));
            line.addEventListener('pointerleave', () => line.setAttribute('stroke-opacity', '0.01'));

            line.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                startGroupGutterDrag(e, g, vW, vH);
            });

            svg.appendChild(line);
        });
    }

    function startGroupGutterDrag(e, group, vW, vH) {
        const svg = document.getElementById('manga-canvas-svg');
        const svgRect = svg.getBoundingClientRect();
        const startX = (e.clientX - svgRect.left) / svgRect.width;
        const startY = (e.clientY - svgRect.top) / svgRect.height;

        const origLefts = (group.type === 'v') ? group.leftPanels.map(p => ({ p, r: { ...p.rect } })) : [];
        const origRights = (group.type === 'v') ? group.rightPanels.map(p => ({ p, r: { ...p.rect } })) : [];
        const origTops = (group.type === 'h') ? group.topPanels.map(p => ({ p, r: { ...p.rect } })) : [];
        const origBottoms = (group.type === 'h') ? group.bottomPanels.map(p => ({ p, r: { ...p.rect } })) : [];

        const onMove = (moveEv) => {
            const curX = (moveEv.clientX - svgRect.left) / svgRect.width;
            const curY = (moveEv.clientY - svgRect.top) / svgRect.height;
            const deltaX = curX - startX;
            const deltaY = curY - startY;

            if (group.type === 'v') {
                let valid = true;
                origLefts.forEach(item => { if (item.r.w + deltaX < 0.05) valid = false; });
                origRights.forEach(item => { if (item.r.w - deltaX < 0.05) valid = false; });

                if (valid) {
                    origLefts.forEach(item => { item.p.rect.w = item.r.w + deltaX; });
                    origRights.forEach(item => {
                        item.p.rect.x = item.r.x + deltaX;
                        item.p.rect.w = item.r.w - deltaX;
                    });
                }
            } else {
                let valid = true;
                origTops.forEach(item => { if (item.r.h + deltaY < 0.05) valid = false; });
                origBottoms.forEach(item => { if (item.r.h - deltaY < 0.05) valid = false; });

                if (valid) {
                    origTops.forEach(item => { item.p.rect.h = item.r.h + deltaY; });
                    origBottoms.forEach(item => {
                        item.p.rect.y = item.r.y + deltaY;
                        item.p.rect.h = item.r.h - deltaY;
                    });
                }
            }
            render();
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            pushHistory();
            syncToGradio();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }

    // --- キャンバスドラッグインタラクション (Slice / DrawRect) ---
    function setupCanvasDragInteraction() {
        const wrapper = document.getElementById('manga-canvas-wrapper-el');
        if (!wrapper) return;

        wrapper.addEventListener('pointerdown', (e) => {
            if (e.target.tagName === 'line' || e.target.tagName === 'circle' || e.target.classList.contains('manga-btn')) return;
            if (state.toolMode === 'select') return;

            const svg = document.getElementById('manga-canvas-svg');
            const svgRect = svg.getBoundingClientRect();
            const startX = (e.clientX - svgRect.left) / svgRect.width;
            const startY = (e.clientY - svgRect.top) / svgRect.height;

            state.isDragging = true;

            if (state.toolMode === 'drawRect') {
                state.drawRectBox = {
                    start: { x: startX, y: startY },
                    end: { x: startX, y: startY }
                };
            } else if (state.toolMode === 'slice') {
                state.sliceLine = {
                    start: { x: startX, y: startY },
                    end: { x: startX, y: startY }
                };
                state.sliceCandidate = null;
            }

            const onMove = (moveEv) => {
                if (!state.isDragging) return;
                const curX = Math.max(0, Math.min(1, (moveEv.clientX - svgRect.left) / svgRect.width));
                const curY = Math.max(0, Math.min(1, (moveEv.clientY - svgRect.top) / svgRect.height));

                if (state.toolMode === 'drawRect' && state.drawRectBox) {
                    state.drawRectBox.end = { x: curX, y: curY };
                } else if (state.toolMode === 'slice' && state.sliceLine) {
                    state.sliceLine.end = { x: curX, y: curY };
                    state.sliceCandidate = findSliceCandidate(state.sliceLine);
                }
                render();
            };

            const onUp = (upEv) => {
                if (!state.isDragging) return;
                state.isDragging = false;
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);

                if (state.toolMode === 'drawRect' && state.drawRectBox) {
                    const bx = Math.min(state.drawRectBox.start.x, state.drawRectBox.end.x);
                    const by = Math.min(state.drawRectBox.start.y, state.drawRectBox.end.y);
                    const bw = Math.abs(state.drawRectBox.end.x - state.drawRectBox.start.x);
                    const bh = Math.abs(state.drawRectBox.end.y - state.drawRectBox.start.y);
                    state.drawRectBox = null;

                    if (bw > 0.05 && bh > 0.05) {
                        const newIndex = state.panels.length + 1;
                        const newPanel = {
                            id: generateId(),
                            rect: { x: bx, y: by, w: bw, h: bh },
                            zIndex: state.panels.length,
                            index: newIndex,
                            color: colorForKomaNumber(newIndex),
                            name: `コマ ${newIndex}`,
                            weight: 1.0,
                            interactionMode: state.interactionMode
                        };
                        state.panels.push(newPanel);
                        state.selectedIds.clear();
                        state.selectedIds.add(newPanel.id);
                        state.primarySelectedId = newPanel.id;
                        pushHistory();
                        render();
                        syncToGradio();
                    } else {
                        render();
                    }
                } else if (state.toolMode === 'slice' && state.sliceLine) {
                    const cand = state.sliceCandidate;
                    state.sliceLine = null;
                    state.sliceCandidate = null;

                    if (cand) {
                        applySlice(cand);
                    } else {
                        render();
                    }
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });
    }

    // --- 右サイドバーのコマ一覧サマリー表示 ＆ コマ番号ドラッグ入替 ---
    function renderSummaryList() {
        const container = document.getElementById('manga-panels-summary-container');
        if (!container) return;

        container.innerHTML = '';

        // 1. 全体画風・品質 (第1chunk)
        const styleBox = document.createElement('div');
        styleBox.className = 'manga-summary-base-box';
        const styleSnippet = state.parsedPrompt.style ? state.parsedPrompt.style : '(未入力 - clean illustration, monochrome 等の全体共通画風)';
        styleBox.innerHTML = `
            <div class="manga-summary-base-title">🎨 [全体画風・品質 - 第1chunk]</div>
            <div class="manga-summary-prompt-text ${state.parsedPrompt.style ? '' : 'empty'}">${escapeHtml(styleSnippet)}</div>
        `;
        container.appendChild(styleBox);

        // 2. ページ構造 (第2chunk)
        const pageBox = document.createElement('div');
        pageBox.className = 'manga-summary-base-box';
        pageBox.style.marginTop = '6px';
        const pageSnippet = state.parsedPrompt.page ? state.parsedPrompt.page : '(未入力 - 4koma manga 等の全体構造)';
        pageBox.innerHTML = `
            <div class="manga-summary-base-title">🧭 [ページ構造 - 第2chunk]</div>
            <div class="manga-summary-prompt-text ${state.parsedPrompt.page ? '' : 'empty'}">${escapeHtml(pageSnippet)}</div>
        `;
        container.appendChild(pageBox);

        // 3. 各コマの一覧表示 (論理コマ番号順 1..N)
        const sortedList = [...state.panels].sort((a, b) => (a.index || 0) - (b.index || 0));

        sortedList.forEach(p => {
            const isSelected = state.selectedIds.has(p.id);
            const item = document.createElement('div');
            item.className = `manga-summary-item ${isSelected ? 'selected' : ''}`;
            item.style.borderLeft = `5px solid ${p.color || colorForKomaNumber(p.index)}`;
            item.setAttribute('data-koma-index', p.index);

            const regionText = state.parsedPrompt.regions[p.index];
            const promptSnippet = regionText ? regionText : `(メイン欄の koma ${p.index}: にプロンプトを記入)`;
            const curWeight = (p.weight !== undefined ? p.weight : 1.0).toFixed(2);
            const curColor = p.color || colorForKomaNumber(p.index);

            item.innerHTML = `
                <div class="manga-summary-header-row">
                    <span class="manga-summary-tag manga-drag-handle" style="background: ${curColor}; color: #ffffff; cursor: grab;" title="ドラッグして他のコマと番号・適用領域を交換" draggable="true">☷ [コマ${p.index}]</span>
                    <span class="manga-summary-title">${p.name || `コマ ${p.index}`}</span>
                    <button type="button" class="manga-card-del-btn" title="コマ削除" onclick="window.mangaPrompterDelete('${p.id}')">×</button>
                </div>
                <div class="manga-summary-prompt-text ${regionText ? '' : 'empty'}">${escapeHtml(promptSnippet)}</div>
                <div class="manga-summary-weight-row">
                    <label class="manga-summary-weight-label">重み: <span class="manga-weight-badge" id="manga-w-val-${p.id}">${curWeight}</span></label>
                    <input type="range" class="manga-summary-weight-slider" min="0.1" max="2.0" step="0.05" value="${curWeight}" data-id="${p.id}">
                </div>
            `;

            // コマ番号ドラッグ＆ドロップ再割当イベント
            const dragHandle = item.querySelector('.manga-drag-handle');
            dragHandle.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                state.draggedKomaIndex = p.index;
                e.dataTransfer.setData('text/plain', p.index.toString());
                e.dataTransfer.effectAllowed = 'move';
                item.style.opacity = '0.5';
            });

            dragHandle.addEventListener('dragend', () => {
                state.draggedKomaIndex = null;
                item.style.opacity = '1.0';
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const srcIndex = state.draggedKomaIndex || parseInt(e.dataTransfer.getData('text/plain'), 10);
                const dstIndex = p.index;
                if (srcIndex && dstIndex && srcIndex !== dstIndex) {
                    window.mangaPrompterSwapKomaNumbers(srcIndex, dstIndex);
                }
            });

            const slider = item.querySelector('.manga-summary-weight-slider');
            const badge = item.querySelector(`#manga-w-val-${p.id}`);
            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                p.weight = val;
                badge.textContent = val.toFixed(2);
                syncToGradio();
            });

            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.classList.contains('manga-drag-handle')) {
                    state.selectedIds.clear();
                    state.selectedIds.add(p.id);
                    state.primarySelectedId = p.id;
                    render();
                    renderSummaryList();
                }
            });

            container.appendChild(item);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function setupResolutionWatcher() {
        const updateRatio = () => {
            const wElem = document.querySelector('#txt2img_width input[type="number"]') || document.querySelector('#txt2img_width input');
            const hElem = document.querySelector('#txt2img_height input[type="number"]') || document.querySelector('#txt2img_height input');

            let w = wElem ? parseInt(wElem.value, 10) : 832;
            let h = hElem ? parseInt(hElem.value, 10) : 1216;

            if (w > 0 && h > 0) {
                state.width = w;
                state.height = h;
                state.aspectRatio = h / w;
                const ratioDisplay = document.getElementById('manga-res-display');
                if (ratioDisplay) {
                    ratioDisplay.textContent = `${w} × ${h} (自動同期中)`;
                }
                render();
            }
        };

        document.addEventListener('input', (e) => {
            if (e.target.closest('#txt2img_width') || e.target.closest('#txt2img_height')) {
                updateRatio();
            }
        });

        setInterval(updateRatio, 1500);
        updateRatio();
    }

    function setupPromptWatcher() {
        document.addEventListener('input', (e) => {
            if (e.target.closest('#txt2img_prompt') || e.target.closest('#img2img_prompt') || e.target.closest('#prompt')) {
                parseMainPrompt();
            }
        });
        setInterval(parseMainPrompt, 2000);
        parseMainPrompt();
    }

    function init() {
        const container = document.getElementById('manga-prompter-root');
        if (!container) return;

        if (!isInitialized) {
            isInitialized = true;
            mangaPrompterReset();
            updateViewModeUI();
            updateInteractionModeUI();
            setupResolutionWatcher();
            setupCanvasDragInteraction();
            setupPromptWatcher();

            window.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (state.primarySelectedId) {
                        e.preventDefault();
                        window.mangaPrompterDelete(state.primarySelectedId);
                    }
                } else if (e.ctrlKey && e.key === 'z') {
                    e.preventDefault();
                    mangaPrompterUndo();
                } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                    e.preventDefault();
                    mangaPrompterRedo();
                }
            });
        }

        render();
        renderSummaryList();
    }

    if (typeof onUiLoaded === 'function') {
        onUiLoaded(init);
    }
    if (typeof onUiUpdate === 'function') {
        onUiUpdate(() => {
            if (!isInitialized && document.getElementById('manga-prompter-root')) {
                init();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 500);
    });
    setInterval(() => {
        if (document.getElementById('manga-prompter-root') && (!isInitialized || !document.getElementById('manga-canvas-svg').hasChildNodes())) {
            init();
        }
    }, 1000);

})();
