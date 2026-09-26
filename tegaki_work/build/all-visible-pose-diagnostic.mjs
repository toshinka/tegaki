// R-54 diagnostic: all source-Alpha-supported triangles on frozen R-47 Mesh.
import assert from 'node:assert/strict';
import { roleMetadata } from './pose-failure-attribution-diagnostic.mjs';

const cross=(u,v)=>u.x*v.y-u.y*v.x;
const area2=(a,b,c)=>cross({x:b.x-a.x,y:b.y-a.y},{x:c.x-a.x,y:c.y-a.y});
const targetWeight=(skin,id,bone)=>{
    const row=skin.vertexWeights.find(v=>v.vertexId===id);
    return row.influences.find(v=>v.boneId===bone)?.weight||0;
};
export function allVisibleSystemFor(p,W2,junctionSystem,support) {
    const byId=new Map(p.mesh.vertices.map(v=>[v.vertexId,v]));
    const metadata=roleMetadata(p.mesh,p.topology.diagnostic);
    const d={x:60,y:0};
    const triangles=[];
    const alphaCoefficients=new Array(junctionSystem.variables.length).fill(0);
    let alphaConstant=0;
    for (const row of support.rows) {
        const existingVisible=['visible-supporting','mixed']
            .includes(p.coverage.support[row.id]);
        if (existingVisible) assert.ok(row.source>1e-8,
            `${p.fixture.id}: visible triangle lacks continuous support ${row.id}`);
        const visible=existingVisible||row.source>1e-8;
        const tri=p.mesh.triangles[row.id],points=tri.map(id=>byId.get(id));
        const bind=area2(...points);
        assert.ok(bind>0);
        const u={x:points[1].x-points[0].x,y:points[1].y-points[0].y};
        const v={x:points[2].x-points[0].x,y:points[2].y-points[0].y};
        const dv=cross(d,v),ud=cross(u,d),coeff=[-dv-ud,dv,ud];
        let constant=bind;
        const entries=[];
        tri.forEach((id,k)=>{
            const index=junctionSystem.index.get(`${id}|${p.fixture.movingBoneId}`);
            if (index===undefined) constant+=coeff[k]*targetWeight(W2.skinBinding,id,
                p.fixture.movingBoneId);
            else entries.push([index,coeff[k]]);
        });
        if (visible) triangles.push({id:row.id,bind,constant,
            coefficients:entries,role:metadata.triangleRoles[row.id].kind});
        if (row.target>0) {
            alphaConstant+=row.target*constant/bind/support.targetTotal;
            for (const [index,value] of entries)
                alphaCoefficients[index]+=row.target*value/bind/support.targetTotal;
        }
    }
    const roles=Object.fromEntries([...new Set(triangles.map(v=>v.role))].sort()
        .map(role=>[role,triangles.filter(v=>v.role===role).length]));
    return {...junctionSystem,triangles,roles,
        alpha:{constant:alphaConstant,coefficients:alphaCoefficients,
            threshold:.875}};
}
