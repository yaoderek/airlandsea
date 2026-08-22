// Renders a redacted view (from engine.viewFor) and turns clicks into actions.
// Stateless apart from the current hand selection; re-rendered on every update.

import { byId, ICONS, THEATER_ART, cap } from './cards.js';
import { strength, canPlayFaceUp, faceDownValue } from './engine.js';

let sel = null;        // selected hand card id
let lastView = null;
let ctx = null;        // { me, names, send(action), onRestart|null }
let wired = false;

const $ = q => document.querySelector(q);
const esc = s => String(s).replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function render(view, context) {
  lastView = view;
  ctx = context;
  wire();
  if (sel && !view.hands[ctx.me].includes(sel)) sel = null;
  const mine = myMove(view);
  $('#topbar').innerHTML = topbarHTML(view, mine);
  $('#board').innerHTML = boardHTML(view, mine);
  $('#handbar').innerHTML = handbarHTML(view, mine);
  $('#log').innerHTML = logHTML(view);
  renderOverlay(view);
}

export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function myMove(view) {
  if (view.phase !== 'battle') return false;
  return view.pending ? view.pending.player === ctx.me : view.turn === ctx.me;
}

function pendingTargets(view) {
  if (!view.pending || view.pending.player !== ctx.me) return { refs: [], lanes: [] };
  const pd = view.pending;
  if (pd.type === 'reinforce' || pd.type === 'transport-dest') return { refs: [], lanes: pd.options };
  return { refs: pd.options || [], lanes: [] };
}

// ---------- top bar ----------

function topbarHTML(view, mine) {
  const me = ctx.me, opp = 1 - me;
  const status = statusText(view, mine);
  return `
    <div class="brand"><span class="t-air">AIR</span><span class="dot">·</span><span class="t-land">LAND</span><span class="dot">·</span><span class="t-sea">SEA</span></div>
    <div class="scorebox">
      ${vpHTML(ctx.names[me], view.vp[me], true)}
      <div class="battle-no">Battle ${view.battle}<span class="deck-ct">deck ${view.deckCount}</span></div>
      ${vpHTML(ctx.names[opp], view.vp[opp], false)}
    </div>
    <div class="status ${mine ? 'status-mine' : ''}">${esc(status)}</div>`;
}

function vpHTML(name, vp, isMe) {
  let pips = '';
  for (let i = 0; i < 12; i++) pips += `<i class="${i < vp ? 'on' : ''}"></i>`;
  return `<div class="vp ${isMe ? 'vp-me' : ''}"><b>${esc(name)}</b><span class="pips">${pips}</span><em>${vp}</em></div>`;
}

function statusText(view, mine) {
  const opp = ctx.names[1 - ctx.me];
  if (view.phase === 'gameOver') return `${ctx.names[view.winner]} won the war`;
  if (view.phase === 'battleOver') return 'Battle complete';
  if (view.pending) {
    return view.pending.player === ctx.me
      ? view.pending.label || 'Resolve your card'
      : `${opp} is resolving a card…`;
  }
  if (mine) return view.airDrop[ctx.me] ? 'Your move — Air Drop is active (deploy anywhere)' : 'Your move';
  return `Waiting for ${opp}…`;
}

// ---------- board ----------

function boardHTML(view, mine) {
  const { refs, lanes } = pendingTargets(view);
  return view.order.map(t => laneHTML(view, t, mine, refs, lanes)).join('');
}

