/* EasyReforge Manga Prompter - Main Prompt Live Sync & Visual Info Panel (v3.1 Plan A) */

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

    const state = {
        panels: [],
        selectedIds: new Set(),
        primarySelectedId: null,
        mode: 'select',
        viewMode: 'color', // 'color' または 'lineart'
        sliceLine: null,
        drawRectBox: null,
        isDragging: false,
        history: [],
        historyIndex: -1,
        aspectRatio: 1216 / 832,
        width: 832,
        height: 1216,
        parsedPrompt: {
            page: '',
            style: '',
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
        state.history.push(JSON.stringify(state.panels));
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
            state.panels = JSON.parse(state.history[state.historyIndex]);
            sortAndAssignPanels();
            render();
            syncToGradio();
            updateHistoryButtons();
        }
    };

    window.mangaPrompterRedo = function () {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            state.panels = JSON.parse(state.history[state.historyIndex]);
            sortAndAssignPanels();
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

    // 表示モード切り替え（カラー ⇄ 白黒線画）
    window.mangaPrompterToggleViewMode = function () {
        state.viewMode = (state.viewMode === 'color') ? 'lineart' : 'color';
        const btn = document.getElementById('manga-btn-viewmode');
        if (btn) {
            btn.textContent = (state.viewMode === 'color') ? '🎨 カラー表示' : '⬛ 白黒線画表示';
            btn.title = (state.viewMode === 'color') ? '白黒線画モードに切替（ControlNet用）' : 'カラー確認モードに切替';
        }
        render();
    };

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

    // 日本式MANGA読み順ソート（右上 → 左上 → 右下）
    function sortAndAssignPanels() {
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
            const original = state.panels.find(item => item.id === p.id);
            if (original) {
                original.index = idx + 1;
                original.name = `コマ ${idx + 1}` + (original.zIndex > 0 ? ' (カットイン)' : '');
                original.color = PANEL_COLORS[idx % PANEL_COLORS.length];
                if (original.weight === undefined) original.weight = 1.0;
            }
        });
    }

    // メインプロンプト欄のリアルタイム解析 (v3.7.2: PAGE + STYLE + REGIONS)
    function parseMainPrompt() {
        const mainPromptEl = document.querySelector('#txt2img_prompt textarea') || 
                             document.querySelector('#img2img_prompt textarea') ||
                             document.querySelector('#prompt textarea');
        if (!mainPromptEl) return;

        const text = mainPromptEl.value.trim();
        if (!text) {
            state.parsedPrompt = { page: '', style: '', regions: {} };
            renderSummaryList();
            return;
        }

        const chunks = text.split(/\bBREAK\b/i).map(c => c.trim()).filter(c => c.length > 0);
        const page = chunks.length > 0 ? chunks[0] : '';
        const style = chunks.length > 1 ? chunks[1] : '';
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

        state.parsedPrompt = { page, style, regions };
        renderSummaryList();
    }

    // メインプロンプト欄へのテンプレート挿入 (v3.7.2: 5chunk N+2構造)
    window.mangaPrompterInsertTemplateToMainPrompt = function () {
        const mainPromptEl = document.querySelector('#txt2img_prompt textarea') || 
                             document.querySelector('#img2img_prompt textarea') ||
                             document.querySelector('#prompt textarea');
        if (!mainPromptEl) return;

        const sorted = [...state.panels].sort((a, b) => (a.index || 0) - (b.index || 0));
        const numPanels = sorted.length;
        let curVal = mainPromptEl.value.trim();

        const chunks = curVal.split(/\bBREAK\b/i).map(c => c.trim()).filter(c => c.length > 0);
        let pagePart = chunks.length > 0 ? chunks[0] : `${numPanels}koma, manga page, comic strip, comic panel`;
        let stylePart = chunks.length > 1 ? chunks[1] : 'masterpiece, best quality, monochrome, manga ink, clean lineart';

        let templateLines = [
            pagePart,
            'BREAK',
            stylePart
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

    // スラッシュ分割
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
        const newPanel = {
            id: generateId(),
            rect: newRect2,
            zIndex: target.zIndex || 0,
            color: '#888888',
            name: '新規コマ',
            weight: 1.0,
        };

        state.panels.push(newPanel);
        state.selectedIds.clear();
        state.selectedIds.add(newPanel.id);
        state.primarySelectedId = newPanel.id;

        sortAndAssignPanels();
        pushHistory();
        render();
        syncToGradio();
    };

    // 矩形ドラッグ作成モード
    window.mangaPrompterToggleDrawRect = function () {
        state.mode = (state.mode === 'drawRect') ? 'select' : 'drawRect';
        const btn = document.getElementById('manga-btn-draw-rect');
        if (btn) {
            if (state.mode === 'drawRect') {
                btn.classList.add('active');
                btn.textContent = '✏️ 矩形ドラッグ中 (解除)';
            } else {
                btn.classList.remove('active');
                btn.textContent = '＋ 矩形ドラッグ作成';
            }
        }
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

            sortAndAssignPanels();
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
            sortAndAssignPanels();
            pushHistory();
            render();
            syncToGradio();
        }
    };

    // 入れ子コマ追加
    window.mangaPrompterAddInset = function () {
        let parent = state.panels.find(p => p.id === state.primarySelectedId) || state.panels[0];
        if (!parent) return;

        const pr = parent.rect;
        const inset = {
            id: generateId(),
            rect: {
                x: pr.x + pr.w * 0.25,
                y: pr.y + pr.h * 0.25,
                w: pr.w * 0.5,
                h: pr.h * 0.5,
            },
            zIndex: (parent.zIndex || 0) + 1,
            color: '#FDD835',
            name: 'カットイン',
            weight: 1.2,
        };

        state.panels.push(inset);
        state.selectedIds.clear();
        state.selectedIds.add(inset.id);
        state.primarySelectedId = inset.id;

        sortAndAssignPanels();
        pushHistory();
        render();
        syncToGradio();
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

        sortAndAssignPanels();
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
            'inset': [
                { rect: { x: 0, y: 0, w: 1, h: 0.6 }, zIndex: 0 },
                { rect: { x: 0.55, y: 0.05, w: 0.4, h: 0.35 }, zIndex: 1 },
                { rect: { x: 0.5, y: 0.6, w: 0.5, h: 0.4 }, zIndex: 0 },
                { rect: { x: 0, y: 0.6, w: 0.5, h: 0.4 }, zIndex: 0 },
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
        }));

        state.selectedIds.clear();
        state.selectedIds.add(state.panels[0].id);
        state.primarySelectedId = state.panels[0].id;
        sortAndAssignPanels();
        pushHistory();
        render();
        syncToGradio();
    };

    function syncToGradio() {
        const jsonInput = document.querySelector('#manga-prompter-json-bridge textarea');
        if (jsonInput) {
            jsonInput.value = JSON.stringify(state.panels);
            jsonInput.dispatchEvent(new Event('input', { bubbles: true }));
            jsonInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        renderSummaryList();
    }

    function render() {
        const svg = document.getElementById('manga-canvas-svg');
        if (!svg) return;

        const vW = 1000;
        const vH = 1000 * state.aspectRatio;
        svg.setAttribute('viewBox', `0 0 ${vW} ${vH}`);
        svg.innerHTML = '';

        const isLineart = (state.viewMode === 'lineart');

        // 背景
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', vW);
        bg.setAttribute('height', vH);
        bg.setAttribute('fill', isLineart ? '#ffffff' : '#f4f4f6');
        bg.setAttribute('stroke', isLineart ? '#000000' : '#d1d5db');
        bg.setAttribute('stroke-width', '4');

        bg.addEventListener('pointerdown', () => {
            if (state.mode !== 'drawRect') {
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

            if (isLineart) {
                rect.setAttribute('fill', '#ffffff');
                rect.setAttribute('stroke', isSelected ? '#3b82f6' : '#000000');
                rect.setAttribute('stroke-width', isSelected ? '6' : '4');
            } else {
                rect.setAttribute('fill', p.color + (isSelected ? '33' : '18'));
                rect.setAttribute('stroke', isSelected ? '#2563eb' : p.color);
                rect.setAttribute('stroke-width', isSelected ? '3.5' : '2');
            }
            rect.setAttribute('rx', '4');

            rect.addEventListener('pointerdown', (e) => {
                if (state.mode === 'drawRect') return;
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
            textBg.setAttribute('fill', isLineart ? '#e5e7eb' : p.color);
            g.appendChild(textBg);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', px + 14);
            text.setAttribute('y', py + 23);
            text.setAttribute('fill', isLineart ? '#000000' : '#ffffff');
            text.setAttribute('font-size', '11.5');
            text.setAttribute('font-weight', 'bold');
            text.textContent = `[コマ${p.index}]`;
            g.appendChild(text);

            svg.appendChild(g);
        });

        if (state.mode === 'select' && !isLineart) {
            renderGutters(svg, vW, vH);
        }

        if (state.sliceLine) {
            const sLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            sLine.setAttribute('x1', state.sliceLine.start.x * vW);
            sLine.setAttribute('y1', state.sliceLine.start.y * vH);
            sLine.setAttribute('x2', state.sliceLine.end.x * vW);
            sLine.setAttribute('y2', state.sliceLine.end.y * vH);
            sLine.setAttribute('stroke', '#ef4444');
            sLine.setAttribute('stroke-width', '3.5');
            sLine.setAttribute('stroke-dasharray', '6 3');
            svg.appendChild(sLine);
        }

        if (state.drawRectBox) {
            const bx = Math.min(state.drawRectBox.start.x, state.drawRectBox.end.x) * vW;
            const by = Math.min(state.drawRectBox.start.y, state.drawRectBox.end.y) * vH;
            const bw = Math.abs(state.drawRectBox.end.x - state.drawRectBox.start.x) * vW;
            const bh = Math.abs(state.drawRectBox.end.y - state.drawRectBox.start.y) * vH;

            const dRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            dRect.setAttribute('x', bx);
            dRect.setAttribute('y', by);
            dRect.setAttribute('width', bw);
            dRect.setAttribute('height', bh);
            dRect.setAttribute('fill', 'rgba(59, 130, 246, 0.2)');
            dRect.setAttribute('stroke', '#3b82f6');
            dRect.setAttribute('stroke-width', '2.5');
            dRect.setAttribute('stroke-dasharray', '5 3');
            svg.appendChild(dRect);
        }
    }

    function renderGutters(svg, vW, vH) {
        const gutters = [];
        const threshold = 0.015;

        for (let i = 0; i < state.panels.length; i++) {
            for (let j = i + 1; j < state.panels.length; j++) {
                const a = state.panels[i];
                const b = state.panels[j];
                if ((a.zIndex || 0) !== (b.zIndex || 0)) continue;

                if (Math.abs(a.rect.x + a.rect.w - b.rect.x) < threshold) {
                    const yStart = Math.max(a.rect.y, b.rect.y);
                    const yEnd = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h);
                    if (yEnd - yStart > 0.05) {
                        gutters.push({
                            type: 'v', pos: a.rect.x + a.rect.w, start: yStart, end: yEnd, panelA: a, panelB: b
                        });
                    }
                } else if (Math.abs(b.rect.x + b.rect.w - a.rect.x) < threshold) {
                    const yStart = Math.max(a.rect.y, b.rect.y);
                    const yEnd = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h);
                    if (yEnd - yStart > 0.05) {
                        gutters.push({
                            type: 'v', pos: b.rect.x + b.rect.w, start: yStart, end: yEnd, panelA: b, panelB: a
                        });
                    }
                }

                if (Math.abs(a.rect.y + a.rect.h - b.rect.y) < threshold) {
                    const xStart = Math.max(a.rect.x, b.rect.x);
                    const xEnd = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w);
                    if (xEnd - xStart > 0.05) {
                        gutters.push({
                            type: 'h', pos: a.rect.y + a.rect.h, start: xStart, end: xEnd, panelA: a, panelB: b
                        });
                    }
                } else if (Math.abs(b.rect.y + b.rect.h - a.rect.y) < threshold) {
                    const xStart = Math.max(a.rect.x, b.rect.x);
                    const xEnd = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w);
                    if (xEnd - xStart > 0.05) {
                        gutters.push({
                            type: 'h', pos: b.rect.y + b.rect.h, start: xStart, end: xEnd, panelA: b, panelB: a
                        });
                    }
                }
            }
        }

        gutters.forEach(g => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            if (g.type === 'v') {
                line.setAttribute('x1', g.pos * vW);
                line.setAttribute('y1', g.start * vH);
                line.setAttribute('x2', g.pos * vW);
                line.setAttribute('y2', g.end * vH);
            } else {
                line.setAttribute('x1', g.start * vW);
                line.setAttribute('y1', g.pos * vH);
                line.setAttribute('x2', g.end * vW);
                line.setAttribute('y2', g.pos * vH);
            }
            line.setAttribute('stroke', '#3b82f6');
            line.setAttribute('stroke-width', '7');
            line.setAttribute('stroke-opacity', '0.4');
            line.setAttribute('stroke-linecap', 'round');
            line.style.cursor = g.type === 'v' ? 'ew-resize' : 'ns-resize';

            line.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startGutterDrag(e, g, vW, vH);
            });

            svg.appendChild(line);
        });
    }

    function startGutterDrag(e, gutter, vW, vH) {
        const svg = document.getElementById('manga-canvas-svg');
        const svgRect = svg.getBoundingClientRect();

        const onMove = (moveEv) => {
            if (gutter.type === 'v') {
                const normX = (moveEv.clientX - svgRect.left) / svgRect.width;
                const clampedX = Math.max(gutter.panelA.rect.x + 0.05, Math.min(gutter.panelB.rect.x + gutter.panelB.rect.w - 0.05, normX));
                const delta = clampedX - (gutter.panelA.rect.x + gutter.panelA.rect.w);

                gutter.panelA.rect.w += delta;
                gutter.panelB.rect.x += delta;
                gutter.panelB.rect.w -= delta;
            } else {
                const normY = (moveEv.clientY - svgRect.top) / svgRect.height;
                const clampedY = Math.max(gutter.panelA.rect.y + 0.05, Math.min(gutter.panelB.rect.y + gutter.panelB.rect.h - 0.05, normY));
                const delta = clampedY - (gutter.panelA.rect.y + gutter.panelA.rect.h);

                gutter.panelA.rect.h += delta;
                gutter.panelB.rect.y += delta;
                gutter.panelB.rect.h -= delta;
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

    function setupCanvasDragInteraction() {
        const wrapper = document.getElementById('manga-canvas-wrapper-el');
        if (!wrapper) return;

        wrapper.addEventListener('pointerdown', (e) => {
            if (e.target.tagName === 'line' || e.target.classList.contains('manga-btn')) return;

            const svg = document.getElementById('manga-canvas-svg');
            const svgRect = svg.getBoundingClientRect();
            const startX = (e.clientX - svgRect.left) / svgRect.width;
            const startY = (e.clientY - svgRect.top) / svgRect.height;

            state.isDragging = true;

            if (state.mode === 'drawRect') {
                state.drawRectBox = {
                    start: { x: startX, y: startY },
                    end: { x: startX, y: startY }
                };
            } else {
                state.sliceLine = {
                    start: { x: startX, y: startY },
                    end: { x: startX, y: startY }
                };
            }

            const onMove = (moveEv) => {
                if (!state.isDragging) return;
                const curX = Math.max(0, Math.min(1, (moveEv.clientX - svgRect.left) / svgRect.width));
                const curY = Math.max(0, Math.min(1, (moveEv.clientY - svgRect.top) / svgRect.height));

                if (state.mode === 'drawRect' && state.drawRectBox) {
                    state.drawRectBox.end = { x: curX, y: curY };
                } else if (state.sliceLine) {
                    state.sliceLine.end = { x: curX, y: curY };
                }
                render();
            };

            const onUp = (upEv) => {
                if (!state.isDragging) return;
                state.isDragging = false;
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);

                if (state.mode === 'drawRect' && state.drawRectBox) {
                    const bx = Math.min(state.drawRectBox.start.x, state.drawRectBox.end.x);
                    const by = Math.min(state.drawRectBox.start.y, state.drawRectBox.end.y);
                    const bw = Math.abs(state.drawRectBox.end.x - state.drawRectBox.start.x);
                    const bh = Math.abs(state.drawRectBox.end.y - state.drawRectBox.start.y);
                    state.drawRectBox = null;

                    if (bw > 0.05 && bh > 0.05) {
                        const newPanel = {
                            id: generateId(),
                            rect: { x: bx, y: by, w: bw, h: bh },
                            zIndex: 0,
                            color: '#888888',
                            name: '新規コマ',
                            weight: 1.0,
                        };
                        state.panels.push(newPanel);
                        state.selectedIds.clear();
                        state.selectedIds.add(newPanel.id);
                        state.primarySelectedId = newPanel.id;
                        state.mode = 'select';
                        window.mangaPrompterToggleDrawRect();
                        sortAndAssignPanels();
                        pushHistory();
                        render();
                        syncToGradio();
                    } else {
                        render();
                    }
                } else if (state.sliceLine) {
                    const sl = state.sliceLine;
                    state.sliceLine = null;
                    const dx = sl.end.x - sl.start.x;
                    const dy = sl.end.y - sl.start.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0.06) {
                        const isHorizontalCut = Math.abs(dx) > Math.abs(dy);
                        applyFreehandSlice(sl, isHorizontalCut);
                    } else {
                        render();
                    }
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });
    }

    function applyFreehandSlice(line, isHorizontalCut) {
        const midX = (line.start.x + line.end.x) / 2;
        const midY = (line.start.y + line.end.y) / 2;

        const hitPanel = state.panels.find(p => {
            const r = p.rect;
            return midX >= r.x && midX <= r.x + r.w && midY >= r.y && midY <= r.y + r.h;
        }) || (state.primarySelectedId ? state.panels.find(p => p.id === state.primarySelectedId) : null);

        if (!hitPanel) {
            render();
            return;
        }

        const r = hitPanel.rect;
        let newRect1, newRect2;

        if (isHorizontalCut) {
            const cutY = Math.max(r.y + 0.05, Math.min(r.y + r.h - 0.05, midY));
            const h1 = cutY - r.y;
            const h2 = r.h - h1;
            newRect1 = { x: r.x, y: r.y, w: r.w, h: h1 };
            newRect2 = { x: r.x, y: cutY, w: r.w, h: h2 };
        } else {
            const cutX = Math.max(r.x + 0.05, Math.min(r.x + r.w - 0.05, midX));
            const w1 = cutX - r.x;
            const w2 = r.w - w1;
            newRect1 = { x: r.x, y: r.y, w: w1, h: r.h };
            newRect2 = { x: cutX, y: r.y, w: w2, h: r.h };
        }

        hitPanel.rect = newRect1;
        const newPanel = {
            id: generateId(),
            rect: newRect2,
            zIndex: hitPanel.zIndex || 0,
            color: '#888888',
            name: '新規コマ',
            weight: 1.0,
        };

        state.panels.push(newPanel);
        state.selectedIds.clear();
        state.selectedIds.add(newPanel.id);
        state.primarySelectedId = newPanel.id;

        sortAndAssignPanels();
        pushHistory();
        render();
        syncToGradio();
    }

    // 右サイドバーのコマ一覧サマリー表示（メインプロンプトリアルタイム連動）
    function renderSummaryList() {
        const container = document.getElementById('manga-panels-summary-container');
        if (!container) return;

        container.innerHTML = '';

        // 1. ページ構造 (第1chunk)
        const pageBox = document.createElement('div');
        pageBox.className = 'manga-summary-base-box';
        const pageSnippet = state.parsedPrompt.page ? state.parsedPrompt.page : '(未入力 - 3koma, manga page, comic strip 等の全体コマ構造)';
        pageBox.innerHTML = `
            <div class="manga-summary-base-title">🧭 [ページ構造 - 第1chunk]</div>
            <div class="manga-summary-prompt-text ${state.parsedPrompt.page ? '' : 'empty'}">${escapeHtml(pageSnippet)}</div>
        `;
        container.appendChild(pageBox);

        // 2. 全体画風・品質 (第2chunk)
        const styleBox = document.createElement('div');
        styleBox.className = 'manga-summary-base-box';
        styleBox.style.marginTop = '6px';
        const styleSnippet = state.parsedPrompt.style ? state.parsedPrompt.style : '(未入力 - masterpiece, monochrome, manga ink 等の全体共通画風)';
        styleBox.innerHTML = `
            <div class="manga-summary-base-title">🎨 [全体画風・品質 - 第2chunk]</div>
            <div class="manga-summary-prompt-text ${state.parsedPrompt.style ? '' : 'empty'}">${escapeHtml(styleSnippet)}</div>
        `;
        container.appendChild(styleBox);

        // 3. 各コマの一覧表示
        const sortedList = [...state.panels].sort((a, b) => (a.index || 0) - (b.index || 0));

        sortedList.forEach(p => {
            const isSelected = state.selectedIds.has(p.id);
            const item = document.createElement('div');
            item.className = `manga-summary-item ${isSelected ? 'selected' : ''}`;
            item.style.borderLeft = `5px solid ${p.color}`;

            const regionText = state.parsedPrompt.regions[p.index];
            const promptSnippet = regionText ? regionText : `(メイン欄の koma ${p.index}: にプロンプトを記入)`;
            const curWeight = (p.weight !== undefined ? p.weight : 1.0).toFixed(2);

            item.innerHTML = `
                <div class="manga-summary-header-row">
                    <span class="manga-summary-tag" style="background: ${p.color}; color: #ffffff;">[コマ${p.index}]</span>
                    <span class="manga-summary-title">${p.name || `コマ ${p.index}`}</span>
                    <button type="button" class="manga-card-del-btn" title="コマ削除" onclick="window.mangaPrompterDelete('${p.id}')">×</button>
                </div>
                <div class="manga-summary-prompt-text ${regionText ? '' : 'empty'}">${escapeHtml(promptSnippet)}</div>
                <div class="manga-summary-weight-row">
                    <label class="manga-summary-weight-label">重み: <span class="manga-weight-badge" id="manga-w-val-${p.id}">${curWeight}</span></label>
                    <input type="range" class="manga-summary-weight-slider" min="0.1" max="2.0" step="0.05" value="${curWeight}" data-id="${p.id}">
                </div>
            `;

            const slider = item.querySelector('.manga-summary-weight-slider');
            const badge = item.querySelector(`#manga-w-val-${p.id}`);
            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                p.weight = val;
                badge.textContent = val.toFixed(2);
                const jsonInput = document.querySelector('#manga-prompter-json-bridge textarea');
                if (jsonInput) {
                    jsonInput.value = JSON.stringify(state.panels);
                    jsonInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
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
