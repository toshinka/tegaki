"""R-52 diagnostic only: deterministic local search, not infeasibility proof."""
import json
import sys
from time import perf_counter

import numpy as np
from scipy.optimize import minimize


def solve(payload):
    started = perf_counter()
    rows = payload['variables']
    n = len(rows)
    base = np.asarray(payload['base'], dtype=float)
    ids = np.asarray(payload['triangleVertices'], dtype=int)
    bind = np.asarray(payload['bind'], dtype=float)
    target_index = np.asarray(payload['targetIndex'], dtype=int)
    fixed_target = np.asarray(payload['fixedTarget'], dtype=float)
    poses = payload['poses']
    deltas = np.asarray([pose['delta'] for pose in poses], dtype=float)
    triples = np.asarray([v['indices'] for v in payload['vertices']], dtype=int)
    dominance = np.asarray(payload['dominance'], dtype=int).reshape(-1, 2)
    w2 = np.asarray([v['w2'] for v in rows], dtype=float)
    objective_margin_floor = 1e-8
    assert len(base) == len(target_index) == len(fixed_target)
    assert len(ids) == len(bind) and np.all(bind > 0)
    assert np.all(np.isfinite(deltas))
    xindex = target_index.copy()
    has_target = xindex >= 0

    def area_gradient_for(w, triangle_ids, pose_deltas):
        a, b, c = triangle_ids.T
        target = fixed_target.copy()
        target[has_target] = w[xindex[has_target]]
        moved = base[None, :, :] + target[None, :, None] * pose_deltas
        q = moved[:, b] - moved[:, a]
        r = moved[:, c] - moved[:, a]
        area = q[:, :, 0] * r[:, :, 1] - q[:, :, 1] * r[:, :, 0]
        da, db, dc = pose_deltas[:, a], pose_deltas[:, b], pose_deltas[:, c]
        cross = lambda u, v: u[..., 0] * v[..., 1] - u[..., 1] * v[..., 0]
        deriv = np.stack((-cross(da, r) - cross(q, da),
                          cross(db, r), cross(q, dc)), axis=-1)
        jac = np.zeros((len(pose_deltas) * len(triangle_ids), n), dtype=float)
        for corner in range(3):
            selected = xindex[triangle_ids[:, corner]]
            valid = selected >= 0
            pose_rows = np.arange(len(pose_deltas))[:, None] * len(triangle_ids)
            tri_rows = np.arange(len(triangle_ids))[None, :]
            np.add.at(jac, (np.broadcast_to(pose_rows + tri_rows,
                (len(pose_deltas), len(triangle_ids)))[:, valid].ravel(),
                np.broadcast_to(selected[None, valid],
                    (len(pose_deltas), np.count_nonzero(valid))).ravel()),
                deriv[:, valid, corner].ravel())
        return area.ravel(), jac

    def areas_and_grad(w):
        return area_gradient_for(w, ids, deltas)

    alpha = payload.get('alpha')
    if alpha:
        alpha_threshold = float(alpha.get('threshold', .85))
        alpha_ids = np.asarray(alpha['triangleVertices'], dtype=int)
        alpha_bind = np.asarray(alpha['bind'], dtype=float)
        alpha_support = np.asarray(alpha['targetSupport'], dtype=float)
        alpha_indices = np.asarray(alpha['poseIndices'], dtype=int)
        alpha_deltas = deltas[alpha_indices]
        alpha_coeff = alpha_support / (alpha_bind * float(alpha['targetTotal']))
        def alpha_values_grad(w):
            area, jac = area_gradient_for(w, alpha_ids, alpha_deltas)
            value = area.reshape(len(alpha_indices), -1) @ alpha_coeff
            gradient = jac.reshape(len(alpha_indices), len(alpha_ids), n)
            gradient = np.einsum('ptn,t->pn', gradient, alpha_coeff)
            return value, gradient
    else:
        alpha_values_grad = None

    area_bind = np.tile(bind, len(poses))
    eq_jac = np.zeros((len(triples), n + 1))
    for i, triple in enumerate(triples):
        eq_jac[i, triple] = 1
    dom_jac = np.zeros((len(dominance), n + 1))
    for i, (own, sibling) in enumerate(dominance):
        dom_jac[i, own] = 1
        dom_jac[i, sibling] = -1
    construction_ms = (perf_counter() - started) * 1000

    def quality(w):
        area, _ = areas_and_grad(w)
        ratios = area / area_bind
        return float(np.min(ratios)), int(np.argmin(ratios)), float(np.min(area))

    def violation(w):
        area, _ = areas_and_grad(w)
        checks = dict(area=float(np.max(np.maximum(0, objective_margin_floor - area))),
                    simplex=float(np.max(np.abs(np.sum(w[triples], axis=1) - 1))),
                    dominance=float(np.max(np.maximum(0,
                        w[dominance[:, 1]] - w[dominance[:, 0]])))
                    if len(dominance) else 0.0,
                    bounds=float(max(0, -np.min(w), np.max(w) - 1)))
        if alpha_values_grad:
            checks['targetAlpha'] = float(np.max(np.maximum(0,
                alpha_threshold - alpha_values_grad(w)[0])))
        return checks

    def r58_area_run(request):
        """One diagnostic area search on the existing R-54 variables/poses."""
        triangle_ids = np.asarray(request['triangleVertices'], dtype=int)
        area_bind_all = np.asarray(request['bind'], dtype=float)
        source = np.asarray(request['source'], dtype=float)
        assert len(triangle_ids) == len(area_bind_all) == len(source)
        assert np.all(area_bind_all > 0) and np.all(source >= 0)
        assert abs(np.sum(source) - request['sourceTotal']) < 1e-6
        whole_coeff = source / area_bind_all / request['sourceTotal']
        groups = {}
        for name, indices in request['groups'].items():
            mask = np.zeros(len(source), dtype=float)
            mask[np.asarray(indices, dtype=int)] = 1
            total = float(source @ mask)
            assert total > 0
            groups[name] = (total, source * mask / area_bind_all / total)
        floor = float(request['marginFloor'])
        baseline = np.asarray(request['baseline'], dtype=float)
        regional_min = request.get('regionalMin', {})

        def proxy(w):
            area, jac = area_gradient_for(w, triangle_ids, deltas[:1])
            return area, jac, float(whole_coeff @ area), whole_coeff @ jac

        def region_values(w):
            area, _, _, _ = proxy(w)
            return {name: float(coeff @ area)
                    for name, (_, coeff) in groups.items()}

        def region_constraint(w):
            values = region_values(w)
            return np.asarray([values[name] - threshold
                               for name, threshold in regional_min.items()])

        def region_jac(w):
            _, jac, _, _ = proxy(w)
            return np.asarray([groups[name][1] @ jac
                               for name in regional_min]).reshape(-1, n)

        def margin_constraint(w):
            return areas_and_grad(w)[0] - floor * area_bind

        constraints = [
            {'type': 'eq', 'fun': lambda w: eq_jac[:, :n] @ w - 1,
             'jac': lambda w: eq_jac[:, :n]},
            {'type': 'ineq', 'fun': lambda w: dom_jac[:, :n] @ w,
             'jac': lambda w: dom_jac[:, :n]},
            {'type': 'ineq', 'fun': margin_constraint,
             'jac': lambda w: areas_and_grad(w)[1]},
            {'type': 'ineq',
             'fun': lambda w: alpha_values_grad(w)[0] - alpha_threshold,
             'jac': lambda w: alpha_values_grad(w)[1]},
        ]
        if regional_min:
            constraints.append({'type': 'ineq', 'fun': region_constraint,
                                'jac': region_jac})
        result = minimize(lambda w: -proxy(w)[2], baseline,
                          jac=lambda w: -proxy(w)[3], method='SLSQP',
                          bounds=[(0, 1)] * n, constraints=constraints,
                          options={'maxiter': 300, 'ftol': 1e-10, 'disp': False})
        w = result.x
        area, _, whole, _ = proxy(w)
        region = region_values(w)
        pose_area, _ = areas_and_grad(w)
        checks = dict(simplex=float(np.max(np.abs(np.sum(w[triples], axis=1)-1))),
                      dominance=float(np.max(np.maximum(0, -dom_jac[:, :n] @ w)))
                      if len(dominance) else 0.,
                      bounds=float(max(0, -np.min(w), np.max(w)-1)),
                      orientation=float(np.max(np.maximum(0,
                          floor*area_bind-pose_area))),
                      targetAlpha=float(np.max(np.maximum(0,
                          alpha_threshold-alpha_values_grad(w)[0]))),
                      regional=float(np.max(np.maximum(0, -region_constraint(w))))
                      if regional_min else 0.)
        return dict(solverSuccess=bool(result.success),
                    solverStatus=int(result.status), message=str(result.message),
                    iterations=int(result.nit),
                    feasible=bool(all(v <= 1e-7 for v in checks.values())),
                    proxyWhole=whole,
                    proxyBaseline=proxy(baseline)[2],
                    regional=region,
                    regionalSlack={name: region[name]-minimum
                                   for name, minimum in regional_min.items()},
                    minimumPoseRatio=float(np.min(pose_area/area_bind)),
                    alphaProxy=alpha_values_grad(w)[0].tolist(),
                    activeOrientation=int(np.sum(pose_area/area_bind-floor < 1e-6)),
                    activeDominance=int(np.sum(dom_jac[:, :n] @ w < 1e-6)),
                    constraintViolation=checks, weights=w.tolist())

    if payload.get('r58Area'):
        assert alpha_values_grad is not None
        return r58_area_run(payload['r58Area'])

    def r61_shape_run(request):
        """One source-weighted Junction area-balance solve from canonical MSW."""
        triangle_ids = np.asarray(request['triangleVertices'], dtype=int)
        area_bind_all = np.asarray(request['bind'], dtype=float)
        source = np.asarray(request['source'], dtype=float)
        junction_ids = np.asarray(request['junctionIndices'], dtype=int)
        baseline = np.asarray(request['baseline'], dtype=float)
        floor = float(request['marginFloor'])
        assert len(triangle_ids) == len(area_bind_all) == len(source)
        assert len(baseline) == n and len(junction_ids) > 0
        assert np.all(area_bind_all > 0) and np.all(source >= 0)
        assert np.all(source[junction_ids] > 0)
        whole_coeff = source / area_bind_all / float(np.sum(source))
        junction_coeff = source[junction_ids] / float(np.sum(source[junction_ids]))
        groups = {}
        for name, indices in request['groups'].items():
            mask = np.zeros(len(source), dtype=float)
            mask[np.asarray(indices, dtype=int)] = 1
            total = float(source @ mask)
            assert total > 0
            groups[name] = source * mask / area_bind_all / total
        regional_min = request['regionalMin']
        whole_min = float(request['wholeMin'])

        def proxy(w):
            return area_gradient_for(w, triangle_ids, deltas[:1])

        def shape(w):
            area, jac = proxy(w)
            ratio = area[junction_ids] / area_bind_all[junction_ids]
            error = ratio - 1
            value = float(junction_coeff @ (error * error))
            gradient = 2 * (junction_coeff * error / area_bind_all[junction_ids]) \
                @ jac[junction_ids]
            return value, gradient, ratio

        def regional(w):
            area, _ = proxy(w)
            return {name: float(coeff @ area) for name, coeff in groups.items()}

        def regional_constraint(w):
            values = regional(w)
            return np.asarray([values[name] - minimum
                               for name, minimum in regional_min.items()])

        def regional_jac(w):
            _, jac = proxy(w)
            return np.asarray([groups[name] @ jac
                               for name in regional_min]).reshape(-1, n)

        def whole(w):
            area, jac = proxy(w)
            return float(whole_coeff @ area), whole_coeff @ jac

        constraints = [
            {'type': 'eq', 'fun': lambda w: eq_jac[:, :n] @ w - 1,
             'jac': lambda w: eq_jac[:, :n]},
            {'type': 'ineq', 'fun': lambda w: dom_jac[:, :n] @ w,
             'jac': lambda w: dom_jac[:, :n]},
            {'type': 'ineq',
             'fun': lambda w: areas_and_grad(w)[0] - floor * area_bind,
             'jac': lambda w: areas_and_grad(w)[1]},
            {'type': 'ineq',
             'fun': lambda w: alpha_values_grad(w)[0] - alpha_threshold,
             'jac': lambda w: alpha_values_grad(w)[1]},
            {'type': 'ineq', 'fun': regional_constraint,
             'jac': regional_jac},
            {'type': 'ineq', 'fun': lambda w: whole(w)[0] - whole_min,
             'jac': lambda w: whole(w)[1]},
        ]
        result = minimize(lambda w: shape(w)[0], baseline,
                          jac=lambda w: shape(w)[1], method='SLSQP',
                          bounds=[(0, 1)] * n, constraints=constraints,
                          options={'maxiter': 300, 'ftol': 1e-10, 'disp': False})
        w = result.x
        pose_area, _ = areas_and_grad(w)
        values = regional(w)
        whole_value = whole(w)[0]
        checks = dict(simplex=float(np.max(np.abs(np.sum(w[triples], axis=1)-1))),
                      dominance=float(np.max(np.maximum(0, -dom_jac[:, :n] @ w)))
                      if len(dominance) else 0.,
                      bounds=float(max(0, -np.min(w), np.max(w)-1)),
                      orientation=float(np.max(np.maximum(0,
                          floor*area_bind-pose_area))),
                      targetAlpha=float(np.max(np.maximum(0,
                          alpha_threshold-alpha_values_grad(w)[0]))),
                      regional=float(np.max(np.maximum(0, -regional_constraint(w)))),
                      whole=max(0., whole_min-whole_value))
        return dict(solverSuccess=bool(result.success),
                    solverStatus=int(result.status), message=str(result.message),
                    iterations=int(result.nit),
                    feasible=bool(all(v <= 1e-7 for v in checks.values())),
                    objectiveBaseline=shape(baseline)[0],
                    objectiveCandidate=shape(w)[0],
                    wholeProxyBaseline=whole(baseline)[0],
                    wholeProxyCandidate=whole_value,
                    regional=values,
                    minimumPoseRatio=float(np.min(pose_area/area_bind)),
                    alphaProxy=alpha_values_grad(w)[0].tolist(),
                    constraintViolation=checks, weights=w.tolist())

    if payload.get('r61Shape'):
        assert alpha_values_grad is not None
        return r61_shape_run(payload['r61Shape'])

    def p1_run(label, start):
        initial_m, _, _ = quality(start)
        x0 = np.r_[start, initial_m - 1e-7]
        def objective(x): return -x[-1]
        def objective_jac(x):
            out = np.zeros(n + 1)
            out[-1] = -1
            return out
        def margin(x):
            area, _ = areas_and_grad(x[:n])
            return area - x[-1] * area_bind
        def margin_jac(x):
            _, jac = areas_and_grad(x[:n])
            return np.column_stack((jac, -area_bind))
        start_time = perf_counter()
        constraints=[{'type': 'eq', 'fun': lambda x: eq_jac @ x - 1,
                      'jac': lambda x: eq_jac},
                     {'type': 'ineq', 'fun': lambda x: dom_jac @ x,
                      'jac': lambda x: dom_jac},
                     {'type': 'ineq', 'fun': margin, 'jac': margin_jac}]
        if alpha_values_grad:
            constraints.append({'type':'ineq',
                'fun':lambda x:alpha_values_grad(x[:n])[0]-alpha_threshold,
                'jac':lambda x:np.column_stack((alpha_values_grad(x[:n])[1],
                    np.zeros(len(alpha_indices))))})
        result = minimize(objective, x0, jac=objective_jac, method='SLSQP',
            bounds=[(0, 1)] * n + [(None, None)],
            constraints=constraints,
            options={'maxiter': 250, 'ftol': 1e-9, 'disp': False})
        w = result.x[:n]
        q, at, min_area = quality(w)
        checks = violation(w)
        feasible = all(value <= 1e-7 for value in checks.values())
        return dict(start=label, solverSuccess=bool(result.success),
                    solverStatus=int(result.status), message=str(result.message),
                    iterations=int(result.nit), timingMs=(perf_counter()-start_time)*1000,
                    feasible=bool(feasible), margin=q, limitingRow=at,
                    minimumArea=min_area, constraintViolation=checks,
                    l1FromW2=float(np.sum(np.abs(w - w2))), weights=w.tolist())

    preselected = payload.get('preselected')
    if preselected is None:
        starts = payload['starts']
        assert len(starts) <= 4
        results = [p1_run(row['name'], np.asarray(row['weights'], dtype=float))
                   for row in starts]
        feasible = [row for row in results if row['feasible']]
        feasible.sort(key=lambda row: (-round(row['margin'], 8),
            round(row['l1FromW2'], 8), tuple(round(v, 8) for v in row['weights'])))
        selected = feasible[0] if feasible else None
    else:
        assert not payload['starts']
        results = []
        w = np.asarray(preselected, dtype=float)
        q, at, min_area = quality(w)
        checks = violation(w)
        selected = dict(start='PEW', weights=w.tolist(), margin=q,
                        limitingRow=at, minimumArea=min_area,
                        feasible=bool(all(v <= 1e-7 for v in checks.values())))
        assert selected['feasible']
    p2 = None
    if selected and selected['margin'] > 0 and payload.get('runP2', True):
        # Exact L1 epigraph. Keep a strictly positive area floor; this is a
        # separate local minimization, not a certificate of minimal distance.
        initial = np.asarray(selected['weights'])
        x0 = np.r_[initial, np.abs(initial - w2) + 1e-6]
        def p2_objective(x): return float(np.sum(x[n:]))
        def p2_jac(x): return np.r_[np.zeros(n), np.ones(n)]
        required_area = (selected['margin'] - 1e-8) * area_bind if alpha \
            else objective_margin_floor
        def p2_area(x): return areas_and_grad(x[:n])[0] - required_area
        def p2_area_jac(x):
            return np.column_stack((areas_and_grad(x[:n])[1],
                np.zeros((len(area_bind), n))))
        equality_jac = np.column_stack((eq_jac[:, :n], np.zeros((len(triples), n))))
        dominance_jac = np.column_stack((dom_jac[:, :n], np.zeros((len(dominance), n))))
        deviation_jac = np.vstack((np.column_stack((-np.eye(n), np.eye(n))),
                                   np.column_stack((np.eye(n), np.eye(n)))))
        start_time = perf_counter()
        p2_constraints=[{'type': 'eq', 'fun': lambda x: equality_jac @ x - 1,
                          'jac': lambda x: equality_jac},
                         {'type': 'ineq', 'fun': lambda x: dominance_jac @ x,
                          'jac': lambda x: dominance_jac},
                         {'type': 'ineq', 'fun': p2_area, 'jac': p2_area_jac},
                         {'type': 'ineq', 'fun': lambda x: deviation_jac @ x
                              + np.r_[w2, -w2], 'jac': lambda x: deviation_jac}]
        if alpha_values_grad:
            p2_constraints.append({'type':'ineq',
                'fun':lambda x:alpha_values_grad(x[:n])[0]-alpha_threshold,
                'jac':lambda x:np.column_stack((alpha_values_grad(x[:n])[1],
                    np.zeros((len(alpha_indices),n))))})
        result = minimize(p2_objective, x0, jac=p2_jac, method='SLSQP',
            bounds=[(0, 1)] * n + [(0, None)] * n,
            constraints=p2_constraints,
            options={'maxiter': 250, 'ftol': 1e-9, 'disp': False})
        w = result.x[:n]
        q, at, min_area = quality(w)
        checks = violation(w)
        epigraph = float(np.max(np.maximum(0, np.abs(w-w2)-result.x[n:])))
        p2 = dict(solverSuccess=bool(result.success), solverStatus=int(result.status),
                  message=str(result.message), iterations=int(result.nit),
                  timingMs=(perf_counter()-start_time)*1000,
                  feasible=bool(all(v <= 1e-7 for v in checks.values())
                      and epigraph <= 1e-7), margin=q, limitingRow=at,
                  minimumArea=min_area, constraintViolation=checks,
                  epigraphViolation=epigraph,
                  l1FromW2=float(np.sum(np.abs(w-w2))), weights=w.tolist())
    return dict(constructionMs=construction_ms, poses=[p['name'] for p in poses],
                starts=results, selectedStart=selected['start'] if selected else None,
                selected=selected, p2=p2)


if __name__ == '__main__':
    print(json.dumps(solve(json.load(sys.stdin)), separators=(',', ':'), allow_nan=False))