function laneHTML(view, t, mine, refs, lanes) {
  const me = ctx.me, opp = 1 - me;
  const sMe = strength(view, t, me);
  const sOpp = strength(view, t, opp);
  const leader = sMe === sOpp ? view.first : (sMe > sOpp ? me : opp);
  const laneTarget = lanes.includes(t);
  const showPlay = mine && !view.pending && sel;
  const c = sel ? byId[sel] : null;

  const oppStrips = view.board[t][opp].map((_, i) => stripHTML(view, t, opp, i, refs)).join('');
  const myStrips = view.board[t][me].map((_, i) => stripHTML(view, t, me, i, refs)).join('');

  return `
  <div class="lane th-${t} ${laneTarget ? 'lane-target' : ''}" data-lane="${t}">
    <div class="zone zone-opp">${oppStrips}</div>
    <div class="tile ${laneTarget ? 'target' : ''}" data-tile="${t}">
      <svg class="tile-art" viewBox="0 0 120 40" aria-hidden="true">${THEATER_ART[t]}</svg>
      <div class="tile-name">${t.toUpperCase()}</div>
      <div class="tile-score">
        <span class="${leader === opp ? 'lead' : ''}">${sOpp}</span>
        <i>vs</i>
        <span class="${leader === me ? 'lead' : ''}">${sMe}</span>
      </div>
      ${showPlay ? playBtnsHTML(view, c, t) : ''}
      ${laneTarget ? '<div class="tile-hint">Choose this lane</div>' : ''}
    </div>
    <div class="zone zone-me">${myStrips}</div>
  </div>`;
}

function playBtnsHTML(view, c, t) {
  const up = canPlayFaceUp(view, ctx.me, c, t);
  return `<div class="playbtns">
    ${up ? `<button class="pb pb-up" data-play="up" data-lane="${t}">▲ Deploy</button>` : ''}
    <button class="pb pb-down" data-play="down" data-lane="${t}">▼ Improvise</button>
  </div>`;
}

function stripHTML(view, t, owner, i, refs) {
  const e = view.board[t][owner][i];
  const uncov = i === view.board[t][owner].length - 1;
  const target = refs.some(o => o.t === t && o.p === owner && o.i === i);
  const ref = esc(JSON.stringify({ t, p: owner, i }));
  const cls = `strip ${uncov ? 'uncov' : ''} ${target ? 'target' : ''}`;
  if (e.faceUp) {
    const c = byId[e.id];
    return `<div class="${cls} faceup th-${c.theater}" data-ref="${ref}" title="${esc(c.text)}">
      <span class="s-str">${c.str}</span><span class="s-name">${esc(c.name)}</span>
      <svg class="s-icon" viewBox="0 0 48 48" aria-hidden="true">${ICONS[c.name]}</svg>
    </div>`;
  }
  const known = e.id ? byId[e.id] : null;
  const val = faceDownValue(view, owner);
  return `<div class="${cls} fd" data-ref="${ref}" title="Face-down: worth ${val}, any lane">
    <span class="s-str">${val}</span>
    <span class="s-name">${known ? esc(known.name) + ' (down)' : 'Face-down'}</span>
    <span class="s-star">★</span>
  </div>`;
}

// ---------- hand bar ----------

function handbarHTML(view, mine) {
  const me = ctx.me;
  const pd = view.pending && view.pending.player === me ? view.pending : null;
  const canAct = mine && !view.pending;
  const oppCards = view.hands[1 - me].length;

  let banner = '';
  if (pd) {
    const peek = pd.type === 'reinforce' && pd.card
      ? ` — top card: <b>${esc(byId[pd.card].name)} (${byId[pd.card].str})</b>` : '';
    banner = `<div class="banner">
      <span>${esc(pd.label || 'Resolve your card')}${peek}</span>
      ${pd.skippable ? '<button id="btn-skip">Skip</button>' : ''}
    </div>`;
  }

  const cards = view.hands[me].map(id => handCardHTML(byId[id], canAct)).join('');
  return `
    ${banner}
    <div class="hand-row">
      <div class="hand ${canAct ? '' : 'hand-idle'}">${cards}</div>
      <div class="side">
        <div class="opp-hand" title="Opponent's hand">${'▮'.repeat(oppCards)}<span>${oppCards}</span></div>
        <button id="btn-withdraw" ${canAct ? '' : 'disabled'}>Withdraw…</button>
      </div>
    </div>`;
}

