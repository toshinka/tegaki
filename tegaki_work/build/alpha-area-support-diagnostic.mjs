// R-53 diagnostic continuous source-support area. No production renderer changes.
import assert from 'node:assert/strict';

const signedArea = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const polygonArea = points => Math.abs(points.reduce((s,p,i) => {
    const q=points[(i+1)%points.length]; return s+p.x*q.y-p.y*q.x;
},0))/2;

function clipPolygon(points, axis, bound, keepGreater) {
    const out=[];
    for (let i=0;i<points.length;i++) {
        const a=points[i],b=points[(i+1)%points.length];
        const av=a[axis]-bound,bv=b[axis]-bound;
        const insideA=keepGreater ? av>=0 : av<=0;
        const insideB=keepGreater ? bv>=0 : bv<=0;
        if (insideA) out.push(a);
        if (insideA!==insideB) {
            const t=av/(av-bv);
            out.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
        }
    }
    return out;
}
function areaInPixel(triangle,x,y) {
    let poly=triangle;
    for (const [axis,bound,greater] of [
        ['x',x,true],['x',x+1,false],['y',y,true],['y',y+1,false]]) {
        if (!poly.length) break;
        poly=clipPolygon(poly,axis,bound,greater);
    }
    return poly.length>=3 ? polygonArea(poly) : 0;
}

export function sourceSupport(p) {
    const started=performance.now();
    const byId=new Map(p.mesh.vertices.map(v=>[v.vertexId,v]));
    const targetChannel=p.fixture.regions.find(r=>r.id===p.fixture.movingBoneId).channel;
    const axis=p.context.segmentById.get(p.fixture.movingBoneId);
    const dx=axis.end.x-axis.start.x,dy=axis.end.y-axis.start.y;
    const length2=dx*dx+dy*dy;
    assert.ok(length2>0);
    const rows=[];
    for (const [id,tri] of p.mesh.triangles.entries()) {
        const points=tri.map(v=>byId.get(v));
        const bind=signedArea(...points);
        assert.ok(bind>0);
        const x0=Math.max(0,Math.floor(Math.min(...points.map(v=>v.x))));
        const x1=Math.min(p.snapshot.width,Math.ceil(Math.max(...points.map(v=>v.x))));
        const y0=Math.max(0,Math.floor(Math.min(...points.map(v=>v.y))));
        const y1=Math.min(p.snapshot.height,Math.ceil(Math.max(...points.map(v=>v.y))));
        let source=0,target=0;
        const targetSectors={proximal:0,middle:0,distal:0};
        for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
            const index=(y*p.snapshot.width+x)*4;
            const alpha=p.snapshot.pixels[index+3]/255;
            if (!alpha) continue;
            const covered=areaInPixel(points,x,y)*alpha;
            source+=covered;
            const targetCovered=covered*p.snapshot.pixels[index+targetChannel]/255;
            target+=targetCovered;
            if (targetCovered) {
                const projection=((x+.5-axis.start.x)*dx
                    +(y+.5-axis.start.y)*dy)/length2;
                const sector=projection<1/3?'proximal':projection<2/3
                    ?'middle':'distal';
                targetSectors[sector]+=targetCovered;
            }
        }
        rows.push({id,bind,source,target,role:p.topology.diagnostic.faceRoles[id].role,
            support:p.coverage.support[id],targetSectors});
    }
    const sourceTotal=rows.reduce((s,v)=>s+v.source,0);
    const targetTotal=rows.reduce((s,v)=>s+v.target,0);
    assert.ok(sourceTotal>0&&targetTotal>0);
    return {rows,sourceTotal,targetTotal,preprocessingMs:performance.now()-started};
}

export function proxyAtPose(p,skin,clip,support,posedMesh) {
    const byId=new Map(posedMesh.vertices.map(v=>[v.vertexId,v]));
    let source=0,target=0;
    const roles={},sectors={proximal:{bind:0,posed:0},
        middle:{bind:0,posed:0},distal:{bind:0,posed:0}};
    const rows=support.rows.map(row=>{
        const tri=p.mesh.triangles[row.id].map(v=>byId.get(v));
        const area=signedArea(...tri),ratio=area/row.bind;
        const region=row.role.startsWith(`CHILD:${p.fixture.movingBoneId}`)
            ? 'target CHILD' : row.role.startsWith('JUNCTION:')
                ? 'Junction' : 'other CHILD';
        const sourceArea=row.source*ratio,targetArea=row.target*ratio;
        source+=sourceArea;target+=targetArea;
        for (const [name,value] of Object.entries(row.targetSectors)) {
            sectors[name].bind+=value;
            sectors[name].posed+=value*ratio;
        }
        const agg=roles[region] ||= {bindSource:0,posedSource:0,bindTarget:0,posedTarget:0};
        agg.bindSource+=row.source;agg.posedSource+=sourceArea;
        agg.bindTarget+=row.target;agg.posedTarget+=targetArea;
        return {...row,area,ratio,region,sourceArea,targetArea};
    });
    return {sourceRatio:source/support.sourceTotal,targetRatio:target/support.targetTotal,
        roles,sectors,rows};
}
