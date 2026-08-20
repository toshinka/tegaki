/**
 * 一枚Raster用のChain-local Joint Skin候補。
 *
 * 各vertexを最寄りBoneのrigid領域へ割り当て、直結する親子Boneだけを
 * joint周辺の短いbandでblendする。別branchが同距離圏へ入る場合は
 * 無言で選ばず、production mutation前に理由付きで拒否するpure helper。
 */

const GEOMETRY_EPSILON = 1e-9;
const DEFAULT_JOINT_BAND_RATIO = 0.3;
const DEFAULT_BRANCH_AMBIGUITY_RATIO = 0.08;
const JOINT_SECONDARY_COMPETITION_RATIO = 0.6;

export const CHAIN_LOCAL_JOINT_SKIN_WEIGHT_MODE = 'chain-local-joint-v1';

function isFinitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function pointDistance(left, right) {
    return Math.hypot(right.x - left.x, right.y - left.y);
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep01(value) {
    const ratio = clamp(value, 0, 1);
    return ratio * ratio * (3 - 2 * ratio);
}

function distanceToSegment(point, segment) {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!(lengthSquared > GEOMETRY_EPSILON)) return pointDistance(point, segment.start);
    const ratio = clamp((
        (point.x - segment.start.x) * dx
        + (point.y - segment.start.y) * dy
    ) / lengthSquared, 0, 1);
    return pointDistance(point, {
        x: segment.start.x + dx * ratio,
        y: segment.start.y + dy * ratio
    });
}

function normalizeRatio(value, fallback, minimum, maximum) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
        ? clamp(numeric, minimum, maximum)
        : fallback;
}

function buildBoneGraph(bones, segments) {
    if (!Array.isArray(bones) || !Array.isArray(segments) || segments.length === 0) {
        return { ok: false, reason: 'chain-local-input-required' };
    }
    const allBoneById = new Map();
    for (const bone of bones) {
        if (typeof bone?.boneId !== 'string' || bone.boneId.length === 0) {
            return { ok: false, reason: 'chain-local-invalid-bone-id' };
        }
        if (allBoneById.has(bone.boneId)) {
            return { ok: false, reason: 'chain-local-duplicate-bone-id', boneId: bone.boneId };
        }
        allBoneById.set(bone.boneId, bone);
    }

    const segmentByBoneId = new Map();
    for (const segment of segments) {
        if (typeof segment?.boneId !== 'string' || !allBoneById.has(segment.boneId)) {
            return { ok: false, reason: 'chain-local-bone-not-found', boneId: segment?.boneId || null };
        }
        if (segmentByBoneId.has(segment.boneId)) {
            return { ok: false, reason: 'chain-local-duplicate-segment', boneId: segment.boneId };
        }
        if (!isFinitePoint(segment.start) || !isFinitePoint(segment.end)) {
            return { ok: false, reason: 'chain-local-invalid-segment', boneId: segment.boneId };
        }
        const length = pointDistance(segment.start, segment.end);
        if (!(length > GEOMETRY_EPSILON)) {
            return { ok: false, reason: 'chain-local-zero-length-segment', boneId: segment.boneId };
        }
        segmentByBoneId.set(segment.boneId, {
            boneId: segment.boneId,
            start: { x: Number(segment.start.x), y: Number(segment.start.y) },
            end: { x: Number(segment.end.x), y: Number(segment.end.y) },
            length
        });
    }

    const boneById = new Map([...segmentByBoneId.keys()].map(boneId => [boneId, allBoneById.get(boneId)]));
    const parentByBoneId = new Map();
    const childrenByBoneId = new Map([...boneById.keys()].map(boneId => [boneId, []]));
    boneById.forEach((bone, boneId) => {
        const parentBoneId = boneById.has(bone?.parentBoneId) ? bone.parentBoneId : null;
        parentByBoneId.set(boneId, parentBoneId);
        if (parentBoneId) childrenByBoneId.get(parentBoneId).push(boneId);
    });
    childrenByBoneId.forEach(children => children.sort((left, right) => left.localeCompare(right)));

    for (const boneId of boneById.keys()) {
        const visited = new Set([boneId]);
        let parentBoneId = parentByBoneId.get(boneId);
        while (parentBoneId) {
            if (visited.has(parentBoneId)) {
                return { ok: false, reason: 'chain-local-bone-cycle', boneId };
            }
            visited.add(parentBoneId);
            parentBoneId = parentByBoneId.get(parentBoneId);
        }
    }
    return {
        ok: true,
        boneById,
        segmentByBoneId,
        parentByBoneId,
        childrenByBoneId
    };
}

