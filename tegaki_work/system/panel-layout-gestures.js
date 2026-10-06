/** ROLE: Pure Canvas stroke-to-existing-split adapter, free-quad transforms and neighbor/gutter snapping.
 * AUTHORITY: panel-layout.js retains tree normalization/resolution; no new schema.
 * LIMIT: Opposite-edge cuts only; reject unsupported gestures rather than silently alter the line.
 */
import { findNode, PANEL_LAYOUT_LIMITS } from './panel-layout.js';
const cross = (a,b) => a.x*b.y-a.y*b.x;
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
const lerp = (a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function edgeParameter(start,end,a,b) {
    const d=sub(end,start),e=sub(b,a),den=cross(d,e);
    if(Math.abs(den)<1e-8)return null;
    const t=cross(sub(a,start),d)/den;
    return t>=.02&&t<=.98?t:null;
}
export function panelSplitFromStroke(quad,start,end,{snap=false,minLength=8}={}) {
    if(!Array.isArray(quad)||quad.length!==4||![...quad,start,end].every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)))return {ok:false,reason:'分割位置が不正です'};
    if(Math.hypot(end.x-start.x,end.y-start.y)<minLength)return {ok:false,reason:'線をもう少し長くドラッグしてください'};
    const horizontal=Math.abs(end.x-start.x)>=Math.abs(end.y-start.y),dir=horizontal?'h':'v';
    const center={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
    if(snap) { start=horizontal?{x:start.x,y:center.y}:{x:center.x,y:start.y}; end=horizontal?{x:end.x,y:center.y}:{x:center.x,y:end.y}; }
    const [tl,tr,br,bl]=quad,edges=horizontal?[[tl,bl],[tr,br]]:[[tl,tr],[bl,br]];
    const t0=edgeParameter(start,end,...edges[0]),t1=edgeParameter(start,end,...edges[1]);
    if(t0===null||t1===null)return {ok:false,reason:'向かい合う辺を横切る線で分割してください'};
    const ratio=(t0+t1)/2,slant=t0-t1,L=PANEL_LAYOUT_LIMITS;
    if(ratio<L.ratio.min||ratio>L.ratio.max||Math.abs(slant)>L.slant.max)return {ok:false,reason:'傾きが大きすぎます。対辺の中ほどを横切ってください'};
    return {ok:true,dir,ratio,slant,cut:[lerp(...edges[0],t0),lerp(...edges[1],t1)]};
}
export function transformFreePanel(root,id,{scale=1,rotation=0}={}) {
    const node=findNode(root,id);
    if(!node?.free||!node.quad||!Number.isFinite(scale)||scale<=0||!Number.isFinite(rotation))return root;
    const center=node.quad.reduce((c,p)=>({x:c.x+p.x/4,y:c.y+p.y/4}),{x:0,y:0}),cos=Math.cos(rotation),sin=Math.sin(rotation);
    const quad=node.quad.map(p=>{const x=(p.x-center.x)*scale,y=(p.y-center.y)*scale;return {x:center.x+x*cos-y*sin,y:center.y+x*sin+y*cos};});
    if(quad.some((p,i)=>Math.hypot(p.x-quad[(i+1)%4].x,p.y-quad[(i+1)%4].y)<8))return root;
    if(quad.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>20000||Math.abs(p.y)>20000))return root;
    const walk=n=>n.id===id?{...n,quad}:n.kind==='split'?{...n,a:walk(n.a),b:walk(n.b)}:n;
    return walk(root);
}

/** Neighbor edge extensions and their outward default gutter; distance is in Canvas units. */
export function snapFreePanelPoint(resolved, id, point, { tolerance = 6, gapV = 12, gapH = 20 } = {}) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || !(tolerance > 0)) return { point, guides: [] };
    const lines = [];
    for (const panel of resolved?.panels || []) {
        if (panel.id === id || panel.deleted) continue;
        const center = panel.quad.reduce((c, p) => ({ x: c.x + p.x / 4, y: c.y + p.y / 4 }), { x: 0, y: 0 });
        panel.quad.forEach((a, i) => {
            const b = panel.quad[(i + 1) % 4], length = Math.hypot(b.x - a.x, b.y - a.y);
            if (length < 1e-6) return;
            const unit = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
            let normal = { x: -unit.y, y: unit.x };
            if ((center.x - a.x) * normal.x + (center.y - a.y) * normal.y > 0) normal = { x: -normal.x, y: -normal.y };
            const gap = Math.max(0, Math.abs(unit.y) > Math.abs(unit.x) ? gapV : gapH);
            for (const offset of gap > 0 ? [0, gap] : [0]) {
                const origin = { x: a.x + normal.x * offset, y: a.y + normal.y * offset };
                const distance = (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y;
                if (Math.abs(distance) <= tolerance) lines.push({ origin, unit, length, normal, distance });
            }
        });
    }
    if (!lines.length) return { point, guides: [] };
    lines.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
    const first = lines[0];
    let snapped = { x: point.x - first.normal.x * first.distance, y: point.y - first.normal.y * first.distance };
    const used = [first];
    // Two intersecting guides can align both axes, but may not pull farther than the hit tolerance.
    for (const other of lines.slice(1)) {
        const denominator = cross(first.unit, other.unit);
        if (Math.abs(denominator) < .25) continue;
        const t = cross(sub(other.origin, first.origin), other.unit) / denominator;
        const intersection = { x: first.origin.x + first.unit.x * t, y: first.origin.y + first.unit.y * t };
        if (Math.hypot(intersection.x - point.x, intersection.y - point.y) <= tolerance) {
            snapped = intersection; used.push(other); break;
        }
    }
    const guides = used.map(line => {
        const along = (snapped.x - line.origin.x) * line.unit.x + (snapped.y - line.origin.y) * line.unit.y;
        const at = t => ({ x: line.origin.x + line.unit.x * t, y: line.origin.y + line.unit.y * t });
        return [at(Math.min(0, along) - tolerance * 3), at(Math.max(line.length, along) + tolerance * 3)];
    });
    return { point: snapped, guides };
}

/** Translate the whole quad with one correction, preserving all four edges. */
export function snapFreePanelMove(resolved, id, quad, delta, options) {
    let correction = { x: 0, y: 0 }, guides = [], best = Infinity;
    for (const corner of quad) {
        const point = { x: corner.x + delta.x, y: corner.y + delta.y };
        const result = snapFreePanelPoint(resolved, id, point, options);
        if (!result.guides.length) continue;
        const distance = Math.hypot(result.point.x - point.x, result.point.y - point.y);
        if (result.guides.length > guides.length || (result.guides.length === guides.length && distance < best)) {
            best = distance; correction = sub(result.point, point); guides = result.guides;
        }
    }
    return { delta: { x: delta.x + correction.x, y: delta.y + correction.y }, guides };
}
