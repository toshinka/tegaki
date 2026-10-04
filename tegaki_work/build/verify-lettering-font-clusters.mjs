/** Optional installed-font evidence. No OS font bytes are copied or published. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { shapeLettering } from '../system/lettering-font-engine.js';
const directory = 'C:/Windows/Fonts/';
const families = ['calibri.ttf','segoeui.ttf','seguiemj.ttf'];
if (!families.every(name => existsSync(directory+name))) {
    console.log('verify-lettering-font-clusters: SKIP installed Windows fonts unavailable (synthetic tests are independent)');
} else {
    const bytes = families.map(name=>new Uint8Array(readFileSync(directory+name)));
    const library = { async ensureLoaded(id) { return {id,data:bytes[id==='emoji'?2:id==='segoe'?1:0]}; } };
    const params = (text,fontId,characterStyles) => ({text,fontKind:'imported',fontId,fontSize:64,characterStyles});
    const ligature = await shapeLettering(params('office','calibri',[{start:1,end:4,rotation:0.5}]),{fontLibrary:library});
    assert.equal(ligature.ok,true,ligature.reason);
    assert.ok(ligature.glyphs.some(glyph=>glyph.start===1 && glyph.end===4),'ffi is one cluster spanning three graphemes');
    const split = await shapeLettering(params('office','calibri',[{start:2,end:3,fontId:'segoe'}]),{fontLibrary:library});
    assert.equal(split.ok,true,split.reason);
    assert.equal(split.glyphs.length,6,'font-run boundary reshapes the ligature');
    const combining = await shapeLettering(params('A\u0301B','segoe',[{start:0,end:2,color:'#ff0000'}]),{fontLibrary:library});
    assert.equal(combining.ok,true,combining.reason);
    assert.ok(combining.glyphs.filter(glyph=>glyph.start===0).every(glyph=>glyph.end===2),'combining mark belongs to complete grapheme');
    const emoji = await shapeLettering(params('😀😀','emoji',[{start:2,end:4,color:'#ff0000'}]),{fontLibrary:library});
    assert.equal(emoji.ok,true,emoji.reason);
    assert.deepEqual(emoji.glyphs.map(glyph=>[glyph.cluster,glyph.start,glyph.end]),[[0,0,2],[1,2,4]],'codepoint cluster converts to UTF16 ranges');
    const recolored = await shapeLettering(params('office','calibri',[{start:1,end:4,color:'#00ff00',rotation:0.1}]),{fontLibrary:library});
    assert.equal(recolored.glyphs.find(glyph=>glyph.start===1).style.color,'#00ff00','cached geometry receives current presentation attributes');
    console.log('verify-lettering-font-clusters: installed Calibri ffi/reshape, Segoe combining, emoji UTF16 offsets, cached style refresh OK');
}
