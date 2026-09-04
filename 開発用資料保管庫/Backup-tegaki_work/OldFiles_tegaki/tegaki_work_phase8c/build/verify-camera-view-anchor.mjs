import assert from 'node:assert/strict';
import {
    mapCameraStagePointToLocal,
    resolveCameraPositionForAnchoredPoint
} from '../system/camera-view-anchor.js';

const viewportCenter = { x: 713, y: 449 };
const before = {
    position: { x: -245, y: 83 },
    pivot: { x: 17, y: -9 },
    scale: { x: 2.4, y: 2.4 },
    rotation: Math.PI / 7
};
const localAnchor = mapCameraStagePointToLocal(viewportCenter, before);

for (const nextScale of [
    { x: -2.4, y: 2.4 },
    { x: 2.4, y: -2.4 },
    { x: -2.4, y: -2.4 }
]) {
    const position = resolveCameraPositionForAnchoredPoint(
        viewportCenter,
        localAnchor,
        { ...before, scale: nextScale }
    );
    const restoredAnchor = mapCameraStagePointToLocal(
        viewportCenter,
        { ...before, position, scale: nextScale }
    );
    assert.ok(Math.abs(restoredAnchor.x - localAnchor.x) < 1e-9);
    assert.ok(Math.abs(restoredAnchor.y - localAnchor.y) < 1e-9);
}

console.log('verify-camera-view-anchor: ok');
