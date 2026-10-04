/** Pure stroke conversion/linked topology and free transforms. Browser input is separate. */
import assert from 'node:assert/strict';
import { panelSplitFromStroke, transformFreePanel } from '../system/panel-layout-gestures.js';
import { buildPresetById, resolvePanelLayout, splitPanel, findNode, toggleFreePanel, sanitizePanelLayoutData } from '../system/panel-layout.js';
const quad=[{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}],near=(a,b)=>assert(Math.abs(a-b)<1e-8);
let cut=panelSplitFromStroke(quad,{x:5,y:90},{x:195,y:120});assert(cut.ok);assert.equal(cut.dir,'h');near(cut.ratio,.35);near(cut.slant,-2/19);
const reverse=panelSplitFromStroke(quad,{x:195,y:120},{x:5,y:90});near(reverse.ratio,cut.ratio);near(reverse.slant,cut.slant);
cut=panelSplitFromStroke(quad,{x:80,y:5},{x:110,y:295});assert(cut.ok);assert.equal(cut.dir,'v');
const snap=panelSplitFromStroke(quad,{x:5,y:90},{x:195,y:120},{snap:true});assert(snap.ok);near(snap.slant,0);
for(const [start,end] of [[{x:5,y:5},{x:6,y:6}],[{x:5,y:-90},{x:195,y:-80}],[{x:NaN,y:0},{x:10,y:10}]])assert(!panelSplitFromStroke(quad,start,end).ok);
let tree=buildPresetById('grid4'),r=resolvePanelLayout(tree,{width:1000,height:1400}),id=r.panels[0].id,old=JSON.stringify(tree);
const stroke=panelSplitFromStroke(r.panels[0].quad,{x:r.panels[0].quad[0].x+10,y:r.panels[0].quad[0].y+150},{x:r.panels[0].quad[1].x-10,y:r.panels[0].quad[1].y+170});assert(stroke.ok);
const split=splitPanel(tree,id,stroke.dir,stroke.ratio,{slant:stroke.slant});assert(resolvePanelLayout(split,{width:1000,height:1400}).valid);assert.equal(JSON.stringify(tree),old);assert(sanitizePanelLayoutData({tree:split}));
assert.equal(transformFreePanel(tree,id,{scale:2}),tree);
tree=toggleFreePanel(tree,r,id);const before=findNode(tree,id).quad,changed=transformFreePanel(tree,id,{scale:1.5,rotation:.2}),after=findNode(changed,id).quad;
const center=q=>q.reduce((c,p)=>({x:c.x+p.x/4,y:c.y+p.y/4}),{x:0,y:0});near(center(before).x,center(after).x);near(center(before).y,center(after).y);
assert(sanitizePanelLayoutData({tree:changed}));assert.equal(transformFreePanel(tree,id,{scale:0}),tree);assert.equal(transformFreePanel(tree,id,{rotation:NaN}),tree);
assert.equal(transformFreePanel(tree,id,{scale:.0001}),tree);assert.deepEqual(findNode(tree,id).quad,before);
console.log('PASS panel stroke/snap/rejection/topology/free transform/immutability');
