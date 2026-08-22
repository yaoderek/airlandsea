// Pure rules engine. State is a plain JSON-serializable object; the host (or
// hotseat screen) owns it and mutates it through applyAction. No DOM here.

import { DECKS, byId, THEATERS, cap } from './cards.js';

// VP the opponent scores when a player withdraws, based on how many cards the
// withdrawing player still holds. The player with initiative pays more for
// hanging on longer. Entries are [minCardsLeft, vp], checked in order.
export const WITHDRAW_VP = {
  first:  [[4, 2], [2, 3], [1, 4], [0, 6]],
  second: [[5, 2], [3, 3], [2, 4], [0, 6]],
};

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(seed, deckName = 'classic') {
  const st = {
    seed: seed >>> 0,
    deckName: DECKS[deckName] ? deckName : 'classic',
    vp: [0, 0],
    battle: 1,
    first: (seed >>> 0) % 2,
    order: [...THEATERS],
    phase: 'battle',
    winner: null,
    result: null,
    log: [],
  };
  deal(st);
  return st;
}

function deal(st) {
  const rng = mulberry32((st.seed ^ (st.battle * 0x9E3779B9)) >>> 0);
  const ids = DECKS[st.deckName].map(c => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  st.hands = [ids.slice(0, 6), ids.slice(6, 12)];
  st.deck = ids.slice(12);
  st.discard = [];
  st.board = {};
  for (const t of st.order) st.board[t] = [[], []];
  st.turn = st.first;
  st.pending = null;
  st.stack = [];
  st.extraFor = null;
  st.airDrop = [false, false];
  st.phase = 'battle';
  st.result = null;
  addLog(st, `— Battle ${st.battle}: ${st.order.map(cap).join(' · ')}. P${st.first + 1} has initiative.`);
}

function addLog(st, msg) {
  st.log.push(msg);
  if (st.log.length > 80) st.log.shift();
}

export const activePlayer = st => (st.pending ? st.pending.player : st.turn);

export function adjacent(st, t) {
  const i = st.order.indexOf(t);
  return [st.order[i - 1], st.order[i + 1]].filter(Boolean);
}

function* allStacks(st) {
  for (const t of st.order) for (const p of [0, 1]) yield { t, p, stack: st.board[t][p] };
}

// Ongoing abilities are live while their card is face-up. owner=null matches either player.
export function hasEffect(st, effect, owner = null) {
  for (const { p, stack } of allStacks(st)) {
    if (owner !== null && p !== owner) continue;
    for (const e of stack) if (e.faceUp && byId[e.id].effect === effect) return true;
  }
  return false;
}

// Face-up card with the given effect owned by `p` sitting in lane `t`.
function laneEffect(st, effect, t, p) {
  return st.board[t][p].some(e => e.faceUp && byId[e.id].effect === effect);
}

function blockadedTheaters(st) {
  const set = new Set();
  for (const { t, stack } of allStacks(st)) {
    for (const e of stack) {
      if (e.faceUp && byId[e.id].effect === 'blockade') {
        for (const a of adjacent(st, t)) set.add(a);
      }
    }
  }
  return set;
}

export function faceDownValue(st, p) {
  return hasEffect(st, 'escalation', p) ? 4 : 2;
}

export function strength(st, t, p) {
  const stk = st.board[t][p];
  let total = 0;
  const cfi = stk.findIndex(e => e.faceUp && byId[e.id].effect === 'coverfire');
  const fd = faceDownValue(st, p);
  stk.forEach((e, i) => {
    if (cfi >= 0 && i < cfi) total += 4;         // covered by Cover Fire
    else if (!e.faceUp) total += fd;
    else if (byId[e.id].effect === 'trench' && i < stk.length - 1) total += 4; // Trench Line, covered
    else total += byId[e.id].str;
  });
  for (const a of adjacent(st, t)) {
    for (const e of st.board[a][p]) {
      if (e.faceUp && byId[e.id].aura) total += byId[e.id].aura; // Support / Flagship
    }
  }
  return total;
}

// House rule: Containment and Blockade prevent plays rather than destroying
// the played card. A lane is closed if a Blockade watches it and it already
// holds 3+ cards (both players combined).
export function laneOpen(st, t) {
  const occupied = st.board[t][0].length + st.board[t][1].length;
  return !(occupied >= 3 && blockadedTheaters(st).has(t));
}

export function canPlayFaceDown(st, t) {
  return laneOpen(st, t) && !hasEffect(st, 'containment');
}

export function canPlayFaceUp(st, p, card, t) {
  if (!laneOpen(st, t)) return false;
  if (laneEffect(st, 'nofly', t, 1 - p)) return false; // enemy No-Fly Zone
  if (card.theater === t) return true;
  if (st.airDrop[p]) return true;
  if (card.str <= 3 && hasEffect(st, 'aerodrome', p)) return true;
  return false;
}

function uncoveredRefs(st, { theaters = null, owner = null } = {}) {
  const out = [];
  for (const { t, p, stack } of allStacks(st)) {
    if (theaters && !theaters.includes(t)) continue;
    if (owner !== null && p !== owner) continue;
    if (stack.length) out.push({ t, p, i: stack.length - 1 });
  }
  return out;
}

function ownRefs(st, p, { faceDownOnly = false } = {}) {
  const out = [];
  for (const t of st.order) {
    st.board[t][p].forEach((e, i) => {
      if (faceDownOnly && e.faceUp) return;
      out.push({ t, p, i });
    });
  }
  return out;
}

const sameRef = (a, b) => a && b && a.t === b.t && a.p === b.p && a.i === b.i;

// Applies an action for `actor` (0 or 1). Mutates st. Returns an error string
// for illegal actions (state untouched in that case), or null on success.
export function applyAction(st, actor, a) {
  if (st.phase === 'gameOver') return 'The war is over.';
  if (a.t === 'next') {
    if (st.phase !== 'battleOver') return 'No finished battle to advance.';
    if (a.battle !== st.battle) return null; // stale duplicate click; ignore
    st.battle += 1;
    st.first = 1 - st.first;
    st.order.unshift(st.order.pop()); // rightmost lane rotates to the far left
    deal(st);
    return null;
  }
  if (st.phase !== 'battle') return 'The battle is over.';
  if (st.pending) {
    if (actor !== st.pending.player) return 'Waiting on the other player.';
    return resolvePending(st, a);
  }
  if (actor !== st.turn) return 'Not your turn.';
  if (a.t === 'withdraw') return withdraw(st, actor);
  if (a.t === 'play') return play(st, actor, a);
  return 'Unknown action.';
}

function play(st, p, a) {
  const hi = st.hands[p].indexOf(a.card);
  if (hi < 0) return 'That card is not in your hand.';
  const c = byId[a.card];
  const t = a.theater;
  if (!st.order.includes(t)) return 'Unknown lane.';
  if (!laneOpen(st, t)) return `Blockade: ${cap(t)} is full and can't be played into.`;
  if (!a.faceDown && laneEffect(st, 'nofly', t, 1 - p)) {
    return `No-Fly Zone: you can't play face-up into ${cap(t)}.`;
  }
  if (a.faceDown && hasEffect(st, 'containment')) {
    return 'Containment prevents face-down plays.';
  }
  if (!a.faceDown && !canPlayFaceUp(st, p, c, t)) {
    return `${c.name} can only deploy face-up to ${cap(c.theater)}.`;
  }
  st.airDrop[p] = false; // a pending Air Drop is spent by your next play, used or not
  st.hands[p].splice(hi, 1);

  st.board[t][p].push({ id: c.id, faceUp: !a.faceDown });
  addLog(st, a.faceDown
    ? `P${p + 1} improvised a face-down card to ${cap(t)}.`
    : `P${p + 1} deployed ${c.name} (${c.str}) to ${cap(t)}.`);

  if (!a.faceDown && c.kind === 'instant') pushInstant(st, p, c, t);
  return pump(st);
}

// Queues an instant ability as a frame on the effect stack. Effects that need
// no choice apply immediately and push nothing.
function pushInstant(st, p, c, t) {
  switch (c.effect) {
    case 'airdrop':
      st.airDrop[p] = true;
      return;
    case 'flip-adjacent':
      st.stack.push({ type: 'flip', mode: 'adjacent', player: p, source: t, skippable: true,
        label: `${c.name}: flip an uncovered card in an adjacent lane` });
      return;
    case 'flip-any':
      st.stack.push({ type: 'flip', mode: 'any', player: p, source: t, skippable: true,
        label: `${c.name}: flip any uncovered card` });
      return;
    case 'flip-lane':
      st.stack.push({ type: 'flip', mode: 'lane', player: p, source: t, skippable: true,
        label: `${c.name}: flip an uncovered card in this lane` });
      return;
    case 'disrupt':
      st.stack.push({ type: 'disrupt', player: p, first: p, stage: 0, skippable: false });
      return;
    case 'reinforce': {
      // The reinforcement is a face-down play, so Containment/Blockade rules apply.
      const options = hasEffect(st, 'containment') ? []
        : adjacent(st, t).filter(x => laneOpen(st, x));
      if (st.deck.length && options.length) {
        st.stack.push({ type: 'reinforce', player: p, card: st.deck[0],
          options, skippable: true,
          label: 'Reinforce: play the top deck card face-down to an adjacent lane' });
      }
      return;
    }
    case 'transport':
      st.stack.push({ type: 'transport-pick', player: p, skippable: true,
        label: 'Transport: choose one of your cards to move' });
      return;
    case 'redeploy':
      st.stack.push({ type: 'redeploy', player: p, skippable: true,
        label: 'Redeploy: return a face-down card to hand and take another turn' });
      return;
    case 'selfmove':
      st.stack.push({ type: 'transport-dest', player: p,
        from: { t, p, i: st.board[t][p].length - 1 },
        options: st.order.filter(x => x !== t), skippable: true,
        label: `${c.name}: move this card to another lane` });
      return;
    case 'shove': {
      const enemy = st.board[t][1 - p];
      const adj = adjacent(st, t);
      if (enemy.length && adj.length) {
        st.stack.push({ type: 'transport-dest', player: p,
          from: { t, p: 1 - p, i: enemy.length - 1 },
          options: adj, skippable: true,
          label: `${c.name}: push the enemy uncovered card to an adjacent lane` });
      }
      return;
    }
    case 'strafe': {
      const enemy = st.board[t][1 - p];
      if (enemy.length && enemy[enemy.length - 1].faceUp
          && !laneEffect(st, 'flipguard', t, 1 - p)) {
        flipEntry(st, { t, p: 1 - p, i: enemy.length - 1 });
      }
      return;
    }
    case 'conscript':
      if (st.deck.length) {
        st.hands[p].push(st.deck.shift());
        addLog(st, `P${p + 1} conscripted a card from the deck into hand.`);
      }
      return;
    case 'peekhand':
      st.stack.push({ type: 'peek', player: p, ackOnly: true, skippable: true,
        cards: [...st.hands[1 - p]],
        label: "Scout Report — your opponent's hand:" });
      return;
    case 'peekdown': {
      const cards = [];
      for (const tt of st.order) {
        for (const e of st.board[tt][1 - p]) if (!e.faceUp) cards.push(e.id);
      }
      st.stack.push({ type: 'peek', player: p, ackOnly: true, skippable: true,
        cards, label: "Codebreakers — your opponent's face-down cards:" });
      return;
    }
    case 'assault':
      st.stack.push({ type: 'transport-pick', player: p, flipUp: true, skippable: true,
        label: `${c.name}: move one of your cards (face-down cards flip face-up)` });
      return;
    case 'fdmove':
      st.stack.push({ type: 'transport-pick', player: p, fdOnly: true, skippable: true,
        label: `${c.name}: move one of your face-down cards` });
      return;
  }
}

// A frame can sit on the stack while a triggered ability resolves above it
// (e.g. Disrupt waiting out a revealed Maneuver), so legal targets are
// recomputed each time a frame becomes the active one.
function activateFrame(st, f) {
  switch (f.type) {
    case 'flip': {
      let opts = f.mode === 'adjacent' ? uncoveredRefs(st, { theaters: adjacent(st, f.source) })
        : f.mode === 'lane' ? uncoveredRefs(st, { theaters: [f.source] })
        : uncoveredRefs(st);
      // Bunker Network: enemies can't flip your cards in its lane.
      opts = opts.filter(o => o.p === f.player || !laneEffect(st, 'flipguard', o.t, o.p));
      f.options = opts;
      return f.options.length > 0;
    }
    case 'disrupt':
      while (f.stage < 2) {
        const chooser = f.stage === 0 ? f.first : 1 - f.first;
        const options = uncoveredRefs(st, { owner: chooser });
        if (options.length) {
          f.player = chooser;
          f.options = options;
          f.label = 'Disrupt: flip one of your own uncovered cards';
          return true;
        }
        f.stage += 1;
      }
      return false;
    case 'transport-pick':
      f.options = ownRefs(st, f.player, { faceDownOnly: !!f.fdOnly });
      return f.options.length > 0;
    case 'redeploy':
      f.options = ownRefs(st, f.player, { faceDownOnly: true });
      return f.options.length > 0;
    case 'peek':
      return f.cards.length > 0;
    default: // reinforce, transport-dest — options fixed at creation
      return true;
  }
}

function pump(st) {
  while (st.stack.length) {
    const f = st.stack[st.stack.length - 1];
    if (activateFrame(st, f)) { st.pending = f; return null; }
    st.stack.pop();
  }
  st.pending = null;
  const extraFor = st.extraFor;
  st.extraFor = null;
  return finishTurn(st, extraFor);
}

function flipEntry(st, ref) {
  const e = st.board[ref.t][ref.p][ref.i];
  e.faceUp = !e.faceUp;
  const c = byId[e.id];
  addLog(st, e.faceUp
    ? `${c.name} (${c.str}) was flipped face-up in ${cap(ref.t)}.`
    : `P${ref.p + 1}'s ${c.name} was flipped face-down in ${cap(ref.t)}.`);
  // A card flipped face-up triggers its instant ability, resolved by its owner.
  if (e.faceUp && c.kind === 'instant') pushInstant(st, ref.p, c, ref.t);
}

function resolvePending(st, a) {
  const pd = st.pending;
  if (a.t === 'skip') {
    if (!pd.skippable) return 'That effect is mandatory.';
    st.stack.pop();
    return pump(st);
  }
  if (a.t !== 'pick') return 'Choose a target (or skip).';

  switch (pd.type) {
    case 'flip': {
      if (!pd.options.some(o => sameRef(o, a.ref))) return 'Not a legal target.';
      st.stack.pop();
      flipEntry(st, a.ref);
      return pump(st);
    }
    case 'disrupt': {
      if (!pd.options.some(o => sameRef(o, a.ref))) return 'Not a legal target.';
      pd.stage += 1;
      flipEntry(st, a.ref);
      return pump(st);
    }
    case 'reinforce': {
      if (!pd.options.includes(a.theater)) return 'Not a legal lane for the reinforcement.';
      st.stack.pop();
      const id = st.deck.shift();
      const p = pd.player;
      st.board[a.theater][p].push({ id, faceUp: false });
      addLog(st, `P${p + 1} reinforced ${cap(a.theater)} with a face-down card.`);
      return pump(st);
    }
    case 'transport-pick': {
      if (!pd.options.some(o => sameRef(o, a.ref))) return 'Not one of your cards.';
      pd.type = 'transport-dest';
      pd.from = a.ref;
      pd.options = st.order.filter(t => t !== a.ref.t);
      pd.label = 'Transport: choose the destination lane';
      return pump(st);
    }
    case 'transport-dest': {
      if (!pd.options.includes(a.theater)) return 'Not a legal destination.';
      st.stack.pop();
      const owner = pd.from.p; // usually the mover; the enemy for Jet Stream pushes
      const [e] = st.board[pd.from.t][owner].splice(pd.from.i, 1);
      st.board[a.theater][owner].push(e);
      addLog(st, e.faceUp
        ? `P${owner + 1}'s ${byId[e.id].name} moved from ${cap(pd.from.t)} to ${cap(a.theater)}.`
        : `P${owner + 1}'s face-down card moved from ${cap(pd.from.t)} to ${cap(a.theater)}.`);
      if (pd.flipUp && !e.faceUp) {
        flipEntry(st, { t: a.theater, p: owner, i: st.board[a.theater][owner].length - 1 });
      }
      return pump(st);
    }
    case 'redeploy': {
      if (!pd.options.some(o => sameRef(o, a.ref))) return 'Not a legal target.';
      st.stack.pop();
      const [e] = st.board[a.ref.t][a.ref.p].splice(a.ref.i, 1);
      st.hands[pd.player].push(e.id);
      addLog(st, `P${pd.player + 1} redeployed a face-down card to hand and goes again.`);
      st.extraFor = pd.player;
      return pump(st);
    }
    default:
      return 'Nothing to resolve.';
  }
}

// extraFor: player who earned an extra turn (Redeploy); otherwise turn passes.
function finishTurn(st, extraFor = null) {
  st.stack = [];
  st.pending = null;
  if (!st.hands[0].length && !st.hands[1].length) return resolveBattle(st);
  st.turn = extraFor !== null ? extraFor : 1 - st.turn;
  if (!st.hands[st.turn].length) st.turn = 1 - st.turn; // out of cards; other player continues
  return null;
}

function theaterSummary(st) {
  return st.order.map(t => {
    const s0 = strength(st, t, 0);
    const s1 = strength(st, t, 1);
    let winner;
    if (s0 !== s1) {
      winner = s0 > s1 ? 0 : 1;
    } else {
      // Spotter claims ties in its lane; otherwise ties (incl. empty) go to initiative.
      const sp0 = laneEffect(st, 'spotter', t, 0);
      const sp1 = laneEffect(st, 'spotter', t, 1);
      winner = sp0 !== sp1 ? (sp0 ? 0 : 1) : st.first;
    }
    return { t, s0, s1, winner };
  });
}

function resolveBattle(st) {
  const theaters = theaterSummary(st);
  const wins = [0, 0];
  for (const th of theaters) wins[th.winner] += 1;
  const winner = wins[0] >= 2 ? 0 : 1;
  return endBattle(st, winner, 6, `controls ${wins[winner]} of 3 lanes`, theaters);
}

function withdraw(st, p) {
  const table = p === st.first ? WITHDRAW_VP.first : WITHDRAW_VP.second;
  const left = st.hands[p].length;
  const vp = table.find(([min]) => left >= min)[1];
  return endBattle(st, 1 - p, vp, `P${p + 1} withdrew with ${left} card${left === 1 ? '' : 's'} in hand`, theaterSummary(st));
}

function endBattle(st, winner, vp, reason, theaters) {
  st.vp[winner] += vp;
  st.result = { winner, vp, reason, theaters, battle: st.battle };
  addLog(st, `P${winner + 1} wins battle ${st.battle}: +${vp} VP (${reason}). Score ${st.vp[0]}–${st.vp[1]}.`);
  if (st.vp[winner] >= 12) {
    st.phase = 'gameOver';
    st.winner = winner;
    addLog(st, `P${winner + 1} wins the war!`);
  } else {
    st.phase = 'battleOver';
  }
  return null;
}

// Redacted copy of the state for player p: hides the opponent's hand, the deck
// order, the discard identities, opposing face-down cards, and a Reinforce
// peek that isn't theirs.
export function viewFor(st, p) {
  const v = JSON.parse(JSON.stringify(st));
  const o = 1 - p;
  delete v.seed;
  delete v.stack;
  v.me = p;
  v.hands[o] = v.hands[o].map(() => null);
  v.deckCount = v.deck.length;
  v.deck = [];
  v.discardCount = v.discard.length;
  v.discard = [];
  for (const t of v.order) {
    v.board[t][o] = v.board[t][o].map(e => (e.faceUp ? e : { id: null, faceUp: false }));
  }
  if (v.pending && v.pending.player !== p) {
    // Hide private information riding on the pending frame (Reinforce peek,
    // Scout Report / Codebreakers reveals).
    if (v.pending.card) v.pending = { ...v.pending, card: null };
    if (v.pending.cards) v.pending = { ...v.pending, cards: null };
  }
  return v;
}
