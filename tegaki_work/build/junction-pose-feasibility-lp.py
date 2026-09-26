"""R-50/R-51 diagnostic LP on one frozen-fixture system from stdin."""

import json
import sys
from time import perf_counter

import numpy as np
from scipy.optimize import linprog

AREA_EPSILON = 1e-8
SOLVER_TOLERANCE = 1e-9
MARGIN_TIE_TOLERANCE = 1e-8


def solve(system):
    started = perf_counter()
    n = len(system['variables'])
    triangles = system['triangles']
    vertices = system['vertices']
    w2 = np.array([row['w2'] for row in system['variables']], dtype=float)
    bounds = [(row['fixed'], row['fixed']) if row['fixed'] is not None
              else (0.0, 1.0) for row in system['variables']]
    equality = np.zeros((len(vertices), n), dtype=float)
    for i, vertex in enumerate(vertices):
        equality[i, vertex['indices']] = 1.0
    beq = np.ones(len(vertices))
    coefficients = np.zeros((len(triangles), n), dtype=float)
    constants = np.array([row['constant'] for row in triangles], dtype=float)
    bind = np.array([row['bind'] for row in triangles], dtype=float)
    for i, row in enumerate(triangles):
        for index, value in row['coefficients']:
            coefficients[i, index] += value
    options = {'primal_feasibility_tolerance': SOLVER_TOLERANCE,
               'dual_feasibility_tolerance': SOLVER_TOLERANCE}
    build_ms = (perf_counter() - started) * 1000

    max_matrix = np.column_stack((-coefficients, bind))
    max_rhs = constants
    objective = np.zeros(n + 1)
    objective[-1] = -1
    started_max = perf_counter()
    maximum = linprog(objective, A_ub=max_matrix, b_ub=max_rhs,
                      A_eq=np.column_stack((equality, np.zeros(len(vertices)))),
                      b_eq=beq, bounds=bounds + [(None, None)],
                      method='highs', options=options)
    max_ms = (perf_counter() - started_max) * 1000
    if not maximum.success:
        return {'ok': False, 'stage': 'max-margin', 'status': maximum.status,
                'message': maximum.message, 'timingMs': {'construction': build_ms,
                                                       'maxMargin': max_ms}}
    margin = float(maximum.x[-1])
    multipliers = -maximum.ineqlin.marginals
    weighted = multipliers @ coefficients
    dual_upper = float(multipliers @ constants)
    for vertex in vertices:
        indices = vertex['indices']
        fixed = [bounds[i][0] for i in indices]
        if all(value is not None for value in fixed):
            dual_upper += float(np.dot(weighted[indices], fixed))
        else:
            dual_upper += float(np.max(weighted[indices]))
    dual = {'upperBound': dual_upper,
            'normalization': float(multipliers @ bind),
            'triangleSupport': [
                {'id': row['id'], 'multiplier': float(multipliers[i]),
                 'bindArea2': row['bind']}
                for i, row in enumerate(triangles)
                if multipliers[i] > 1e-8]}

    # Same L1 formulation serves as deterministic max-margin tie-break and
    # minimum-deviation feasibility diagnostic. It is not a product policy.
    def l1_at(required_area):
        m = len(triangles)
        area_matrix = np.column_stack((-coefficients, np.zeros((m, n))))
        area_rhs = constants - required_area
        deviation_plus = np.column_stack((np.eye(n), -np.eye(n)))
        deviation_minus = np.column_stack((-np.eye(n), -np.eye(n)))
        inequality = np.vstack((area_matrix, deviation_plus, deviation_minus))
        rhs = np.concatenate((area_rhs, w2, -w2))
        eq = np.column_stack((equality, np.zeros((len(vertices), n))))
        objective_l1 = np.concatenate((np.zeros(n), np.ones(n)))
        return linprog(objective_l1, A_ub=inequality, b_ub=rhs,
                       A_eq=eq, b_eq=beq,
                       bounds=bounds + [(0.0, None)] * n,
                       method='highs', options=options)

    result = {'ok': True, 'mStar': margin,
              'dual': dual,
              'rawMarginWeights': maximum.x[:n].tolist(),
              'timingMs': {'construction': build_ms, 'maxMargin': max_ms},
              'tolerances': {'area': AREA_EPSILON, 'solver': SOLVER_TOLERANCE,
                             'marginTie': MARGIN_TIE_TOLERANCE}}
    if margin <= AREA_EPSILON:
        # Feasibility is settled by the max-margin certificate; no FW exists.
        result['minimumDeviation'] = None
        result['witness'] = None
        return result

    started_tie = perf_counter()
    tie = l1_at((margin - MARGIN_TIE_TOLERANCE) * bind)
    result['timingMs']['maxMarginTieBreak'] = (perf_counter() - started_tie) * 1000
    if not tie.success:
        return {'ok': False, 'stage': 'max-margin-tie-break',
                'status': tie.status, 'message': tie.message,
                'mStar': margin, 'timingMs': result['timingMs']}
    result['witness'] = tie.x[:n].tolist()
    result['witnessL1FromW2'] = float(tie.fun)

    started_min = perf_counter()
    minimum = l1_at(np.full(len(triangles), AREA_EPSILON))
    result['timingMs']['minimumDeviation'] = (perf_counter() - started_min) * 1000
    if not minimum.success:
        return {'ok': False, 'stage': 'minimum-deviation',
                'status': minimum.status, 'message': minimum.message,
                'mStar': margin, 'timingMs': result['timingMs']}
    result['minimumDeviation'] = minimum.x[:n].tolist()
    result['minimumDeviationL1'] = float(minimum.fun)
    result['minimumArea'] = float(np.min(constants + coefficients @ minimum.x[:n]))
    result['witnessMinimumRatio'] = float(np.min(
        (constants + coefficients @ tie.x[:n]) / bind))
    return result