function handCardHTML(c, canAct) {
  return `<div class="card th-${c.theater} ${sel === c.id ? 'sel' : ''} ${canAct ? 'canact' : ''}" data-card="${c.id}">
    <div class="c-top"><span class="c-str">${c.str}</span><span class="c-name">${esc(c.name)}</span></div>
    <svg class="c-icon" viewBox="0 0 48 48" aria-hidden="true">${ICONS[c.name]}</svg>
    <div class="c-theater">${c.theater.toUpperCase()}</div>
    <div class="c-text">${esc(c.text)}</div>
  </div>`;
}

// ---------- log / overlay ----------

function logHTML(view) {
  const rows = view.log.slice(-30).map(l => `<div>${esc(l)}</div>`).join('');
  return `<h3>Dispatches</h3><div class="log-rows">${rows}</div>`;
}

function renderOverlay(view) {
  const el = $('#overlay');
  if (view.phase === 'battle') { el.hidden = true; return; }
  const r = view.result;
  const rows = r.theaters.map(th => `
    <tr class="${th.winner === ctx.me ? 'won' : ''}">
      <td class="th-${th.t}">${cap(th.t)}</td>
      <td>${ctx.me === 0 ? th.s0 : th.s1}</td>
      <td>${ctx.me === 0 ? th.s1 : th.s0}</td>
      <td>${esc(ctx.names[th.winner])}</td>
    </tr>`).join('');
  const headline = view.phase === 'gameOver'
    ? `${esc(ctx.names[view.winner])} won the war ${view.vp[ctx.me]}–${view.vp[1 - ctx.me]}`
    : `${esc(ctx.names[r.winner])} takes battle ${r.battle} (+${r.vp} VP)`;
  const btn = view.phase === 'gameOver'
    ? (ctx.onRestart ? '<button id="btn-restart">New war</button>' : '<p class="muted">Ask the host to start a new war.</p>')
    : `<button id="btn-next" data-battle="${r.battle}">Next battle</button>`;
  el.innerHTML = `<div class="panel">
    <h2>${headline}</h2>
    <p class="muted">${esc(r.reason)}</p>
    <table><tr><th>Lane</th><th>You</th><th>${esc(ctx.names[1 - ctx.me])}</th><th>Held by</th></tr>${rows}</table>
    <p class="score-line">Victory points: you ${view.vp[ctx.me]} — ${view.vp[1 - ctx.me]} ${esc(ctx.names[1 - ctx.me])}</p>
    ${btn}
  </div>`;
  el.hidden = false;
}

// ---------- events (delegated once) ----------

function wire() {
  if (wired) return;
  wired = true;

  $('#board').addEventListener('click', ev => {
    if (!lastView || !myMove(lastView)) return;
    const pb = ev.target.closest('.pb');
    if (pb && sel) {
      ctx.send({ t: 'play', card: sel, theater: pb.dataset.lane, faceDown: pb.dataset.play === 'down' });
      sel = null;
      return;
    }
    const strip = ev.target.closest('.strip.target');
    if (strip) { ctx.send({ t: 'pick', ref: JSON.parse(strip.dataset.ref) }); return; }
    const tile = ev.target.closest('.tile.target');
    if (tile) { ctx.send({ t: 'pick', theater: tile.dataset.tile }); }
  });

  $('#handbar').addEventListener('click', ev => {
    if (ev.target.id === 'btn-skip') { ctx.send({ t: 'skip' }); return; }
    if (ev.target.id === 'btn-withdraw') {
      if (confirm('Withdraw from this battle? Your opponent will score victory points.')) {
        ctx.send({ t: 'withdraw' });
      }
      return;
    }
    const card = ev.target.closest('.card.canact');
    if (card && lastView) {
      sel = sel === card.dataset.card ? null : card.dataset.card;
      render(lastView, ctx);
    }
  });

  $('#overlay').addEventListener('click', ev => {
    if (ev.target.id === 'btn-next') {
      ctx.send({ t: 'next', battle: Number(ev.target.dataset.battle) });
    } else if (ev.target.id === 'btn-restart' && ctx.onRestart) {
      ctx.onRestart();
    }
  });
}
