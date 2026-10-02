/**
 * ============================================================================
 * ファイル名: system/png-text-chunk.js
 * 責務: PNGへ文字列(UTF-8)をiTXtチャンクとして埋め込む / 取り出す純粋関数（画素・他のチャンクは触らない）
 * 依存: なし（DOM / Pixi非依存）
 * 被依存: system/settings-snapshot.js, build/verify-settings-snapshot.mjs
 * 公開API: embedPngText, extractPngText, crc32
 * 実装状態: ✅実装
 *
 * iTXt: keyword\0 compressionFlag(0) compressionMethod(0) language\0 translatedKeyword\0 text(UTF-8, 非圧縮)
 * 挿入位置はIEND直前。既存の同じkeywordのiTXtは置き換える。
 * ============================================================================
 */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable = null;
export function crc32(bytes) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n += 1) {
            let c = n;
            for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[n] = c >>> 0;
        }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function isPng(bytes) {
    return bytes?.length >= 8 && SIGNATURE.every((v, i) => bytes[i] === v);
}

function readChunks(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const chunks = [];
    let pos = 8;
    while (pos + 12 <= bytes.length) {
        const length = view.getUint32(pos);
        const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
        const end = pos + 12 + length;
        if (end > bytes.length) break;
        chunks.push({ type, start: pos, end, dataStart: pos + 8, dataEnd: pos + 8 + length });
        pos = end;
        if (type === 'IEND') break;
    }
    return chunks;
}

function parseItxt(bytes, chunk) {
    const data = bytes.subarray(chunk.dataStart, chunk.dataEnd);
    const nul = data.indexOf(0);
    if (nul < 1) return null;
    const keyword = new TextDecoder('latin1').decode(data.subarray(0, nul));
    const compressed = data[nul + 1] === 1;
    if (compressed) return { keyword, text: null, compressed: true };
    let p = nul + 3; // flag, method
    const langEnd = data.indexOf(0, p);
    if (langEnd < 0) return null;
    p = langEnd + 1;
    const transEnd = data.indexOf(0, p);
    if (transEnd < 0) return null;
    return { keyword, text: new TextDecoder('utf-8').decode(data.subarray(transEnd + 1)), compressed: false };
}

/** @returns {Uint8Array} 新しいPNGバイト列 */
export function embedPngText(pngBytes, keyword, text) {
    if (!isPng(pngBytes)) throw new Error('not-a-png');
    if (!/^[\x20-\x7e]{1,79}$/.test(keyword)) throw new Error('bad-keyword');
    const enc = new TextEncoder();
    const kw = enc.encode(keyword);
    const body = enc.encode(String(text));
    const data = new Uint8Array(kw.length + 5 + body.length);
    data.set(kw, 0);
    // \0, compression flag 0, method 0, language "" \0, translated keyword "" \0
    data.set([0, 0, 0, 0, 0], kw.length);
    data.set(body, kw.length + 5);
    const chunkBytes = new Uint8Array(12 + data.length);
    const view = new DataView(chunkBytes.buffer);
    view.setUint32(0, data.length);
    chunkBytes.set(enc.encode('iTXt'), 4);
    chunkBytes.set(data, 8);
    view.setUint32(8 + data.length, crc32(chunkBytes.subarray(4, 8 + data.length)));

    const chunks = readChunks(pngBytes);
    const iend = chunks.find(c => c.type === 'IEND');
    if (!iend) throw new Error('no-iend');
    const parts = [pngBytes.subarray(0, 8)];
    for (const c of chunks) {
        if (c.type === 'IEND') break;
        if (c.type === 'iTXt') {
            const existing = parseItxt(pngBytes, c);
            if (existing?.keyword === keyword) continue; // 同じkeywordは置き換え
        }
        parts.push(pngBytes.subarray(c.start, c.end));
    }
    parts.push(chunkBytes, pngBytes.subarray(iend.start, iend.end));
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) { out.set(p, offset); offset += p.length; }
    return out;
}

/** @returns {string|null} 該当keywordのiTXt本文（無い/圧縮/壊れている場合はnull） */
export function extractPngText(pngBytes, keyword) {
    if (!isPng(pngBytes)) return null;
    for (const c of readChunks(pngBytes)) {
        if (c.type !== 'iTXt') continue;
        const item = parseItxt(pngBytes, c);
        if (item && item.keyword === keyword && item.text !== null) return item.text;
    }
    return null;
}
