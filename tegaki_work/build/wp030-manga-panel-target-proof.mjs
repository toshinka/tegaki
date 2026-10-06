/** Isolated normal Canvas proof. Existing product controls, History and Project APIs. */
import { buildPresetById } from '../system/panel-layout.js';
import { defaultBalloonParams } from '../system/balloon-geometry.js';
import { revealLetteringSourcesForCapture } from '../system/lettering-preview-display.js';
const host=window.parent.document,core=window.coreEngine,ls=core.layerSystem,pm=core.popupManager,h=core.history;
const out=host.querySelector('#output'),state=host.querySelector('#state'),id=l=>l.layerData.id;
const check=(ok,label)=>{if(!ok)throw Error(label);out.textContent+='PASS '+label+'\n';};
const eq=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const png=()=>{const c=core.exportManager.renderToCanvas({transparent:true});return [...c.getContext('2d').getImageData(0,0,c.width,c.height).data];};
const choose=(tool,folderId)=>{const select=tool.panelTarget.select;tool.panelTarget.sync();select.value=folderId;select.dispatchEvent(new Event('change',{bubbles:true}));};
async function blank(){pm.hideAll();await core.projectManager.loadProject({version:2,app:'tegaki',canvas:{width:400,height:400},background:{color:0xf0e0d6},layers:[],animation:null,animationState:null});}
async function panelScene(){
 await blank();pm.show('panelLayout');const p=pm.get('panelLayout');p.tree=buildPresetById('single');p.outputMode='paper';p.params={...p.params,margin:40,lineWidth:4};p._changed();const before=h.index,result=p.apply();
 const layers=ls.getLayers(),folder=layers.find(l=>l.layerData.panelLayout?.groupId===result.groupId&&l.layerData.panelLayout.role==='folder'),paper=layers.find(l=>l.layerData.panelLayout?.groupId===result.groupId&&l.layerData.panelLayout.role==='paper'),inner=layers.find(l=>l.layerData.panelLayout?.groupId===result.groupId&&l.layerData.panelLayout.role==='inner'),content=layers.find(l=>l.layerData.isFolder&&l.layerData.parentId===id(folder));
 p.hide();return {p,result,before,folder,paper,inner,content};
}
async function addBalloon(folder){
 pm.show('balloon');const b=pm.get('balloon');b.editing=null;b._setParams({...defaultBalloonParams({width:400,height:400}),rect:{x:210,y:90,w:190,h:160},lineWidth:6,text:{...b.params.text,content:''},tail:{...b.params.tail,enabled:true,tip:{x:180,y:280}}});choose(b,id(folder));
 const before=h.index,result=await b.apply();b.hide();return {b,before,result,layer:ls.getLayers().find(l=>id(l)===result.layerId)};
}
async function inspected(){const s=await panelScene(),a=await addBalloon(s.folder);ls.setActiveLayer(ls.getLayerIndex(a.layer));pm.show('balloon');a.b.loadFromActiveLayer();a.b._setParams({...a.b.params,rect:{x:160,y:125,w:160,h:130},tail:{...a.b.params.tail,tip:{x:130,y:290}}});a.b.overlay.render();return {...s,...a};}
host.querySelector('#inspect').onclick=inspected;
host.querySelector('#run').onclick=async()=>{out.textContent='';state.textContent='検証中';try{
 const s=await panelScene();check(s.result.ok&&h.index===s.before+1,'白コマ・内容Folder・内描画・枠を一Historyで生成');check(s.content&&s.inner.layerData.parentId===id(s.content)&&s.content.layerData.clippingMode==='normal','内容Folderが白へclip・内描画はその中');check(ls._resolveClippingSourceLayers(s.content)[0]===s.paper,'内容Folderのclip元は白');
 h.undo();check(!ls.getLayers().some(l=>id(l)===id(s.folder)),'コマ生成Undo');h.redo();check(ls.getLayers().includes(s.content)&&s.inner.layerData.parentId===id(s.content),'コマ生成Redoで内容構造を復元');
 const a=await addBalloon(s.folder);check(a.result.ok&&h.index===a.before+1,'吹き出し生成とコマ収納は一History');check(a.layer.layerData.parentId===id(s.content),'選んだコマの内容Folderへ吹き出し');check(a.layer.layerData.clippingMode==='none','素材は内容Folderのclipを継承');const visible=png();check(visible[(120*400+380)*4]===240,'コマ外の吹き出しはclipされる');
 h.undo();check(!ls.getLayers().includes(a.layer),'素材追加Undoは対象素材だけ除去');h.redo();check(ls.getLayers().includes(a.layer)&&a.layer.layerData.parentId===id(s.content),'素材追加Redoで収納を復元');
 pm.show('lettering');const l=pm.get('lettering');l.newSession();l._setParams({...l.params,text:'右\n左',fontSize:24,vertical:true,baseline:{kind:'none'},placement:{...l.params.placement,x:265,y:150}});l.panelTarget.sync();check(l.panelTarget.select.value===id(s.folder),'文字tabは共通配置先を引き継ぐ');let before=h.index;const textResult=await l.apply(),text=ls.getLayers().find(x=>id(x)===textResult.layerId);check(textResult.ok&&h.index===before+1&&text.layerData.parentId===id(s.content),'文字も同じ選択先へ一Historyで収納');l.overlay.render();check(!l.overlay.svg.querySelector('.lettering-overlay__glyph')&&!l.overlay.svg.querySelector('.lettering-overlay__content svg')&&l.overlay.svg.querySelector('.lettering-overlay__handle'),'文字確定後は二重表示を止め・Guide保持');l.hide();
 pm.show('focusLines');const f=pm.get('focusLines');f.popup.querySelector('[data-preset="uni"]').click();f.panelTarget.sync();check(f.panelTarget.select.value===id(s.folder),'集中線tabも共通配置先を引き継ぐ');before=h.index;const fxResult=f.apply(),fx=ls.getLayers().find(x=>id(x)===fxResult.layerId);check(fxResult.ok&&h.index===before+1&&fx.layerData.parentId===id(s.content),'集中線も同じ選択先へ一Historyで収納');f.hide();check(ls.getLayerIndex(text)>ls.getLayerIndex(a.layer)&&ls.getLayerIndex(a.layer)>ls.getLayerIndex(fx)&&ls.getLayerIndex(fx)>ls.getLayerIndex(s.inner),'文字→吹き出し→効果→内描画の描画順');
 const committed=png(),project=await core.projectManager.exportProject(),recipe=JSON.stringify(a.layer.layerData.balloon),hist=h.index;ls.setActiveLayer(ls.getLayerIndex(a.layer));pm.show('balloon');a.b.loadFromActiveLayer();a.b._setParams({...a.b.params,rect:{...a.b.params.rect,x:145}});check(a.layer.layerData.layerSprite.renderable&&a.layer.layerData.layerSprite.alpha===.2,'吹き出し再編集元は20% ghost');check(h.index===hist&&JSON.stringify(a.layer.layerData.balloon)===recipe,'ghostはrecipe・History不変');check(eq(png(),committed),'ghost編集中のPNGは確定画素');check(a.layer.layerData.layerSprite.alpha===.2,'PNG採取後はghostへ復帰');const ghostProject=await core.projectManager.exportProject();check(ghostProject.layers.find(x=>x.id===id(a.layer)).imageData===project.layers.find(x=>x.id===id(a.layer)).imageData,'ghostがProjectへ混入しない');a.b.hide();check(a.layer.layerData.layerSprite.alpha===1,'閉じると元の表示を復帰');
 pm.show('balloon');a.b.loadFromActiveLayer();check((await a.b.update()).ok&&a.layer.layerData.layerSprite.alpha===1,'吹き出し更新でghost解除');a.b.overlay.render();check(!a.b.overlay.svg.querySelector('.bl-ov-line')&&a.b.overlay.svg.querySelector('.bl-ov-handle'),'吹き出し確定後は形の二重表示を止め・Guide保持');a.b.hide();h.undo();check(eq(png(),committed),'ghost更新Undoの確定画素一致');h.redo();
 const panelCanonical=png();ls.setActiveLayer(ls.getLayerIndex(s.paper));pm.show('panelLayout');s.p.loadFromActiveLayer();check(s.paper.layerData.layerSprite.alpha===.2&&ls.getLayers().filter(x=>x.layerData.panelLayout?.role==='lines').every(x=>x.layerData.layerSprite.alpha===.2),'コマ再編集の元白・枠もghost');check(s.inner.layerData.layerSprite.alpha===1&&a.layer.layerData.layerSprite.alpha===1,'コマ再編集で内容の絵は薄くしない');check(eq(png(),panelCanonical),'白と枠のghostがPNGへ混入しない');s.p.hide();check(s.paper.layerData.layerSprite.alpha===1,'コマを閉じると元表示復帰');
 const letteringCanonical=png();ls.setActiveLayer(ls.getLayerIndex(text));pm.show('lettering');await l.loadFromActiveLayer();await l._flushCurrent();l.overlay.render();check(text.layerData.layerSprite.alpha===.2,'文字再編集もghost');check(eq(png(),letteringCanonical),'文字ghostがPNGへ混入しない');h.undo();l.overlay.render();check(text.layerData.layerSprite.alpha===1,'文字再編集中Undoで元表示を復帰');h.redo();await l.cancel();check(text.layerData.layerSprite.alpha===1,'文字取消で元表示');l.hide();
 ls.setActiveLayer(ls.getLayerIndex(fx));pm.show('focusLines');f.loadFromActiveLayer();check(fx.layerData.layerSprite.alpha===.2,'集中線再編集もghost');f.hide();check(fx.layerData.layerSprite.alpha===1,'集中線を閉じると元表示');
 const saved=await core.projectManager.exportProject();await core.projectManager.loadProject(saved);const restored=ls.getLayers(),restoredContent=restored.find(x=>id(x)===id(s.content));check(restoredContent?.layerData.clippingMode==='normal'&&restored.find(x=>id(x)===id(text)).layerData.parentId===id(restoredContent),'配置とFolder clipのProject往復');
 pm.show('balloon');const b=pm.get('balloon');b.editing=null;choose(b,'');const canvasAdded=await b.apply(),canvasLayer=ls.getLayers().find(x=>id(x)===canvasAdded.layerId);check(canvasAdded.ok&&!canvasLayer.layerData.parentId,'Canvasを選ぶと従来の通常追加');b.hide();
 // Old generated panel with existing art: no content Folder until addition.
 await blank();const p=pm.get('panelLayout');pm.show('panelLayout');p.tree=buildPresetById('single');p._changed();
 const resolved=p.resolved,gid='legacy-test',panel=resolved.panels[0];
 const paper=p._createLayer(p._panelRaster('paper',panel.id,resolved),'旧コマ 白','paper',gid,panel.id).layer;
 const art=p._createLayer({width:1,height:1,pixels:new Uint8ClampedArray([128,0,0,255]),rasterBounds:{x:100,y:100,width:1,height:1}},'旧内描画','inner',gid,panel.id).layer;
 const outer=ls.createFolder('旧コマ').layer;outer.layerData.panelLayout=p._layoutMeta('folder',gid,panel.id);
 ls.moveLayerIntoFolder(id(paper),id(outer));ls.moveLayerIntoFolder(id(art),id(outer));ls.setLayerClippingMode(ls.getLayerIndex(art),'normal');p.hide();
 const artPixels=ls.createLayerRasterSnapshot(art).pixels,old=await addBalloon(outer),oldContent=ls.getLayers().find(x=>x.layerData.isFolder&&x.layerData.parentId===id(outer));
 check(old.result.ok&&old.layer.layerData.parentId===id(oldContent)&&h.index===old.before+1,'旧コマは素材追加時だけ内容Folderを生成・一History');
 check(art.layerData.parentId===id(oldContent)&&art.layerData.clippingMode==='none'&&eq(ls.createLayerRasterSnapshot(art).pixels,artPixels),'旧内描画は画素不変でFolder clipを継承');
 check(ls.getLayerIndex(old.layer)>ls.getLayerIndex(art),'旧内描画より上へ吹き出し');
 h.undo();check(!ls.getLayers().includes(oldContent)&&ls.getLayers().includes(outer)&&art.layerData.parentId===id(outer)&&art.layerData.clippingMode==='normal','旧コマ追加Undoは旧階層とclipも復元');
 h.redo();check(ls.getLayers().includes(oldContent)&&art.layerData.parentId===id(oldContent),'旧コマ追加Redo');
 const again=await addBalloon(outer);check(again.layer.layerData.parentId===id(oldContent)&&ls.getLayers().filter(x=>x.layerData.isFolder&&x.layerData.parentId===id(outer)).length===1,'既存clipped Folderを再利用・増殖なし');
 // A manually named, clipped Folder is reused, including nested text ordering.
 oldContent.layerData.name='手動内容';const nestedText=ls.createFolder('文字Folder').layer;
 ls.moveLayerIntoFolder(id(nestedText),id(oldContent));ls.moveLayerIntoFolder(id(old.layer),id(nestedText));
 old.layer.layerData.lettering={version:1,params:{text:'fixture'}};
 const manual=await addBalloon(outer);check(manual.layer.layerData.parentId===id(oldContent)&&ls.getLayerIndex(manual.layer)<ls.getLayerIndex(old.layer),'手動Folder再利用・入れ子文字より下へ吹き出し');
 // Re-edit Undo and reset must release ghost even while the panel stays open.
 ls.setActiveLayer(ls.getLayerIndex(manual.layer));pm.show('balloon');b.loadFromActiveLayer();h.undo();b.overlay.render();check(manual.layer.layerData.layerSprite.alpha===1,'再編集中Undoで元表示を復帰');h.redo();b.loadFromActiveLayer();b._onAction('reset');check(manual.layer.layerData.layerSprite.alpha===1,'初期化で元表示を復帰');b.hide();
 // Resolve the destination before asynchronous lettering preview/render.
 pm.show('lettering');l.newSession();l._setParams({...l.params,text:'切替確認',fontSize:20});choose(l,id(outer));
 const flush=l._flushCurrent.bind(l);let release;l._flushCurrent=()=>new Promise(resolve=>{release=()=>resolve(true);});
 const asyncCount=ls.getLayers().length,asyncHistory=h.index,pending=l.apply();choose(l,'');release();
 const stale=await pending;l._flushCurrent=flush;check(!stale.ok&&ls.getLayers().length===asyncCount&&h.index===asyncHistory,'文字preview待ちの配置先切替は変更なしで拒否');l.hide();
 pm.show('balloon');choose(b,id(outer));const token=b.panelTarget.token(),count=ls.getLayers().length,index=h.index;choose(b,'');const rejected=b.panelTarget.create({width:1,height:1,pixels:new Uint8ClampedArray([128,0,0,255])},{name:'stale',historyName:'fixture'},'balloon',token);check(!rejected.ok&&ls.getLayers().length===count&&h.index===index,'配置先切替tokenは変更なしで拒否');b.hide();
 // Test same capture registry while folder compositor performs nested source captures.
 const beforeGhost=png();ls.setActiveLayer(ls.getLayerIndex(again.layer));pm.show('balloon');b.loadFromActiveLayer();const resume=revealLetteringSourcesForCapture();const nested=revealLetteringSourcesForCapture();nested();check(again.layer.layerData.layerSprite.alpha===1,'入れ子採取中も確定alpha');resume();check(again.layer.layerData.layerSprite.alpha===.2&&eq(png(),beforeGhost),'採取の終了後にghost復帰・PNG不変');b.hide();
 state.textContent='PASS';
 }catch(error){state.textContent='FAIL '+error.message;out.textContent+='FAIL '+error.stack;}};
host.querySelector('#run').disabled=false;host.querySelector('#inspect').disabled=false;state.textContent='READY';
