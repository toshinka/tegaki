import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildFocusLines,buildFocusLinesBody,defaultFocusLinesParams,normalizeFocusLinesParams,sanitizeFocusLinesData} from '../system/focus-lines.js';
import {buildFocusFlash} from '../system/focus-flash-geometry.js';
import {resolveFocusLinesPreset} from '../system/focus-lines-presets.js';
// Golden geometry from unchanged HEAD4760db9c: neither legacy evaluator may drift.
const c={width:1700,height:2400},p={...defaultFocusLinesParams(c),seed:37,count:49};
const digest=g=>createHash('sha256').update(JSON.stringify(g)).digest('hex');
assert.equal(digest(buildFocusLines(p,c)),'3fd5efe2cfcbf44d693fd9d9b218a756418921889dba1993c9d20898b31d190f');
assert.equal(digest(buildFocusLinesBody({...p,innerRx:80,innerRy:100,outer:180,body:{kind:'ring',lineWidth:3,fillColor:'#123456',inset:.3}},c)),'fffb6445e44666de91c57b23ec3aa63bd534eb0efb9aa3d20ac0eac204dde23d');
assert.equal(Object.hasOwn(normalizeFocusLinesParams(p,c),'flash'),false);
for(const canvas of [{width:400,height:400},{width:1700,height:2400},{width:4960,height:7016}]) {
 const params=normalizeFocusLinesParams(resolveFocusLinesPreset('uni',canvas),canvas);
 assert.equal(params.count,150); assert.equal(params.flash.kind,'tapered');
 assert.equal(params.widthMax,8*Math.min(canvas.width,canvas.height)/400);
 const meta=sanitizeFocusLinesData({params},canvas),again=sanitizeFocusLinesData(JSON.parse(JSON.stringify(meta)),canvas);
 assert.deepEqual(buildFocusFlash(meta.params,canvas),buildFocusFlash(again.params,canvas));
 const g=buildFocusFlash({...params,innerRy:params.innerRx*1.5},canvas);
 const rx=g.opening[0].x-params.center.x,ry=g.opening[32].y-params.center.y;
 assert.ok(Math.abs(ry/rx-1.5)<1e-9,'safe opening keeps oval aspect');
 for(const poly of g.polygons) { const dx=poly[0].x-params.center.x,dy=poly[0].y-params.center.y,t=Math.atan2(dy,dx),openingRadius=1/Math.sqrt(Math.cos(t)**2/rx**2+Math.sin(t)**2/ry**2); assert.ok(openingRadius<Math.hypot(dx,dy),'opening stays inside every actual inner tip'); }
}
console.log('focus-lines flash integration: legacy golden geometry / v1 optional roundtrip / normalized resolution ratios / oval opening PASS');
