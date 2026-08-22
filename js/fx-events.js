// Diffs two consecutive redacted views into semantic animation events.
// Pure data-in data-out so it can be tested in node; js/fx.js turns the
// events into three.js effects. Every update the engine produces changes at
// most one stack length per side plus any number of in-place flips, so the
// diff only needs to classify: append, single removal, removal+append pair.

// Player whose action produced the transition prev -> next.
export const actorOf = prev => (prev.pending ? prev.pending.player : prev.turn);

export function diffViews(prev, next) {
  if (!prev || prev === next) return [];
  if (!prev.board || !next.board) return [];
  if (prev.battle !== next.battle) return []; // fresh deal; nothing to animate
  if (prev.order.join() !== next.order.join()) return [];

  const events = [];
  const removals = [];
  const additions = [];
  const actor = actorOf(prev);
  // Name of the card whose pending frame this action resolved, e.g.
  // "Artillery Strike: flip an uncovered card in this lane" -> "Artillery Strike".
  const via = prev.pending && prev.pending.label
    ? String(prev.pending.label).split(':')[0] : null;

  for (const t of next.order) {
    for (const p of [0, 1]) {
      const P = prev.board[t][p], N = next.board[t][p];
      if (N.length === P.length) {
        for (let i = 0; i < N.length; i++) {
          if (P[i].faceUp !== N[i].faceUp) {
            events.push({ type: 'flip', ref: { t, p, i },
              id: N[i].id ?? P[i].id ?? null, faceUp: N[i].faceUp, actor, via });
          }
        }
      } else if (N.length === P.length + 1) {
        additions.push({ t, p, i: N.length - 1, e: N[N.length - 1] });
      } else if (N.length === P.length - 1) {
        let i = 0;
        while (i < N.length && P[i].faceUp === N[i].faceUp && P[i].id === N[i].id) i++;
        removals.push({ t, p, i, e: P[i] });
      } else {
        return []; // board reshaped wholesale; not a single action
      }
    }
  }

  if (removals.length === 1 && additions.length === 1
      && removals[0].p === additions[0].p) {
    const [rm] = removals, [ad] = additions;
    events.push({ type: 'move', player: ad.p,
      from: { t: rm.t, p: rm.p, i: rm.i }, to: { t: ad.t, p: ad.p, i: ad.i },
      id: ad.e.id ?? rm.e.id ?? null, faceUp: ad.e.faceUp,
      flipped: ad.e.faceUp !== rm.e.faceUp, via });
  } else if (removals.length === 1 && additions.length === 0) {
    const [rm] = removals;
    if (next.hands[rm.p].length === prev.hands[rm.p].length + 1) {
      events.push({ type: 'redeploy', player: rm.p,
        from: { t: rm.t, p: rm.p, i: rm.i } });
    }
  } else if (additions.length === 1 && removals.length === 0) {
    const [ad] = additions;
    const fromDeck = next.deckCount < prev.deckCount;
    // A face-up append with an untouched hand still counts as a play when the
    // deck shrank: Conscription refills the hand in the same update.
    if (next.hands[ad.p].length < prev.hands[ad.p].length || (ad.e.faceUp && fromDeck)) {
      events.push({ type: 'play', player: ad.p, ref: { t: ad.t, p: ad.p, i: ad.i },
        id: ad.e.id ?? null, faceUp: ad.e.faceUp });
    } else if (!ad.e.faceUp && fromDeck) {
      events.push({ type: 'reinforce', player: ad.p,
        ref: { t: ad.t, p: ad.p, i: ad.i }, id: ad.e.id ?? null });
    }
  }

  // Deck-to-hand draws (Conscription), including one riding on its own play.
  if (next.deckCount < prev.deckCount) {
    const expected = [0, 0];
    for (const e of events) {
      if (e.type === 'play') expected[e.player] -= 1;
      if (e.type === 'redeploy') expected[e.player] += 1;
    }
    for (const p of [0, 1]) {
      const extra = (next.hands[p].length - prev.hands[p].length) - expected[p];
      if (extra > 0) events.push({ type: 'draw', player: p, count: extra });
    }
  }

  for (const p of [0, 1]) {
    if (!prev.airDrop[p] && next.airDrop[p]) events.push({ type: 'airdrop', player: p });
  }
  return events;
}
