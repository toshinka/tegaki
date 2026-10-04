import assert from 'node:assert/strict';
import { BALLOON_LIMITS, createBalloonContour, defaultBalloonParams, normalizeBalloonParams, sanitizeBalloonData, secondaryBalloonRect } from '../system/balloon-geometry.js';
import { balloonTextFrame } from '../system/balloon-text-layout.js';
import { transformBalloon } from '../system/balloon-gestures.js';

const canvas = { width: 1200, height: 900 };
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);
for (const shape of ['ellipse','custom','double']) {
    const p = normalizeBalloonParams({ ...defaultBalloonParams(canvas), shape, contour:createBalloonContour(),
        double:{scale:.85,dx:0,dy:.5,content:'本文②',frame:{x:.2,y:.2,w:.5,h:.5}},
        text:{...defaultBalloonParams(canvas).text,content:'本文①',autoFit:false,fontSize:24,frame:{x:.2,y:.2,w:.5,h:.5}},
        extraTails:[{enabled:true,style:'thought',width:20,curve:.2,tip:{x:800,y:700}}] },canvas);
    const original=JSON.stringify(p),center={x:p.rect.x+p.rect.w/2,y:p.rect.y+p.rect.h/2};
    const moved=transformBalloon(p,canvas,{dx:20,dy:-15});
    near(moved.rect.x,p.rect.x+20); near(moved.rect.y,p.rect.y-15);
    near(moved.tail.tip.x,p.tail.tip.x+20); near(moved.extraTails[0].tip.y,p.extraTails[0].tip.y-15);
    near(balloonTextFrame(moved,canvas).x,balloonTextFrame(p,canvas).x+20);
    if(shape==='double')near(secondaryBalloonRect(moved).y,secondaryBalloonRect(p).y-15);
    const scaled=transformBalloon(p,canvas,{scale:1.2});
    near(scaled.rect.w,p.rect.w*1.2); near(scaled.rect.x+scaled.rect.w/2,center.x);
    near(scaled.tail.tip.x,center.x+(p.tail.tip.x-center.x)*1.2);
    near(scaled.extraTails[0].tip.y,center.y+(p.extraTails[0].tip.y-center.y)*1.2);
    assert.deepEqual(scaled.text,p.text); assert.equal(scaled.lineWidth,p.lineWidth); assert.equal(scaled.tail.width,p.tail.width);
    if(shape==='double')assert.deepEqual(scaled.double,p.double);
    assert.deepEqual(sanitizeBalloonData({v:1,params:scaled},canvas).params,scaled);
    assert.equal(JSON.stringify(p),original,'source immutable');
    assert.deepEqual(transformBalloon(p,canvas,{dx:NaN,dy:Infinity,scale:-1}),p,'invalid operation is a no-op');
    const tiny=transformBalloon(p,canvas,{scale:1e-9}),huge=transformBalloon(p,canvas,{scale:1e9});
    assert.ok(Math.min(tiny.rect.w,tiny.rect.h)>=BALLOON_LIMITS.size.min);
    assert.ok(Math.max(huge.rect.w,huge.rect.h)<=BALLOON_LIMITS.size.max);
}
const old=defaultBalloonParams(canvas);
assert.equal(Object.hasOwn(transformBalloon(old,canvas,{dx:1}), 'extraTails'),false);
assert.equal(Object.hasOwn(transformBalloon(old,canvas,{scale:1.1}).text, 'frame'),false);
console.log('balloon gestures PASS: immutable whole move/scale, all tails/relative frames, legacy keys and bounds');
