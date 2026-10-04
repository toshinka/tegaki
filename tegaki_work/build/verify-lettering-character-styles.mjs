import assert from 'node:assert/strict';
import { segmentLetteringText, characterStyleAt, applyCharacterStyle, remapCharacterStyles, profileScale } from '../system/lettering-character-styles.js';
import { defaultLetteringParams, normalizeLetteringParams, sanitizeLetteringData } from '../system/lettering-model.js';

const units = segmentLetteringText('A😀あ\u3099\n猫');
assert.deepEqual(units.map(unit => [unit.start, unit.end, unit.line, unit.index]), [[0,1,0,0],[1,3,0,1],[3,5,0,2],[5,6,0,3],[6,7,1,0]]);
assert.equal(units[2].text, 'あ\u3099');
let styles = applyCharacterStyle('A😀あ\u3099猫', [], 2, 4, { color: '#ff0000' });
assert.deepEqual(styles, [{ start:1, end:5, color:'#ff0000' }], 'partial selection expands whole surrogate/grapheme');
styles = applyCharacterStyle('A😀あ\u3099猫', styles, 3,5,{color:null, rotation:0.5});
assert.deepEqual(styles, [{start:1,end:3,color:'#ff0000'},{start:3,end:5,rotation:0.5}]);
assert.equal(characterStyleAt(styles, 0), null);
assert.equal(characterStyleAt(styles, 2).color, '#ff0000');
const red = [{start:1,end:3,color:'#ff0000'}];
assert.deepEqual(remapCharacterStyles('ABCD','ABXCD',red,{start:2,end:2}), [{start:1,end:4,color:'#ff0000'}], 'internal insert inherits');
assert.deepEqual(remapCharacterStyles('ABCD','AXBCD',red,{start:1,end:1}), [{start:2,end:4,color:'#ff0000'}], 'boundary insert stays default');
assert.deepEqual(remapCharacterStyles('ABCD','ABCXD',red,{start:3,end:3}), red, 'end boundary insert stays default');
assert.deepEqual(remapCharacterStyles('ABCD','AD',red,{start:1,end:3}), [], 'delete selected range');
assert.deepEqual(remapCharacterStyles('ABCD','A日CD',red,{start:1,end:2}), red, 'IME-like replacement inherits initial style');
assert.deepEqual(remapCharacterStyles('A😀B','A😺B',[{start:1,end:3,color:'#ff0000'}]), [{start:1,end:3,color:'#ff0000'}], 'surrogate replacement expands stable unit');
assert.deepEqual(remapCharacterStyles('あ\u3099猫','あ猫',[{start:0,end:2,color:'#ff0000'}]), [{start:0,end:1,color:'#ff0000'}], 'combining-mark deletion retains whole unit style');
assert.deepEqual(remapCharacterStyles('ABCD','AB日CD',red,{start:0,end:0}), [{start:1,end:4,color:'#ff0000'}], 'stale descriptor falls back to position diff');
assert.deepEqual(remapCharacterStyles('AAA','AAXA',[{start:2,end:3,color:'#ff0000'}],{start:2,end:2}), [{start:3,end:4,color:'#ff0000'}], 'repeated spelling never transfers style by search');
assert.deepEqual(applyCharacterStyle('A\nB',[],0,3,{color:'#ff0000'}), [{start:0,end:1,color:'#ff0000'},{start:2,end:3,color:'#ff0000'}]);
assert.equal(profileScale({mode:'three',start:1,mid:3,end:2},0),1);
assert.equal(profileScale({mode:'three',start:1,mid:3,end:2},0.25),2);
assert.equal(profileScale({mode:'three',start:1,mid:3,end:2},0.5),3);
assert.equal(profileScale({mode:'three',start:1,mid:3,end:2},1),2);
const fingerprint = { hash:'unit', width:1,height:1,rasterBounds:{x:0,y:0,width:1,height:1} };
const params = defaultLetteringParams(); params.text='A😀あ\u3099';
params.characterStyles=[{start:1,end:3,fontId:'alternate',color:'#123456',size:2,scaleX:-1,scaleY:1,rotation:0.25,offsetX:2,offsetY:-3,envelope:{kind:'skew',amount:0.5,points:null}}];
params.outerStrokeWidth=4; params.outerStrokeColor='#ffffff'; params.sizeProfile={mode:'three',start:1,mid:2,end:1};
const raw = {version:1,params,fingerprint};
Object.assign(params.characterStyles[0], { strokeWidth: 0, strokeColor: '#abcdef', outerStrokeWidth: 6, outerStrokeColor: '#987654' });
assert.deepEqual(sanitizeLetteringData(raw).params, normalizeLetteringParams(params));
const savedOutline = sanitizeLetteringData(raw).params.characterStyles[0];
assert.equal(savedOutline.strokeWidth,0);assert.equal(savedOutline.outerStrokeWidth,6);
assert.equal(savedOutline.strokeColor,'#abcdef');assert.equal(savedOutline.outerStrokeColor,'#987654','save retains colors as strings');
for (const mutate of [
    p=>p.outerStrokeWidth=65, p=>p.outerStrokeColor='red', p=>p.sizeProfile.mid=NaN,
    p=>p.characterStyles[0].start=2, p=>p.characterStyles[0].end=4,
    p=>p.characterStyles[0].size=9, p=>p.characterStyles[0].scaleX=0,
    p=>p.characterStyles[0].offsetX=9000, p=>p.characterStyles.push({...p.characterStyles[0]}),
    p=>p.characterStyles[0].envelope.amount=5, p=>p.characterStyles[0].cache={},
    ...['strokeWidth','outerStrokeWidth'].flatMap(key => [-1,65,NaN,'2',null].map(value => p=>p.characterStyles[0][key]=value)),
    ...['strokeColor','outerStrokeColor'].flatMap(key => ['red','#fff',null,3].map(value => p=>p.characterStyles[0][key]=value)),
    p=>p.fontKind='system', p=>p.text=null
]) { const bad=structuredClone(raw); mutate(bad.params); assert.equal(sanitizeLetteringData(bad),null,'malformed new metadata must reject'); }
const old = structuredClone(raw); for (const key of ['outerStrokeWidth','outerStrokeColor','sizeProfile','characterStyles']) delete old.params[key];
assert.ok(sanitizeLetteringData(old), 'old version-1 remains valid');
assert.deepEqual(applyCharacterStyle('AB',[],0,2,{size:100,offsetX:1e9,scaleY:0,color:'bad'}),[{start:0,end:2,size:8,scaleY:0.01,offsetX:8192}],'UI helpers return bounded sparse attributes');
const outlined = applyCharacterStyle('A😀B', [], 1, 3, { strokeWidth:0,outerStrokeWidth:64,strokeColor:'#ABCDEF' });
assert.deepEqual(outlined,[{start:1,end:3,strokeWidth:0,strokeColor:'#abcdef',outerStrokeWidth:64}],'zero is an explicit override, not missing');
assert.deepEqual(remapCharacterStyles('A😀B','AX😀B',outlined,{start:1,end:1}),[{...outlined[0],start:2,end:4}],'outline follows text insertion');
assert.deepEqual(applyCharacterStyle('A😀B',outlined,1,3,{strokeWidth:null,strokeColor:null,outerStrokeWidth:null}),[],'inheritance removes outline overrides');
console.log('verify-lettering-character-styles: UTF16/grapheme, IME/edit range remap, sparse inheritance, three-anchor profile, strict new metadata, legacy recipe OK');