function areDirectRelatives(graph, leftBoneId, rightBoneId) {
    return graph.parentByBoneId.get(leftBoneId) === rightBoneId
        || graph.parentByBoneId.get(rightBoneId) === leftBoneId;
}

function createJointCandidate(
    graph,
    primaryBoneId,
    secondaryBoneId,
    point,
    jointBandRatio,
    primaryDistance,
    secondaryDistance
) {
    const primarySegment = graph.segmentByBoneId.get(primaryBoneId);
    const secondarySegment = graph.segmentByBoneId.get(secondaryBoneId);
    const childBoneId = graph.parentByBoneId.get(primaryBoneId) === secondaryBoneId
        ? primaryBoneId
        : secondaryBoneId;
    const childSegment = graph.segmentByBoneId.get(childBoneId);
    const parentBoneId = graph.parentByBoneId.get(childBoneId);
    const parentSegment = graph.segmentByBoneId.get(parentBoneId);
    const joint = childSegment.start;
    const bandRadius = Math.min(primarySegment.length, secondarySegment.length) * jointBandRatio;
    const jointDistance = pointDistance(point, joint);
    return {
        boneId: secondaryBoneId,
        childBoneId,
        joint,
        bandRadius,
        jointDistance,
        primaryDistance,
        secondaryDistance,
        competitionDistance: childBoneId === primaryBoneId
            ? Math.max(0, secondaryDistance - distanceToSegment(joint, parentSegment))
            : secondaryDistance,
        normalizedDistance: bandRadius > GEOMETRY_EPSILON
            ? jointDistance / bandRadius
            : Number.POSITIVE_INFINITY
    };
}

