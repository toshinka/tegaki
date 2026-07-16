import {
    createTriangleMeshData,
    warpRgbaWithTriangles
} from './warp-grid-rasterizer.js';

/** Control Mesh用Pixi adapter data。Topologyは保存正本のtriangleをそのまま使う。 */
export function createControlMeshRenderData(deformer, sourceBounds) {
    if (deformer?.type !== 'control-mesh') return null;
    return createTriangleMeshData(deformer, sourceBounds, deformer.triangles);
}

/** Control Mesh用CPU reference renderer。 */
export function warpRgbaWithControlMesh(options = {}) {
    if (options.deformer?.type !== 'control-mesh') {
        throw new Error('Control Mesh deformer is required');
    }
    return warpRgbaWithTriangles({
        ...options,
        triangles: options.deformer.triangles
    });
}
