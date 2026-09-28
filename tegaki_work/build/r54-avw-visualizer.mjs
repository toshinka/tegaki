// R-56 diagnostic only. Invoked from the R-54 verifier after it solves AVW.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';
import { deformRasterSnapshotWithSkin } from '../system/animation/raster-skin-render-plan.js';
import { hash } from './verify-rig-pose-envelope-feasibility.mjs';
import { roleMetadata, summaryAtPose, overlapPixelCenters }
    from './pose-failure-attribution-diagnostic.mjs';

const outputPath=fileURLToPath(new URL('./r54-avw-visualizer.html',import.meta.url));
const near=(actual,expected,label)=>assert.ok(
    Math.abs(actual-expected)<1e-9,`${label}: ${actual} != ${expected}`);

function pixelStats(image,channel) {
    let alpha=0,marker=0,x=0,y=0;
    for(let py=0;py<image.height;py++) for(let px=0;px<image.width;px++) {
        const at=(py*image.width+px)*4;
        const a=image.pixels[at+3]/255;
        const m=a*image.pixels[at+channel]/255;
        alpha+=a;marker+=m;
        x+=(image.bounds.x+px+.5)*m;
        y+=(image.bounds.y+py+.5)*m;
    }
    return {alpha,marker,x:x/marker,y:y/marker};
}

function renderImage(p,meshResult) {
    const image=deformRasterSnapshotWithSkin(p.snapshot,meshResult);
    assert.ok(image?.pixels,'canonical rasterizer returned no pixels');
    return {width:image.width,height:image.height,bounds:image.bounds,
        rgba:Buffer.from(image.pixels).toString('base64')};
}

