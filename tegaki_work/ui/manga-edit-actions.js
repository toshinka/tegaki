/** ROLE: Shared fixed entry/commit rows for manga tools and QTP tone.
 * AUTHORITY: Moves existing controls; handlers, recipes and History stay with each tool.
 * ORDER: Re-edit/reset -> optional output -> apply/update. No duplicate action buttons.
 */
export function mountMangaEditActions(root, { before, resetAction = 'reset', aux = null, error = null } = {}) {
    const bar = document.createElement('div');
    bar.className = 'manga-edit-actions';
    const entry = document.createElement('div');
    entry.className = 'manga-edit-actions__entry';
    const commit = document.createElement('div');
    commit.className = 'manga-edit-actions__commit';
    const move = (action, target, label) => {
        const button = root.querySelector(`[data-action="${action}"]`);
        if (!button) return;
        if (label) button.textContent = label;
        target.append(button);
    };
    move('load-active', entry, '再編集');
    move(resetAction, entry, resetAction === 'new' ? '新規' : '初期化');
    move('cancel', entry);
    move('apply', commit, '新規に適用');
    move('update', commit, '更新');
    const status = root.querySelector('[data-role="edit-status"]');
    if (status) { status.classList.add('manga-edit-actions__status'); commit.append(status); }
    bar.append(entry);
    if (aux) bar.append(aux);
    bar.append(commit);
    if (error) bar.append(error);
    root.insertBefore(bar, before || root.querySelector('.manga-tabs-host')?.nextSibling || root.firstChild);
    root.querySelector(':scope > .pl-title')?.remove();
    root.querySelectorAll('.pl-footer').forEach(row => { if (!row.childElementCount) row.remove(); });
    root.querySelectorAll('.pl-fixed-footer, .fl-fixed-footer').forEach(row => { if (!row.childElementCount) row.remove(); });
    return bar;
}