function createVertexWeight(vertex, graph, options) {
    if (typeof vertex?.vertexId !== 'string' || vertex.vertexId.length === 0 || !isFinitePoint(vertex)) {
        return { ok: false, reason: 'chain-local-invalid-vertex', vertexId: vertex?.vertexId || null };
    }
    const ranked = [...graph.segmentByBoneId.values()]
        .map(segment => ({
            boneId: segment.boneId,
            distance: distanceToSegment(vertex, segment),
            length: segment.length
        }))
        .sort((left, right) => left.distance - right.distance || left.boneId.localeCompare(right.boneId));
    const primary = ranked[0];

    const ambiguousBranch = ranked.slice(1).find(candidate => {
        if (areDirectRelatives(graph, primary.boneId, candidate.boneId)) return false;
        const tolerance = Math.min(primary.length, candidate.length) * options.branchAmbiguityRatio;
        return candidate.distance - primary.distance <= tolerance + GEOMETRY_EPSILON;
    });
    if (ambiguousBranch) {
        return {
            ok: false,
            reason: 'chain-local-ambiguous-branch',
            vertexId: vertex.vertexId,
            boneIds: [primary.boneId, ambiguousBranch.boneId],
            distances: [primary.distance, ambiguousBranch.distance]
        };
    }

    const relativeBoneIds = [
        graph.parentByBoneId.get(primary.boneId),
        ...(graph.childrenByBoneId.get(primary.boneId) || [])
    ].filter(Boolean);
    const distanceByBoneId = new Map(ranked.map(candidate => [candidate.boneId, candidate.distance]));
    const jointCandidates = relativeBoneIds
        .map(boneId => createJointCandidate(
            graph,
            primary.boneId,
            boneId,
            vertex,
            options.jointBandRatio,
            primary.distance,
            distanceByBoneId.get(boneId)
        ))
        .filter(candidate => (
            candidate.normalizedDistance < 1 - GEOMETRY_EPSILON
            && candidate.competitionDistance - candidate.primaryDistance
                <= candidate.bandRadius * JOINT_SECONDARY_COMPETITION_RATIO + GEOMETRY_EPSILON
        ))
        .sort((left, right) => (
            left.normalizedDistance - right.normalizedDistance
            || left.boneId.localeCompare(right.boneId)
        ));
    if (jointCandidates.length > 1
        && Math.abs(jointCandidates[1].normalizedDistance - jointCandidates[0].normalizedDistance)
            <= options.branchAmbiguityRatio + GEOMETRY_EPSILON) {
        return {
            ok: false,
            reason: 'chain-local-ambiguous-joint',
            vertexId: vertex.vertexId,
            boneIds: [primary.boneId, jointCandidates[0].boneId, jointCandidates[1].boneId]
        };
    }

    const secondary = jointCandidates[0] || null;
    if (!secondary) {
        return {
            ok: true,
            vertexWeight: {
                vertexId: vertex.vertexId,
                influences: [{ boneId: primary.boneId, weight: 1 }]
            },
            assignment: { vertexId: vertex.vertexId, primaryBoneId: primary.boneId, secondaryBoneId: null }
        };
    }
    const secondaryWeight = 0.5 * (1 - smoothstep01(secondary.normalizedDistance));
    if (!(secondaryWeight > GEOMETRY_EPSILON)) {
        return {
            ok: true,
            vertexWeight: {
                vertexId: vertex.vertexId,
                influences: [{ boneId: primary.boneId, weight: 1 }]
            },
            assignment: { vertexId: vertex.vertexId, primaryBoneId: primary.boneId, secondaryBoneId: null }
        };
    }
    return {
        ok: true,
        vertexWeight: {
            vertexId: vertex.vertexId,
            influences: [
                { boneId: primary.boneId, weight: 1 - secondaryWeight },
                { boneId: secondary.boneId, weight: secondaryWeight }
            ]
        },
        assignment: {
            vertexId: vertex.vertexId,
            primaryBoneId: primary.boneId,
            secondaryBoneId: secondary.boneId,
            joint: { ...secondary.joint },
            jointDistance: secondary.jointDistance,
            bandRadius: secondary.bandRadius
        }
    };
}

/**
 * 既存Mesh vertex / Bone tree / Bind segmentから既存vertexWeights shapeだけを返す。
 * 入力を変更せず、一頂点でもbranch判断が曖昧なら全体を拒否する。
 */
export function createChainLocalJointSkinWeights(vertices, bones, segments, options = {}) {
    if (!Array.isArray(vertices) || vertices.length === 0) {
        return { ok: false, reason: 'chain-local-vertices-required', vertexWeights: [] };
    }
    const graph = buildBoneGraph(bones, segments);
    if (!graph.ok) return { ...graph, vertexWeights: [] };
    const resolvedOptions = {
        jointBandRatio: normalizeRatio(
            options.jointBandRatio,
            DEFAULT_JOINT_BAND_RATIO,
            0.05,
            0.5
        ),
        branchAmbiguityRatio: normalizeRatio(
            options.branchAmbiguityRatio,
            DEFAULT_BRANCH_AMBIGUITY_RATIO,
            0.01,
            0.25
        )
    };
    const vertexWeights = [];
    const assignments = [];
    for (const vertex of vertices) {
        const result = createVertexWeight(vertex, graph, resolvedOptions);
        if (!result.ok) {
            return {
                ...result,
                vertexWeights: [],
                assignments: [],
                options: resolvedOptions
            };
        }
        vertexWeights.push(result.vertexWeight);
        assignments.push(result.assignment);
    }
    return {
        ok: true,
        reason: null,
        vertexWeights,
        assignments,
        options: resolvedOptions,
        diagnostics: {
            vertexCount: vertexWeights.length,
            rigidVertexCount: vertexWeights.filter(weight => weight.influences.length === 1).length,
            jointVertexCount: vertexWeights.filter(weight => weight.influences.length === 2).length
        }
    };
}