function htmlFor(data) {
    // The only browser work is presenting the already-rasterized RGBA buffers.
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${data.title||'R-54 BRANCH AVW · Diagnostic Visualizer'}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eee8dc;color:#352b29;font:14px/1.45 system-ui,sans-serif}
header{padding:16px 20px;background:#fffaf0;border-bottom:2px solid #800000}
h1{font-size:20px;margin:0 0 5px}p{margin:3px 0}.meta{font-family:ui-monospace,monospace;font-size:11px;overflow-wrap:anywhere}
main{padding:16px;max-width:1500px;margin:auto}.controls{margin-bottom:12px}.poses{display:grid;grid-template-columns:repeat(3,minmax(260px,1fr));gap:12px}
article{background:#fffaf0;border:1px solid #bba99c;padding:12px;min-width:0}h2{font-size:16px;margin:0 0 3px;color:#800000}
.caption{min-height:2.8em}.image{display:block;width:100%;height:auto;border:1px solid #cbbfb0;background:#fffdf8;image-rendering:pixelated}
.detail{max-width:260px;margin-top:8px}.metric{font-family:ui-monospace,monospace;font-size:12px;margin-top:8px}
label{margin-right:16px}footer{padding:10px 20px;font-size:12px;color:#5a4c45}
@media(max-width:850px){.poses{grid-template-columns:repeat(2,minmax(260px,1fr))}}
@media(max-width:570px){.poses{grid-template-columns:1fr}}
</style></head><body>
<header><h1>${data.heading||'R-54 canonical BRANCH AVW · diagnostic only'}</h1>
<p>${data.description||'One optimized Weight field. Production CPU mesh skinning and raster deformation. No project data.'}</p>
<p class="meta" id="identity"></p></header>
<main><div class="controls"><label><input id="ghost" type="checkbox"> Neutral reference ghost</label>
<label><input id="mesh" type="checkbox"> Mesh edges</label></div><section class="poses" id="poses"></section></main>
<footer>All panels share world coordinates and scale. The lower crop uses the same ${data.detail?'world':'65×65 world'} window around the Junction. Colors are the canonical BRANCH fixture markers.</footer>
<script>
const data=${JSON.stringify(data)};
const frame=data.frame,detail=${data.detail?JSON.stringify(data.detail):'{x:70,y:70,width:65,height:65}'};
const decoded=data.states.map(state=>{
  const raw=atob(state.image.rgba),bytes=new Uint8ClampedArray(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const source=document.createElement('canvas');
  source.width=state.image.width;source.height=state.image.height;
  source.getContext('2d').putImageData(new ImageData(bytes,source.width,source.height),0,0);
  return {...state,source};
});
document.getElementById('identity').textContent='fixture '+data.fixture+' · topology SHA-256 '+data.topology.fingerprint+
  ' · '+data.topology.vertices+' vertices / '+data.topology.triangles+' triangles · AVW SHA-256 '+data.avwHash${data.apwHash?"+' · APW SHA-256 '+data.apwHash":''};
const host=document.getElementById('poses');
for(const state of decoded){
  const card=document.createElement('article');
  const title=document.createElement('h2');title.textContent=state.label;card.append(title);
  const caption=document.createElement('p');caption.className='caption';caption.textContent=state.description;card.append(caption);
  const full=document.createElement('canvas');full.className='image';full.width=frame.width*2;full.height=frame.height*2;card.append(full);
  const sub=document.createElement('p');sub.textContent='Junction detail · same world crop';card.append(sub);
  const close=document.createElement('canvas');close.className='image detail';close.width=detail.width*4;close.height=detail.height*4;card.append(close);
  const metrics=document.createElement('p');metrics.className='metric';metrics.textContent=state.metric;card.append(metrics);
  state.full=full;state.close=close;host.append(card);
}
function paint(canvas,state,window,scale){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#fffdf8';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.scale(scale,scale);ctx.translate(-window.x,-window.y);
  if(document.getElementById('ghost').checked&&state.id!=='T0'){
    ctx.globalAlpha=.2;const neutral=decoded[0];
    ctx.drawImage(neutral.source,neutral.image.bounds.x,neutral.image.bounds.y);ctx.globalAlpha=1;
  }
  ctx.drawImage(state.source,state.image.bounds.x,state.image.bounds.y);
  if(document.getElementById('mesh').checked){
    ctx.strokeStyle='#800000';ctx.lineWidth=.5;
    for(const tri of data.triangles){
      const v=tri.map(i=>state.vertices[i]);ctx.beginPath();ctx.moveTo(v[0].x,v[0].y);
      ctx.lineTo(v[1].x,v[1].y);ctx.lineTo(v[2].x,v[2].y);ctx.closePath();ctx.stroke();
    }
  }
  ctx.restore();
}
function draw(){for(const state of decoded){paint(state.full,state,frame,2);paint(state.close,state,detail,4)}}
document.getElementById('ghost').addEventListener('change',draw);
document.getElementById('mesh').addEventListener('change',draw);
draw();
</script></body></html>`;
}

export function writeCanonicalAvwVisualizer(p,skin,expected) {
    assert.equal(p.fixture.id,'branched-skeleton');
    assert.equal(hash(p),expected.fingerprint);
    assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],[61,80]);
    const asset={...p.asset,meshDefinitions:[p.mesh],skinBindings:[skin]};
    const neutral=evaluateRasterBoneSkinning(asset,null,0);
    assert.equal(neutral.ok,true);
    const bindMesh=neutral.resultByMeshId.get(p.mesh.meshId);
    const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
    const t=summaryAtPose(p,skin,metadata,'translation',60);
    const r=summaryAtPose(p,skin,metadata,'rotation',45);
    const poses=[['T60',t,expected.translation],['R45',r,expected.rotation]];
    const images=[deformRasterSnapshotWithSkin(p.snapshot,bindMesh),
        ...poses.map(([,pose])=>deformRasterSnapshotWithSkin(p.snapshot,pose.posed))];
    assert.ok(images.every(image=>image?.pixels));
    const targetChannel=p.fixture.regions.find(v=>v.id==='left').channel;
    const rightChannel=p.fixture.regions.find(v=>v.id==='right').channel;
    const bindTarget=pixelStats(images[0],targetChannel);
    const bindRight=pixelStats(images[0],rightChannel);
    const bindWhole=pixelStats(images[0],targetChannel).alpha;
    const states=[{id:'T0',label:'T0 — Neutral',description:'Bind pose / source silhouette',
        metric:'Canonical bind state',image:renderImage(p,bindMesh),
        vertices:bindMesh.vertices.map(v=>({x:v.x,y:v.y}))}];
    for(const [index,[id,pose,metric]] of poses.entries()) {
        const image=images[index+1];
        const target=pixelStats(image,targetChannel),right=pixelStats(image,rightChannel);
        near(target.marker/bindTarget.marker,metric.targetAlpha,`${id} target alpha`);
        near(target.alpha/bindWhole,metric.wholeAlpha,`${id} whole alpha`);
        near(Math.hypot(right.x-bindRight.x,right.y-bindRight.y),
            metric.remote.right,`${id} remote Right`);
        assert.equal(pose.raster.visibleInversion,metric.inversion);
        assert.equal(overlapPixelCenters(pose.posed).multiple,metric.overlap);
        states.push({id,label:id==='T60'?'T60 — +60px Translation':'R45 — 45° Rotation',
            description:id==='T60'?'Target child left, x +60px':'Target child left, +45°',
            metric:`Target α ${metric.targetAlpha.toFixed(4)} · Whole α ${metric.wholeAlpha.toFixed(4)} · Right ${metric.remote.right.toFixed(2)}px`,
            image:renderImage(p,pose.posed),
            vertices:pose.posed.vertices.map(v=>({x:v.x,y:v.y}))});
    }
    const bounds=images.map(v=>v.bounds);
    const x=Math.floor(Math.min(...bounds.map(v=>v.x)))-10;
    const y=Math.floor(Math.min(...bounds.map(v=>v.y)))-10;
    const right=Math.ceil(Math.max(...bounds.map(v=>v.x+v.width)))+10;
    const bottom=Math.ceil(Math.max(...bounds.map(v=>v.y+v.height)))+10;
    const payload={fixture:p.fixture.id,
        topology:{fingerprint:expected.fingerprint,vertices:p.mesh.vertices.length,
            triangles:p.mesh.triangles.length},
        avwHash:createHash('sha256').update(JSON.stringify(skin.vertexWeights)).digest('hex'),
        triangles:bindMesh.triangleIndices,
        roles:p.topology.diagnostic.faceRoles.map(v=>v.role),
        frame:{x,y,width:right-x,height:bottom-y},states};
    writeFileSync(outputPath,htmlFor(payload));
    console.error(`R-54 AVW diagnostic visualizer: ${outputPath}`);
    return {outputPath,payload};
}

// R-59 uses the same CPU raster buffers and browser presentation as R-56.
export function writeCanonicalWeightComparison(p,avwSkin,apwSkin,expected) {
    assert.equal(p.fixture.id,'branched-skeleton');
    assert.equal(hash(p),expected.fingerprint);
    assert.deepEqual([p.mesh.vertices.length,p.mesh.triangles.length],[61,80]);
    const output=fileURLToPath(new URL('./r59-avw-apw-comparison.html',import.meta.url));
    const asset={...p.asset,meshDefinitions:[p.mesh],skinBindings:[avwSkin]};
    const neutral=evaluateRasterBoneSkinning(asset,null,0);
    assert.equal(neutral.ok,true);
    const bindMesh=neutral.resultByMeshId.get(p.mesh.meshId);
    const bindImage=deformRasterSnapshotWithSkin(p.snapshot,bindMesh);
    assert.ok(bindImage?.pixels);
    const targetChannel=p.fixture.regions.find(v=>v.id==='left').channel;
    const rightChannel=p.fixture.regions.find(v=>v.id==='right').channel;
    const bindTarget=pixelStats(bindImage,targetChannel);
    const bindRight=pixelStats(bindImage,rightChannel);
    const states=[{id:'T0',label:'T0 — Neutral',
        description:'Shared bind pose / source silhouette',
        metric:'Canonical bind state',image:renderImage(p,bindMesh),
        vertices:bindMesh.vertices.map(v=>({x:v.x,y:v.y}))}];
    const bounds=[bindImage.bounds];
    for(const [name,skin] of [['AVW',avwSkin],['APW',apwSkin]]) {
        for(const [id,kind,magnitude,metric] of [
            ['T60','translation',60,expected[name.toLowerCase()].translation],
            ['R45','rotation',45,expected[name.toLowerCase()].rotation]]) {
            const pose=summaryAtPose(p,skin,roleMetadata(p.mesh,p.topology.diagnostic),
                kind,magnitude);
            const image=deformRasterSnapshotWithSkin(p.snapshot,pose.posed);
            assert.ok(image?.pixels);
            const target=pixelStats(image,targetChannel);
            const right=pixelStats(image,rightChannel);
            near(target.marker/bindTarget.marker,metric.targetAlpha,`${name} ${id} target alpha`);
            near(target.alpha/bindTarget.alpha,metric.wholeAlpha,`${name} ${id} whole alpha`);
            near(Math.hypot(right.x-bindRight.x,right.y-bindRight.y),
                metric.remoteRight,`${name} ${id} remote Right`);
            assert.equal(pose.raster.visibleInversion,metric.inversion);
            assert.equal(overlapPixelCenters(pose.posed).multiple,metric.overlap);
            const minimum=Math.min(...pose.areas.filter(v=>v.support!=='transparent-only')
                .map(v=>v.ratio));
            near(minimum,metric.minimumVisibleRatio,`${name} ${id} minimum area`);
            bounds.push(image.bounds);
            states.push({id:`${name}-${id}`,label:`${name} — ${id}`,
                description:id==='T60'?'Target left · x +60px':'Target left · +45°',
                metric:`Target α ${metric.targetAlpha.toFixed(4)} · Whole α ${metric.wholeAlpha.toFixed(4)} · Right ${metric.remoteRight.toFixed(2)}px`,
                image:renderImage(p,pose.posed),
                vertices:pose.posed.vertices.map(v=>({x:v.x,y:v.y}))});
        }
    }
    // Keep AVW and APW adjacent at each pose in the comparison grid.
    states.splice(2,2,states[3],states[2]);
    const x=Math.floor(Math.min(...bounds.map(v=>v.x)))-10;
    const y=Math.floor(Math.min(...bounds.map(v=>v.y)))-10;
    const right=Math.ceil(Math.max(...bounds.map(v=>v.x+v.width)))+10;
    const bottom=Math.ceil(Math.max(...bounds.map(v=>v.y+v.height)))+10;
    const skinHash=skin=>createHash('sha256').update(JSON.stringify(skin.vertexWeights))
        .digest('hex');
    const payload={title:'R-59 AVW vs APW · Diagnostic Comparison',
        heading:'R-59 canonical BRANCH · AVW vs APW',
        description:'Two diagnostic Weight fields. Identical world frame and CPU raster path. No project data.',
        fixture:p.fixture.id,
        topology:{fingerprint:expected.fingerprint,vertices:p.mesh.vertices.length,
            triangles:p.mesh.triangles.length},
        avwHash:skinHash(avwSkin),apwHash:skinHash(apwSkin),
        triangles:bindMesh.triangleIndices,
        frame:{x,y,width:right-x,height:bottom-y},
        detail:{x:85,y:65,width:85,height:75},states};
    writeFileSync(output,htmlFor(payload));
    return {outputPath:output,payload};
}