def solve_soft(system):
    """F1: child-dominant margin; F2: least one-hot relaxation; L1 tie-break."""
    started = perf_counter()
    n = len(system['variables'])
    triangles = system['triangles']
    vertices = system['vertices']
    w2 = np.array([row['w2'] for row in system['variables']], dtype=float)
    equality = np.zeros((len(vertices), n), dtype=float)
    for i, vertex in enumerate(vertices):
        equality[i, vertex['indices']] = 1
    beq = np.ones(len(vertices))
    coefficients = np.zeros((len(triangles), n), dtype=float)
    constants = np.array([row['constant'] for row in triangles], dtype=float)
    bind = np.array([row['bind'] for row in triangles], dtype=float)
    for i, row in enumerate(triangles):
        for index, value in row['coefficients']:
            coefficients[i, index] += value
    boundary = []
    dominance = []
    for vertex in vertices:
        own = [i for i in vertex['indices']
               if system['variables'][i]['fixed'] == 1]
        if not own:
            continue
        if len(own) != 1:
            raise ValueError('multiple-own-child-boundary')
        boundary.append({'vertexId': vertex['id'], 'own': own[0],
                         'indices': vertex['indices']})
        for other in vertex['indices']:
            if other == own[0]:
                continue
            row = np.zeros(n)
            row[other], row[own[0]] = 1, -1
            dominance.append((vertex['id'], other, row))
    dominance_matrix = np.array([row for _, _, row in dominance])
    options = {'primal_feasibility_tolerance': SOLVER_TOLERANCE,
               'dual_feasibility_tolerance': SOLVER_TOLERANCE}
    build_ms = (perf_counter() - started) * 1000
    free_bounds = [(0.0, 1.0)] * n

    # F1: identical to R-50 area model; only fixed one-hot bounds become
    # child-dominance inequalities at geometric interfaces.
    f1_rows = np.vstack((np.column_stack((-coefficients, bind)),
                         np.column_stack((dominance_matrix,
                                          np.zeros(len(dominance))))))
    f1_rhs = np.concatenate((constants, np.zeros(len(dominance))))
    objective = np.zeros(n + 1)
    objective[-1] = -1
    started_f1 = perf_counter()
    f1 = linprog(objective, A_ub=f1_rows, b_ub=f1_rhs,
                 A_eq=np.column_stack((equality, np.zeros(len(vertices)))),
                 b_eq=beq, bounds=free_bounds + [(None, None)],
                 method='highs', options=options)
    f1_ms = (perf_counter() - started_f1) * 1000
    if not f1.success:
        return {'ok': False, 'stage': 'F1', 'status': f1.status,
                'message': f1.message,
                'timingMs': {'construction': build_ms, 'F1': f1_ms}}
    margin = float(f1.x[-1])
    areas = constants + coefficients @ f1.x[:n]
    ratios = areas / bind
    multipliers = -f1.ineqlin.marginals
    result = {'ok': True, 'mSoft': margin,
              'timingMs': {'construction': build_ms, 'F1': f1_ms},
              'tolerances': {'area': AREA_EPSILON,
                             'solver': SOLVER_TOLERANCE},
              'F1Active': [{'id': row['id'], 'ratio': float(ratios[i]),
                            'multiplier': float(multipliers[i])}
                           for i, row in enumerate(triangles)
                           if abs(ratios[i] - margin) <= 1e-7],
              'F1DualTriangleSupport': [
                  {'id': row['id'], 'multiplier': float(multipliers[i])}
                  for i, row in enumerate(triangles)
                  if multipliers[i] > 1e-8],
              'F1DualDominanceSupport': [
                  {'vertexId': vertex_id,
                   'otherBoneId': system['variables'][other]['boneId'],
                   'multiplier': float(multipliers[len(triangles) + i])}
                  for i, (vertex_id, other, _) in enumerate(dominance)
                  if multipliers[len(triangles) + i] > 1e-8],
              'F1Weights': f1.x[:n].tolist()}
    if margin <= 0:
        return result

    # F2: minimum worst-case interface departure from one-hot.
    area_rows = np.column_stack((-coefficients, np.zeros(len(triangles))))
    dominance_rows = np.column_stack((dominance_matrix,
                                       np.zeros(len(dominance))))
    delta_rows = np.zeros((len(boundary), n + 1))
    for i, item in enumerate(boundary):
        delta_rows[i, item['own']] = -1
        delta_rows[i, n] = -1
    f2_rows = np.vstack((area_rows, dominance_rows, delta_rows))
    f2_rhs = np.concatenate((constants - AREA_EPSILON,
                             np.zeros(len(dominance)),
                             -np.ones(len(boundary))))
    f2_objective = np.zeros(n + 1)
    f2_objective[n] = 1
    started_f2 = perf_counter()
    f2 = linprog(f2_objective, A_ub=f2_rows, b_ub=f2_rhs,
                 A_eq=np.column_stack((equality, np.zeros(len(vertices)))),
                 b_eq=beq, bounds=free_bounds + [(0.0, 1.0)],
                 method='highs', options=options)
    f2_ms = (perf_counter() - started_f2) * 1000
    result['timingMs']['F2'] = f2_ms
    if not f2.success:
        return {'ok': False, 'stage': 'F2', 'status': f2.status,
                'message': f2.message, 'mSoft': margin,
                'timingMs': result['timingMs']}
    delta_min = float(f2.x[n])
    result['deltaMin'] = delta_min

    # The same F2 feasible set, with delta fixed at its minimum tolerance,
    # minimizes total L1 distance to the one-hot W2 boundary + W2 interior.
    l1_rows = np.column_stack((f2_rows, np.zeros((len(f2_rows), n))))
    plus = np.column_stack((np.eye(n), np.zeros(n), -np.eye(n)))
    minus = np.column_stack((-np.eye(n), np.zeros(n), -np.eye(n)))
    l1_rows = np.vstack((l1_rows, plus, minus))
    l1_rhs = np.concatenate((f2_rhs, w2, -w2))
    l1_eq = np.column_stack((equality, np.zeros((len(vertices), n + 1))))
    l1_objective = np.concatenate((np.zeros(n + 1), np.ones(n)))
    started_tie = perf_counter()
    tied = linprog(l1_objective, A_ub=l1_rows, b_ub=l1_rhs,
                   A_eq=l1_eq, b_eq=beq,
                   bounds=free_bounds
                   + [(0.0, min(1.0, delta_min + MARGIN_TIE_TOLERANCE))]
                   + [(0.0, None)] * n,
                   method='highs', options=options)
    result['timingMs']['secondaryL1'] = (perf_counter() - started_tie) * 1000
    if not tied.success:
        return {'ok': False, 'stage': 'secondary-L1', 'status': tied.status,
                'message': tied.message, 'mSoft': margin,
                'deltaMin': delta_min, 'timingMs': result['timingMs']}
    result['SBW'] = tied.x[:n].tolist()
    result['SBWDelta'] = float(tied.x[n])
    result['SBWL1'] = float(tied.fun)
    result['SBWMinimumArea'] = float(np.min(constants
                                            + coefficients @ tied.x[:n]))
    return result


