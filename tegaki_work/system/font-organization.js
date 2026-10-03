/**
 * ============================================================================
 * ファイル名: system/font-organization.js
 * 責務: フォントの場面別フォルダ、配置、手動順を管理する純粋モデルと同期API。
 * 依存: system/font-library.js のcatalog/既存import一覧、localStorage
 * 被依存: UIのフォントツリー/設定表示
 * 公開API: FontOrganization, fontOrganization, getOrganization,
 *   setFontFolder, createOrganizationFolder, renameOrganizationFolder,
 *   deleteOrganizationFolder, moveOrganizationNode, setFavoriteFirst,
 *   organizationReady
 * 保存: organization設定だけをlocalStorageへ置く。Project/History/rendererへは関与しない。
 * 実装状態: ✅技術実装（WP-022 backend slice / Owner受入前）
 * ============================================================================
 */

import { fontLibrary } from './font-library.js';

export const FONT_ORGANIZATION_STORAGE_KEY = 'tegaki-font-organization-v1';
export const ORGANIZATION_ROOT = 'root';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function cleanId(value) {
    const id = String(value ?? '').trim();
    return /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(id) ? id : '';
}

function cleanLabel(value, fallback = 'フォルダ') {
    const label = String(value ?? '')
        .replace(/[\u0000-\u001f<>"'`\\]/g, '')
        .trim()
        .slice(0, 60);
    return label || fallback;
}

function fontNode(id) {
    return `font:${id}`;
}

function folderNode(id) {
    return `folder:${id}`;
}

function parseNode(value) {
    const text = String(value ?? '');
    const match = /^(folder|font):([a-z0-9][a-z0-9._-]{0,119})$/i.exec(text);
    return match ? { kind: match[1].toLowerCase(), id: match[2] } : null;
}

function parentKey(parentId) {
    return parentId ? folderNode(parentId) : ORGANIZATION_ROOT;
}

function emptyOrganization(favoriteFirst = false) {
    return { folders: [], placements: {}, orders: { [ORGANIZATION_ROOT]: [] }, favoriteFirst: !!favoriteFirst };
}

function folderById(model, id) {
    return model.folders.find(folder => folder.id === id) || null;
}

function appendUnique(model, key, node) {
    model.orders[key] ||= [];
    if (!model.orders[key].includes(node)) model.orders[key].push(node);
}

function removeNode(model, node) {
    for (const key of Object.keys(model.orders)) model.orders[key] = model.orders[key].filter(item => item !== node);
}

function organizationFontIds(raw) {
    const ids = [];
    if (raw?.placements && typeof raw.placements === 'object' && !Array.isArray(raw.placements)) {
        ids.push(...Object.keys(raw.placements));
    }
    if (raw?.orders && typeof raw.orders === 'object' && !Array.isArray(raw.orders)) {
        for (const nodes of Object.values(raw.orders)) {
            if (!Array.isArray(nodes)) continue;
            for (const node of nodes) {
                const parsed = parseNode(node);
                if (parsed?.kind === 'font') ids.push(parsed.id);
            }
        }
    }
    return [...new Set(ids.map(cleanId).filter(Boolean))];
}

/** catalog/localStorageの値を壊れた親子関係や重複nodeなしのmodelへ正規化する。 */
export function normalizeOrganization(raw, knownFontIds = []) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const folders = [];
    const folderIds = new Set();
    for (const value of Array.isArray(src.folders) ? src.folders : []) {
        const id = cleanId(value?.id);
        if (!id || id === ORGANIZATION_ROOT || folderIds.has(id)) continue;
        folderIds.add(id);
        folders.push({
            id,
            label: cleanLabel(value?.label || value?.name, id),
            parentId: cleanId(value?.parentId) || null
        });
    }
    const byId = new Map(folders.map(folder => [folder.id, folder]));
    for (const folder of folders) {
        if (!folder.parentId || !byId.has(folder.parentId) || folder.parentId === folder.id) folder.parentId = null;
    }
    for (const folder of folders) {
        const seen = new Set();
        let current = folder;
        while (current?.parentId) {
            if (seen.has(current.id)) {
                folder.parentId = null;
                break;
            }
            seen.add(current.id);
            current = byId.get(current.parentId);
        }
    }

    const fontIds = [...new Set([
        ...knownFontIds.map(cleanId).filter(Boolean),
        ...organizationFontIds(src)
    ])];
    const fontIdSet = new Set(fontIds);
    const placements = {};
    if (src.placements && typeof src.placements === 'object' && !Array.isArray(src.placements)) {
        for (const [valueId, valueFolder] of Object.entries(src.placements)) {
            const id = cleanId(valueId);
            if (!id) continue;
            const folderId = cleanId(valueFolder);
            placements[id] = folderId && byId.has(folderId) ? folderId : null;
            fontIdSet.add(id);
        }
    }
    for (const id of fontIdSet) if (!(id in placements)) placements[id] = null;

    const model = {
        folders,
        placements,
        orders: { [ORGANIZATION_ROOT]: [], ...Object.fromEntries(folders.map(folder => [folderNode(folder.id), []])) },
        favoriteFirst: src.favoriteFirst === true
    };
    const seenNodes = new Set();
    const rawOrders = src.orders && typeof src.orders === 'object' && !Array.isArray(src.orders) ? src.orders : {};
    for (const [rawParent, rawNodes] of Object.entries(rawOrders)) {
        if (!Array.isArray(rawNodes)) continue;
        const rawParentNode = parseNode(rawParent);
        const parent = rawParent === ORGANIZATION_ROOT
            ? ORGANIZATION_ROOT
            : (rawParentNode?.kind === 'folder' ? rawParentNode.id : cleanId(rawParent));
        if (parent !== ORGANIZATION_ROOT && !byId.has(parent)) continue;
        for (const rawNode of rawNodes) {
            const parsed = parseNode(rawNode);
            if (!parsed) continue;
            const node = parsed.kind === 'folder' ? folderNode(parsed.id) : fontNode(parsed.id);
            if (seenNodes.has(node)) continue;
            if (parsed.kind === 'folder' && !byId.has(parsed.id)) continue;
            if (parsed.kind === 'font') {
                fontIdSet.add(parsed.id);
                if (!(parsed.id in placements)) placements[parsed.id] = parent === ORGANIZATION_ROOT ? null : parent;
            }
            const actualParent = parsed.kind === 'folder'
                ? parentKey(byId.get(parsed.id).parentId)
                : parentKey(placements[parsed.id]);
            if (model.orders[actualParent] && !seenNodes.has(node)) {
                model.orders[actualParent].push(node);
                seenNodes.add(node);
            }
        }
    }
    for (const folder of folders) appendUnique(model, parentKey(folder.parentId), folderNode(folder.id));
    for (const id of fontIdSet) appendUnique(model, parentKey(placements[id]), fontNode(id));
    return model;
}

function mergeLegacySeed(model, folders, fonts, { overrideNull = false } = {}) {
    const sortedFolders = [...(Array.isArray(folders) ? folders : [])]
        .filter(folder => cleanId(folder?.id))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    for (const legacy of sortedFolders) {
        const id = cleanId(legacy.id);
        if (!folderById(model, id)) {
            model.folders.push({ id, label: cleanLabel(legacy.name || legacy.label, id), parentId: null });
            model.orders[folderNode(id)] ||= [];
            appendUnique(model, ORGANIZATION_ROOT, folderNode(id));
        }
    }
    for (const legacy of Array.isArray(fonts) ? fonts : []) {
        const id = cleanId(legacy?.id);
        if (!id) continue;
        const folderId = cleanId(legacy.folderId);
        if (folderId && !folderById(model, folderId)) {
            // listFoldersが一時的に失敗しても、listFontsに残る旧folderIdを捨てない。
            model.folders.push({ id: folderId, label: cleanLabel(folderId, folderId), parentId: null });
            model.orders[folderNode(folderId)] ||= [];
            appendUnique(model, ORGANIZATION_ROOT, folderNode(folderId));
        }
        const target = folderId && folderById(model, folderId) ? folderId : null;
        if (!(id in model.placements) || (overrideNull && model.placements[id] === null)) model.placements[id] = target;
        removeNode(model, fontNode(id));
        appendUnique(model, parentKey(model.placements[id]), fontNode(id));
    }
    return normalizeOrganization(model);
}

function defaultStorage() {
    try { return globalThis.localStorage; } catch (error) { return null; }
}

export class FontOrganization {
    constructor(options = {}) {
        this.fontLibrary = options.library || options.fontLibrary || fontLibrary;
        this.storage = options.storage === undefined ? defaultStorage() : options.storage;
        this.storageKey = options.storageKey || FONT_ORGANIZATION_STORAGE_KEY;
        this.catalogProvider = options.catalogProvider || (() => this.fontLibrary?.loadCatalog?.());
        this._notifyLibrary = typeof options.notifyLibrary === 'function' ? options.notifyLibrary : null;
        this._model = emptyOrganization(false);
        this._listeners = new Set();
        this._initPromise = null;
        this._ready = false;
        this._legacySeeded = false;
        this._requestedFontIds = new Set();
        this._suppressLibrarySync = false;
        this._folderCounter = 0;
        this._libraryUnsubscribe = options.listenLibrary === false
            ? null
            : this.fontLibrary?.onChange?.(() => {
                if (this._suppressLibrarySync) {
                    this._suppressLibrarySync = false;
                    if (this._ready) this._emit();
                    return;
                }
                this._legacySeeded = false;
                this._seedCachedLegacy();
                if (this._ready) this._emit();
            });
        this.ready = options.autoInit === false ? Promise.resolve(this.getOrganization()) : this.initialize();
    }

    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit() {
        const snapshot = this.getOrganization();
        this._listeners.forEach(listener => {
            try { listener(snapshot); } catch (error) { /* listenerの失敗でモデルを壊さない */ }
        });
    }

    _readStored() {
        let raw = null;
        try { raw = this.storage?.getItem?.(this.storageKey); } catch (error) { raw = null; }
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? normalizeOrganization(parsed) : null;
        } catch (error) {
            return null;
        }
    }

    _persist() {
        try { this.storage?.setItem?.(this.storageKey, JSON.stringify(this._model)); } catch (error) { /* 設定保存不能でも表示を止めない */ }
    }

    _seedCachedLegacy() {
        if (this._legacySeeded) return;
        const folders = this.fontLibrary?.getCachedFolders?.() || [];
        const fonts = this.fontLibrary?.getCachedFonts?.() || [];
        if (!folders.length && !fonts.length) return;
        this._model = mergeLegacySeed(this._model, folders, fonts);
        this._legacySeeded = true;
    }

    _ensureFontIds(fontIds = []) {
        const ids = [...new Set((Array.isArray(fontIds) ? fontIds : []).map(cleanId).filter(Boolean))];
        let changed = false;
        for (const id of ids) {
            if (!(id in this._model.placements)) {
                this._model.placements[id] = null;
                appendUnique(this._model, ORGANIZATION_ROOT, fontNode(id));
                changed = true;
            }
        }
        if (changed) this._model = normalizeOrganization(this._model);
        return changed;
    }

    /** catalog、旧IDB種、localStorageを一度だけ非同期で統合する。失敗源は独立して吸収する。 */
    async initialize(fontIds = []) {
        const ids = [...new Set([
            ...this._requestedFontIds,
            ...(Array.isArray(fontIds) ? fontIds : [])
        ])];
        if (this._initPromise) {
            await this._initPromise;
            this._ensureFontIds(ids);
            return this.getOrganization(ids);
        }
        this._initPromise = (async () => {
            let catalog = null;
            try { catalog = await this.catalogProvider?.(); } catch (error) { catalog = null; }
            const [folderResult, fontResult] = await Promise.allSettled([
                Promise.resolve().then(() => this.fontLibrary?.listFolders?.() || []),
                Promise.resolve().then(() => this.fontLibrary?.listFonts?.() || [])
            ]);
            const legacyFolders = folderResult.status === 'fulfilled' ? folderResult.value : [];
            const legacyFonts = fontResult.status === 'fulfilled' ? fontResult.value : [];
            const stored = this._readStored();
            let base = stored || normalizeOrganization(catalog?.organization, []);
            base = mergeLegacySeed(base, legacyFolders, legacyFonts, { overrideNull: !stored });
            this._model = normalizeOrganization(base, ids);
            this._legacySeeded = true;
            this._ready = true;
            this._emit();
            return this.getOrganization(ids);
        })();
        this.ready = this._initPromise;
        await this._initPromise;
        return this.getOrganization(ids);
    }

    /** UIから呼ぶ同期snapshot。未初期化中も旧cacheと渡されたIDを反映する。 */
    getOrganization(fontIds = []) {
        for (const id of Array.isArray(fontIds) ? fontIds : []) {
            const cleanFontId = cleanId(id);
            if (cleanFontId) this._requestedFontIds.add(cleanFontId);
        }
        this._seedCachedLegacy();
        this._ensureFontIds(fontIds);
        return clone(this._model);
    }

    _commit(model) {
        this._model = normalizeOrganization(model);
        this._persist();
        // FontLibraryを使うbridgeでは、その既存onChangeを一度だけ通してmodel listenerへ通知する。
        // library側のonChange購読が_emitするため、ここで直接_emitすると二重通知になる。
        if (this._notifyLibrary) {
            this._suppressLibrarySync = true;
            try { this._notifyLibrary(); }
            finally {
                // 通知先が同期library emitterでなくても、次の外部変更を抑止しない。
                this._suppressLibrarySync = false;
            }
        } else this._emit();
        return true;
    }

    setFontFolder(id, folderId) {
        const fontId = cleanId(id);
        if (!fontId) return false;
        const nextFolder = folderId == null || folderId === '' ? null : cleanId(folderId);
        if (folderId != null && folderId !== '' && !nextFolder) return false;
        if (nextFolder && !folderById(this._model, nextFolder)) return false;
        this._ensureFontIds([fontId]);
        const next = clone(this._model);
        removeNode(next, fontNode(fontId));
        next.placements[fontId] = nextFolder;
        appendUnique(next, parentKey(nextFolder), fontNode(fontId));
        return this._commit(next);
    }

    createOrganizationFolder(label, parentId = null) {
        const parent = parentId == null || parentId === '' ? null : cleanId(parentId);
        if (parentId != null && parentId !== '' && !parent) return null;
        if (parent && !folderById(this._model, parent)) return null;
        let id = '';
        do {
            this._folderCounter += 1;
            id = `orgf_${Date.now().toString(36)}_${this._folderCounter.toString(36)}`;
        } while (folderById(this._model, id));
        const folder = { id, label: cleanLabel(label), parentId: parent };
        const next = clone(this._model);
        next.folders.push(folder);
        next.orders[folderNode(id)] = [];
        appendUnique(next, parentKey(parent), folderNode(id));
        this._commit(next);
        return clone(folder);
    }

    renameOrganizationFolder(id, label) {
        const folderId = cleanId(id);
        const folder = folderById(this._model, folderId);
        if (!folder) return false;
        const next = clone(this._model);
        const target = next.folders.find(item => item.id === folderId);
        target.label = cleanLabel(label, target.label);
        return this._commit(next);
    }

    deleteOrganizationFolder(id) {
        const folderId = cleanId(id);
        const folder = folderById(this._model, folderId);
        if (!folder) return false;
        const next = clone(this._model);
        const targetParent = folder.parentId || null;
        const oldNodes = (next.orders[folderNode(folderId)] || []).filter(node => node !== folderNode(folderId));
        const parentNodes = next.orders[parentKey(targetParent)] || [];
        const index = parentNodes.indexOf(folderNode(folderId));
        next.orders[parentKey(targetParent)] = parentNodes.filter(node => node !== folderNode(folderId));
        for (const child of next.folders) if (child.parentId === folderId) child.parentId = targetParent;
        for (const [fontId, placement] of Object.entries(next.placements)) {
            if (placement === folderId) next.placements[fontId] = targetParent;
        }
        next.folders = next.folders.filter(item => item.id !== folderId);
        delete next.orders[folderNode(folderId)];
        const destination = next.orders[parentKey(targetParent)];
        const insertAt = index < 0 ? destination.length : index;
        destination.splice(insertAt, 0, ...oldNodes.filter((node, offset) => oldNodes.indexOf(node) === offset));
        return this._commit(next);
    }

    _isDescendant(folderId, candidateParent) {
        let current = candidateParent;
        const seen = new Set();
        while (current) {
            if (current === folderId) return true;
            if (seen.has(current)) return true;
            seen.add(current);
            current = folderById(this._model, current)?.parentId || null;
        }
        return false;
    }

    moveOrganizationNode(nodeKey, parentId = null, beforeKey = null) {
        const parsed = parseNode(nodeKey);
        if (!parsed) return false;
        const parent = parentId == null || parentId === '' ? null : cleanId(parentId);
        if (parentId != null && parentId !== '' && (!parent || !folderById(this._model, parent))) return false;
        if (parsed.kind === 'folder' && !folderById(this._model, parsed.id)) return false;
        if (parsed.kind === 'font' && !(parsed.id in this._model.placements)) return false;
        if (parsed.kind === 'folder' && this._isDescendant(parsed.id, parent)) return false;
        const node = parsed.kind === 'folder' ? folderNode(parsed.id) : fontNode(parsed.id);
        const before = beforeKey == null || beforeKey === '' ? null : String(beforeKey);
        const target = parentKey(parent);
        const targetNodes = this._model.orders[target] || [];
        if (before && (!parseNode(before) || !targetNodes.includes(before) || before === node)) return false;
        const next = clone(this._model);
        removeNode(next, node);
        if (parsed.kind === 'folder') next.folders.find(folder => folder.id === parsed.id).parentId = parent;
        else next.placements[parsed.id] = parent;
        next.orders[target] ||= [];
        const index = before ? next.orders[target].indexOf(before) : next.orders[target].length;
        next.orders[target].splice(index < 0 ? next.orders[target].length : index, 0, node);
        return this._commit(next);
    }

    setFavoriteFirst(value) {
        const nextValue = value === true;
        if (this._model.favoriteFirst === nextValue) return true;
        const next = clone(this._model);
        next.favoriteFirst = nextValue;
        return this._commit(next);
    }
}

// FontLibraryからのdynamic import時に別modelを作るため、module singletonは自動初期化・library購読をしない。
export const fontOrganization = new FontOrganization({ autoInit: false, listenLibrary: false });
export const organizationReady = fontOrganization.ready;
export const initializeFontOrganization = (...args) => fontOrganization.initialize(...args);
export const getOrganization = (...args) => fontOrganization.getOrganization(...args);
export const setFontFolder = (...args) => fontOrganization.setFontFolder(...args);
export const createOrganizationFolder = (...args) => fontOrganization.createOrganizationFolder(...args);
export const renameOrganizationFolder = (...args) => fontOrganization.renameOrganizationFolder(...args);
export const deleteOrganizationFolder = (...args) => fontOrganization.deleteOrganizationFolder(...args);
export const moveOrganizationNode = (...args) => fontOrganization.moveOrganizationNode(...args);
export const setFavoriteFirst = (...args) => fontOrganization.setFavoriteFirst(...args);
