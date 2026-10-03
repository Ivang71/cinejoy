// Local comment threads, one per title. Stored in localStorage; requires a local sign-in to post.
import { auth } from './auth.js';
import { icon } from './icons.js';
import { esc } from './components.js';

const KEY = 'cinejoy::comments::v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } };
const uid = () => Math.random().toString(36).slice(2, 10);

export function ago(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}
const score = c => (c.up?.length || 0) - (c.down?.length || 0);

export const commentStore = {
  list(key) { return read()[key] || []; },
  add(key, c) { const all = read(); all[key] = [...(all[key] || []), c]; write(all); },
  remove(key, id) { const all = read(); all[key] = (all[key] || []).filter(c => c.id !== id && c.parent !== id); write(all); },
  vote(key, id, dir, user) {
    const all = read(); const list = all[key] || [];
    const c = list.find(x => x.id === id); if (!c) return;
    c.up = (c.up || []).filter(u => u !== user); c.down = (c.down || []).filter(u => u !== user);
    const had = (dir === 'up' ? (c._prevUp) : (c._prevDown));
    delete c._prevUp; delete c._prevDown;
    if (!had) (dir === 'up' ? c.up : c.down).push(user);
    write(all);
  },
  voteToggle(key, id, dir, user) {
    const all = read(); const c = (all[key] || []).find(x => x.id === id); if (!c) return;
    c.up = c.up || []; c.down = c.down || [];
    const arr = dir === 'up' ? c.up : c.down; const other = dir === 'up' ? c.down : c.up;
    const i = arr.indexOf(user); if (i >= 0) arr.splice(i, 1); else { arr.push(user); const j = other.indexOf(user); if (j >= 0) other.splice(j, 1); }
    write(all);
  },
};

function commentHtml(c, key, me, replies, depth = 0) {
  const mine = me && c.user === me;
  const myVote = me && (c.up || []).includes(me) ? 'up' : me && (c.down || []).includes(me) ? 'down' : null;
  const size = depth ? 28 : 34;
  return `
  <article class="comment${depth ? ' is-reply' : ''}" data-id="${c.id}">
    <div class="avatar" style="width:${size}px;height:${size}px;font-size:${depth ? 12 : 14}px">${esc((c.name || '?')[0].toUpperCase())}</div>
    <div style="flex:1;min-width:0">
      <div class="who"><b>${esc(c.name)}</b><time>${ago(c.at)}</time>${mine ? '<span class="you">you</span>' : ''}</div>
      <p class="body">${esc(c.text)}</p>
      <div class="acts">
        <span class="vote"><button data-cm="vote" data-dir="up" class="${myVote === 'up' ? 'is-on' : ''}" aria-label="Upvote">${icon('upvote', 15)}</button><span class="tabular score">${score(c)}</span><button data-cm="vote" data-dir="down" class="${myVote === 'down' ? 'is-on' : ''}" aria-label="Downvote">${icon('downvote', 15)}</button></span>
        ${depth ? '' : `<button data-cm="reply" aria-label="Reply to ${esc(c.name)}">${icon('message', 15)}<span>Reply</span></button>`}
        ${mine ? `<button data-cm="delete" aria-label="Delete comment">${icon('trash', 15)}</button>` : ''}
      </div>
      <div class="reply-slot"></div>
      ${replies?.length ? `<div class="replies">${replies.map(r => commentHtml(r, key, me, [], 1)).join('')}</div>` : ''}
    </div>
  </article>`;
}

export function commentsSection(key) {
  return `<section class="section comments" id="comments" data-key="${esc(key)}" aria-label="Comments"></section>`;
}

