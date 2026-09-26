/**
 * Atomic finish boundary for the existing CAF-owned static Bind gesture.
 * Preview remains outside this helper; callers provide the established asset snapshot,
 * generator, CAF History recorder, and snapshot restore route.
 */
export function runStaticRigBindRebindTransaction({
    regenerate,
    captureAfterState,
    recordHistory,
    rollback
} = {}) {
    const now = () => globalThis.performance?.now?.() ?? Date.now();
    const startedAt = now();
    let result;
    try {
        result = regenerate?.();
    } catch (error) {
        result = { ok: false, reason: error?.message || 'AUTO GRID再生成中に例外が発生しました。' };
    }
    const regenerationMs = Math.max(0, now() - startedAt);

    const fail = reason => {
        let rolledBack = false;
        try {
            rolledBack = rollback?.() === true;
        } catch {
            rolledBack = false;
        }
        return { ok: false, reason, rolledBack, regenerationMs };
    };

    if (!result?.ok) return fail(result?.reason || 'AUTO GRID再生成に失敗しました。');

    let afterState;
    try {
        afterState = captureAfterState?.();
    } catch (error) {
        return fail(error?.message || 'CAF Asset History用の状態を取得できません。');
    }
    if (!afterState) return fail('CAF Asset History用の状態を取得できません。');

    let recorded = false;
    try {
        recorded = recordHistory?.(afterState) === true;
    } catch (error) {
        return fail(error?.message || 'CAF Asset Historyへ記録できません。');
    }
    if (!recorded) return fail('CAF Asset Historyへ1件の変更を記録できません。');

    return { ok: true, result, afterState, regenerationMs };
}
