/** Model/backend capability contract. Pixel agreement is in wp030-paragraph-browser.html. */
import assert from 'node:assert/strict';
import { paragraphRequest, measureParagraph, rasterizeParagraph } from '../system/lettering-paragraph.js';
const params={text:'「あ゙」\nABC',fontSize:40,tracking:2,vertical:true,strokeWidth:3},before=JSON.stringify(params);
const result=paragraphRequest(params,{boxHeight:120,align:'end'});assert(result.ok);assert.equal(result.request.text,params.text);assert.equal(result.request.letterSpacing,.05);assert.equal(result.request.boxHeight,120);assert.equal(result.request.outlineWidth,3);assert.equal(result.request.align,'end');assert.equal(JSON.stringify(params),before);
for(const extra of [{characterStyles:[{start:0,end:1}]},{sizeProfile:{start:1,middle:2,end:1}},{outerStrokeWidth:2},{baseline:{kind:'curve'}},{envelope:{kind:'bulge'}}]) {
 const request={...params,...extra};assert(!paragraphRequest(request).ok);assert(!(await measureParagraph(request)).ok);assert(!(await rasterizeParagraph(request)).ok);
}
assert(!paragraphRequest({text:' '}).ok);assert(!paragraphRequest({text:'あ'.repeat(2001)}).ok);assert(paragraphRequest({...params,strokeWidth:0,baseline:{kind:'none'},envelope:{kind:'none'},characterStyles:[]}).ok);
console.log('PASS paragraph model preservation / layout / unsupported fail-closed');