def solve_alpha(system):
    """R-53 Stage 1: exact Translation LP with target-area proxy row."""
    started = perf_counter()
    variables = system['variables']
    n = len(variables)
    vertices = system['vertices']
    triangles = system['triangles']
    coefficients = np.zeros((len(triangles), n))
    constants = np.array([r['constant'] for r in triangles])
    bind = np.array([r['bind'] for r in triangles])
    for i, row in enumerate(triangles):
        for j, value in row['coefficients']:
            coefficients[i, j] += value
    equality = np.zeros((len(vertices), n))
    for i, row in enumerate(vertices):
        equality[i, row['indices']] = 1
    dominance = []
    for row in vertices:
        own = [i for i in row['indices'] if variables[i]['fixed'] == 1]
        if not own:
            continue
        assert len(own) == 1
        for sibling in row['indices']:
            if sibling != own[0]:
                constraint = np.zeros(n)
                constraint[sibling], constraint[own[0]] = 1, -1
                dominance.append(constraint)
    dominance = np.asarray(dominance).reshape(-1,n)
    alpha_constant = float(system['alpha']['constant'])
    alpha_coefficients = np.asarray(system['alpha']['coefficients'])
    rows = np.vstack((np.column_stack((-coefficients, bind)),
        np.column_stack((dominance, np.zeros(len(dominance)))),
        np.r_[-alpha_coefficients, 0][None,:]))
    alpha_threshold = float(system['alpha'].get('threshold', .85))
    rhs = np.r_[constants, np.zeros(len(dominance)), alpha_constant - alpha_threshold]
    eq = np.column_stack((equality, np.zeros(len(vertices))))
    objective = np.zeros(n+1)
    objective[-1] = -1
    build_ms = (perf_counter()-started)*1000
    solve_started = perf_counter()
    result = linprog(objective, A_ub=rows, b_ub=rhs, A_eq=eq,
        b_eq=np.ones(len(vertices)),bounds=[(0,1)]*n+[(None,None)],
        method='highs', options={'primal_feasibility_tolerance': SOLVER_TOLERANCE,
                                 'dual_feasibility_tolerance': SOLVER_TOLERANCE})
    solve_ms = (perf_counter()-solve_started)*1000
    report = {'ok':bool(result.success),'status':int(result.status),
              'message':result.message,
              'timingMs':{'construction':build_ms,'solve':solve_ms}}
    if result.success:
        w=result.x[:n]
        report.update(mStar=float(result.x[-1]),
                      targetAlphaGeom=float(alpha_constant+alpha_coefficients@w),
                      minimumArea=float(np.min(constants+coefficients@w)),
                      weights=w.tolist(),
                      alphaConstraintSlack=float(alpha_constant
                          +alpha_coefficients@w-alpha_threshold),
                      activeTriangles=[triangles[i]['id'] for i,value in enumerate(
                          (constants+coefficients@w)/bind)
                          if abs(value-result.x[-1])<1e-7])
    return report


if __name__ == '__main__':
    payload = json.load(sys.stdin)
    operation = {'soft':solve_soft,'alpha':solve_alpha}.get(payload.get('mode'),solve)
    print(json.dumps(operation(payload), separators=(',', ':'), allow_nan=False))