export function mountComments(root, key, { onLogin } = {}) {
  const host = root.querySelector('#comments'); if (!host) return () => {};
  let sort = 'newest'; let composerOpen = false;
  const render = () => {
    const me = auth.user?.id || null; const all = commentStore.list(key);
    const top = all.filter(c => !c.parent);
    top.sort((a, b) => sort === 'oldest' ? a.at - b.at : sort === 'top' ? score(b) - score(a) || b.at - a.at : b.at - a.at);
    const byParent = {}; all.filter(c => c.parent).forEach(c => (byParent[c.parent] ||= []).push(c));
    host.innerHTML = `
      <div class="section-head"><h2 class="section-title">Comments <span class="count tabular">(${all.length})</span></h2>
        <div class="dropdown" data-dd="cm-sort"><button class="comments-sort" data-cm="sort-toggle" aria-haspopup="listbox">${sort === 'top' ? 'Top' : sort === 'oldest' ? 'Oldest' : 'Newest'} ${icon('chevronDown', 14)}</button>
          <div class="dropdown-menu align-right" role="listbox">${[['newest', 'Newest'], ['oldest', 'Oldest'], ['top', 'Top']].map(([v, l]) => `<button role="option" data-cm="sort" data-v="${v}" class="${sort === v ? 'is-selected' : ''}"><span>${l}</span></button>`).join('')}</div></div>
      </div>
      ${composerOpen && me ? `
        <div class="composer-open"><div class="avatar" style="width:34px;height:34px">${esc((auth.displayName() || '?')[0].toUpperCase())}</div>
          <div style="flex:1"><textarea id="cm-text" rows="3" maxlength="1200" placeholder="Add a comment…" aria-label="Comment text"></textarea>
          <div class="composer-acts"><span class="hint tabular" id="cm-count">0 / 1200</span><span style="flex:1"></span><button class="pill-btn" data-cm="cancel">Cancel</button><button class="pill-btn is-primary" data-cm="post" disabled>Post</button></div></div></div>`
      : `<button class="composer" data-cm="open"><span>${me ? 'Add a comment…' : 'Login to leave a comment.'}</span></button>`}
      ${all.length ? `<div class="comment-list">${top.map(c => commentHtml(c, key, me, (byParent[c.id] || []).sort((a, b) => a.at - b.at))).join('')}</div>` : `<div class="comments-empty"><span>No comments yet. Be the first to start the conversation.</span></div>`}`;
    const ta = host.querySelector('#cm-text'); if (ta) { ta.focus(); }
  };
  const requireLogin = () => { if (auth.signedIn) return true; onLogin?.(); return false; };
  const onClick = e => {
    const el = e.target.closest('[data-cm]'); if (!el) return; const act = el.dataset.cm; const me = auth.user?.id;
    if (act === 'open') { if (!requireLogin()) return; composerOpen = true; render(); }
    else if (act === 'cancel') { composerOpen = false; render(); }
    else if (act === 'post') { const ta = host.querySelector('#cm-text'); const text = ta.value.trim(); if (!text || !requireLogin()) return; commentStore.add(key, { id: uid(), user: me, name: auth.displayName(), text, at: Date.now(), up: [], down: [] }); composerOpen = false; render(); }
    else if (act === 'sort-toggle') { e.stopPropagation(); host.querySelector('.dropdown').classList.toggle('is-open'); }
    else if (act === 'sort') { sort = el.dataset.v; render(); }
    else if (act === 'vote') { if (!requireLogin()) return; commentStore.voteToggle(key, el.closest('.comment').dataset.id, el.dataset.dir, me); render(); }
    else if (act === 'delete') { const id = el.closest('.comment').dataset.id; if (confirm('Delete this comment?')) { commentStore.remove(key, id); render(); } }
    else if (act === 'reply') {
      if (!requireLogin()) return; const art = el.closest('.comment'); const slot = art.querySelector('.reply-slot');
      if (slot.firstChild) { slot.innerHTML = ''; return; }
      slot.innerHTML = `<div class="composer-open is-reply"><div style="flex:1"><textarea rows="2" maxlength="1200" placeholder="Write a reply…" aria-label="Reply text"></textarea><div class="composer-acts"><span style="flex:1"></span><button class="pill-btn" data-cm="reply-cancel">Cancel</button><button class="pill-btn is-primary" data-cm="reply-post" disabled>Reply</button></div></div></div>`;
      slot.querySelector('textarea').focus();
    }
    else if (act === 'reply-cancel') { el.closest('.reply-slot').innerHTML = ''; }
    else if (act === 'reply-post') { const art = el.closest('.comment'); const text = art.querySelector('.reply-slot textarea').value.trim(); if (!text) return; commentStore.add(key, { id: uid(), parent: art.dataset.id, user: me, name: auth.displayName(), text, at: Date.now(), up: [], down: [] }); render(); }
  };
  const onInput = e => {
    const ta = e.target.closest('textarea'); if (!ta) return; const btn = ta.closest('.composer-open').querySelector('[data-cm="post"],[data-cm="reply-post"]'); if (btn) btn.disabled = !ta.value.trim();
    const cnt = host.querySelector('#cm-count'); if (cnt && ta.id === 'cm-text') cnt.textContent = `${ta.value.length} / 1200`;
  };
  const onKey = e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { const b = e.target.closest('.composer-open')?.querySelector('[data-cm="post"],[data-cm="reply-post"]'); if (b && !b.disabled) b.click(); } };
  host.addEventListener('click', onClick); host.addEventListener('input', onInput); host.addEventListener('keydown', onKey);
  const offAuth = auth.subscribe(() => render());
  render();
  return () => { host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); host.removeEventListener('keydown', onKey); offAuth(); };
}
