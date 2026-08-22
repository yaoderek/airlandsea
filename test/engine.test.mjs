// Engine tests: node test/engine.test.mjs
import assert from 'node:assert/strict';
import {
  newGame, applyAction, viewFor, strength, canPlayFaceUp, activePlayer,
} from '../js/engine.js';
import { byId, CARDS } from '../js/cards.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
  console.log(`✓ ${name}`);
}

// Builds a mid-battle state we can shape by hand.
function bareState({ first = 0 } = {}) {
  const st = newGame(1);
  st.first = first;
  st.turn = first;
  st.hands = [[], []];
  st.deck = [];
  st.discard = [];
  st.pending = null;
  st.airDrop = [false, false];
  for (const t of st.order) st.board[t] = [[], []];
  return st;
}

const put = (st, t, p, id, faceUp = true) => st.board[t][p].push({ id, faceUp });

test('deal gives 6/6/6 unique cards', () => {
  const st = newGame(42);
  const all = [...st.hands[0], ...st.hands[1], ...st.deck];
  assert.equal(st.hands[0].length, 6);
  assert.equal(st.hands[1].length, 6);
  assert.equal(st.deck.length, 6);
  assert.equal(new Set(all).size, 18);
});

test('face-up play must match lane; face-down goes anywhere at value 2', () => {
  const st = bareState();
  st.hands[0] = ['A6'];
  st.hands[1] = ['L6'];
  assert.ok(applyAction(st, 0, { t: 'play', card: 'A6', theater: 'land', faceDown: false }));
  assert.equal(applyAction(st, 0, { t: 'play', card: 'A6', theater: 'land', faceDown: true }), null);
  assert.equal(strength(st, 'land', 0), 2);
});

test('turn order enforced', () => {
  const st = newGame(7);
  const wrong = 1 - st.turn;
  assert.ok(applyAction(st, wrong, { t: 'play', card: st.hands[wrong][0], theater: 'air', faceDown: true }));
});

test('Escalation makes own face-down cards 4', () => {
  const st = bareState();
  put(st, 'sea', 0, 'S2', true);
  put(st, 'air', 0, 'A6', false);
  put(st, 'air', 1, 'L6', false);
  assert.equal(strength(st, 'air', 0), 4);
  assert.equal(strength(st, 'air', 1), 2);
});

test('Support adds +3 to adjacent lanes only', () => {
  const st = bareState(); // order: air, land, sea
  put(st, 'land', 0, 'A1', true); // Support in middle
  assert.equal(strength(st, 'air', 0), 3);
  assert.equal(strength(st, 'sea', 0), 3);
  assert.equal(strength(st, 'land', 0), 1);
});

test('Cover Fire makes covered cards 4', () => {
  const st = bareState();
  put(st, 'land', 0, 'L1', true);  // str 1, covered
  put(st, 'land', 0, 'A2', false); // face-down, covered
  put(st, 'land', 0, 'L4', true);  // Cover Fire on top
  assert.equal(strength(st, 'land', 0), 4 + 4 + 4);
});

test('Maneuver flips an uncovered card in an adjacent lane', () => {
  const st = bareState();
  st.hands[0] = ['A3'];
  st.hands[1] = ['S6'];
  put(st, 'land', 1, 'L6', true);
  assert.equal(applyAction(st, 0, { t: 'play', card: 'A3', theater: 'air', faceDown: false }), null);
  assert.equal(st.pending.type, 'flip');
  assert.deepEqual(st.pending.options, [{ t: 'land', p: 1, i: 0 }]);
  assert.ok(applyAction(st, 0, { t: 'pick', ref: { t: 'sea', p: 1, i: 0 } })); // illegal
  assert.equal(applyAction(st, 0, { t: 'pick', ref: { t: 'land', p: 1, i: 0 } }), null);
  assert.equal(st.board.land[1][0].faceUp, false);
  assert.equal(st.turn, 1);
});

test('Containment destroys face-down plays', () => {
  const st = bareState();
  put(st, 'air', 1, 'A5', true); // opponent's Containment
  st.hands[0] = ['L6'];
  st.hands[1] = ['S6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L6', theater: 'sea', faceDown: true }), null);
  assert.deepEqual(st.discard, ['L6']);
  assert.equal(st.board.sea[0].length, 0);
  assert.equal(st.turn, 1); // the turn is still spent
});

test('Blockade destroys plays into a full adjacent lane', () => {
  const st = bareState();
  put(st, 'sea', 1, 'S5', true); // Blockade; adjacent lane is land
  put(st, 'land', 0, 'L6', true);
  put(st, 'land', 1, 'L1', true);
  put(st, 'land', 1, 'L2', false);
  st.hands[0] = ['L4'];
  st.hands[1] = ['S6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L4', theater: 'land', faceDown: false }), null);
  assert.deepEqual(st.discard, ['L4']);
  assert.equal(st.board.land[0].length, 1);
});

test('Aerodrome lets strength ≤3 deploy anywhere; Air Drop lets anything', () => {
  const st = bareState();
  put(st, 'air', 0, 'A4', true); // Aerodrome
  assert.ok(canPlayFaceUp(st, 0, byId.S3, 'land'));
  assert.ok(!canPlayFaceUp(st, 0, byId.S6, 'land'));
  st.airDrop[0] = true;
  assert.ok(canPlayFaceUp(st, 0, byId.S6, 'land'));
});

test('Redeploy returns a face-down card and grants another turn', () => {
  const st = bareState();
  put(st, 'air', 0, 'A6', false);
  st.hands[0] = ['S4', 'L6'];
  st.hands[1] = ['S6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'S4', theater: 'sea', faceDown: false }), null);
  assert.equal(st.pending.type, 'redeploy');
  assert.equal(applyAction(st, 0, { t: 'pick', ref: { t: 'air', p: 0, i: 0 } }), null);
  assert.deepEqual(st.hands[0], ['L6', 'A6']);
  assert.equal(st.turn, 0); // extra turn
});

test('Disrupt forces both players to flip, chooser first', () => {
  const st = bareState();
  put(st, 'air', 0, 'A6', true);
  put(st, 'sea', 1, 'S6', true);
  st.hands[0] = ['L5'];
  st.hands[1] = ['L6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L5', theater: 'land', faceDown: false }), null);
  assert.equal(st.pending.player, 0);
  assert.equal(st.pending.skippable, false);
  assert.ok(applyAction(st, 0, { t: 'skip' })); // mandatory
  assert.ok(st.pending.options.every(o => o.p === 0));
  assert.equal(applyAction(st, 0, { t: 'pick', ref: { t: 'air', p: 0, i: 0 } }), null);
  assert.equal(st.pending.player, 1);
  assert.equal(applyAction(st, 1, { t: 'pick', ref: { t: 'sea', p: 1, i: 0 } }), null);
  assert.equal(st.board.air[0][0].faceUp, false);
  assert.equal(st.board.sea[1][0].faceUp, false);
  assert.equal(st.pending, null);
});

test('flipping a card face-up triggers its instant, resolved by its owner', () => {
  const st = bareState();
  put(st, 'land', 1, 'A3', false); // opponent's face-down Maneuver
  put(st, 'air', 0, 'A6', true);   // a target adjacent to land
  st.hands[0] = ['L2', 'L6'];
  st.hands[1] = ['S6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L2', theater: 'land', faceDown: false }), null); // Ambush
  assert.equal(st.pending.type, 'flip');
  assert.equal(applyAction(st, 0, { t: 'pick', ref: { t: 'land', p: 1, i: 0 } }), null);
  // The revealed Maneuver now belongs to the opponent to resolve.
  assert.equal(st.pending.type, 'flip');
  assert.equal(st.pending.mode, 'maneuver');
  assert.equal(st.pending.player, 1);
  assert.deepEqual(st.pending.options, [{ t: 'air', p: 0, i: 0 }]);
  assert.equal(applyAction(st, 1, { t: 'pick', ref: { t: 'air', p: 0, i: 0 } }), null);
  assert.equal(st.board.air[0][0].faceUp, false);
  assert.equal(st.pending, null);
  assert.equal(st.turn, 1);
});

test('flipping an ongoing card face-up does not create a pending effect', () => {
  const st = bareState();
  put(st, 'air', 1, 'A5', false); // face-down Containment
  st.hands[0] = ['L2', 'L6'];
  st.hands[1] = ['S6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L2', theater: 'land', faceDown: false }), null);
  assert.equal(applyAction(st, 0, { t: 'pick', ref: { t: 'air', p: 1, i: 0 } }), null);
  assert.equal(st.board.air[1][0].faceUp, true);
  assert.equal(st.pending, null);
  assert.equal(st.turn, 1);
});

test('Disrupt resumes after a flip-triggered ability resolves', () => {
  const st = bareState();
  put(st, 'air', 0, 'L1', false);  // P0's own face-down Reinforce (instant when revealed)
  put(st, 'sea', 1, 'S6', true);   // P1's uncovered card
  st.deck = ['A6'];
  st.hands[0] = ['L5', 'L6'];
  st.hands[1] = ['S1'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L5', theater: 'land', faceDown: false }), null); // Disrupt
  assert.equal(st.pending.type, 'disrupt');
  // P0 flips their own face-down Reinforce face-up → its instant triggers first
  assert.equal(applyAction(st, 0, { t: 'pick', ref: { t: 'air', p: 0, i: 0 } }), null);
  assert.equal(st.pending.type, 'reinforce');
  assert.equal(st.pending.player, 0);
  assert.equal(applyAction(st, 0, { t: 'pick', theater: 'land' }), null); // deck card face-down to land
  assert.equal(st.board.land[0].length, 2); // Disrupt itself + the reinforcement
  // Disrupt resumes: now P1 must flip one of their own uncovered cards
  assert.equal(st.pending.type, 'disrupt');
  assert.equal(st.pending.player, 1);
  assert.equal(applyAction(st, 1, { t: 'pick', ref: { t: 'sea', p: 1, i: 0 } }), null);
  assert.equal(st.pending, null);
});

test('battle resolution: ties and empty lanes go to initiative, winner gets 6 VP', () => {
  const st = bareState({ first: 1 });
  put(st, 'air', 0, 'A6', true);  // P0 wins air 6-0
  put(st, 'land', 0, 'L1', true); // land tied 1-1 → P1 (initiative)
  put(st, 'land', 1, 'S1', true);
  // sea empty → P1 (initiative)
  st.hands = [['A2'], []];
  st.turn = 0;
  assert.equal(applyAction(st, 0, { t: 'play', card: 'A2', theater: 'air', faceDown: true }), null);
  assert.equal(st.phase, 'battleOver');
  assert.equal(st.result.winner, 1);
  assert.deepEqual(st.vp, [0, 6]);
});

test('withdraw scoring table (initiative player)', () => {
  for (const [cards, vp] of [[5, 2], [4, 2], [3, 3], [2, 3], [1, 4]]) {
    const st = bareState({ first: 0 });
    st.hands[0] = CARDS.slice(0, cards).map(c => c.id);
    st.hands[1] = ['S6'];
    assert.equal(applyAction(st, 0, { t: 'withdraw' }), null);
    assert.equal(st.vp[1], vp, `withdrew with ${cards} cards`);
  }
});

test('withdraw scoring table (second player)', () => {
  for (const [cards, vp] of [[5, 2], [4, 3], [3, 3], [2, 4], [1, 6]]) {
    const st = bareState({ first: 0 });
    st.turn = 1;
    st.hands[1] = CARDS.slice(0, cards).map(c => c.id);
    st.hands[0] = ['S6'];
    assert.equal(applyAction(st, 1, { t: 'withdraw' }), null);
    assert.equal(st.vp[0], vp, `withdrew with ${cards} cards`);
  }
});

test('next battle rotates lanes and swaps initiative', () => {
  const st = bareState({ first: 0 });
  st.hands = [[], ['S6']];
  st.turn = 1;
  assert.equal(applyAction(st, 1, { t: 'play', card: 'S6', theater: 'sea', faceDown: false }), null);
  assert.equal(st.phase, 'battleOver');
  assert.equal(applyAction(st, 0, { t: 'next', battle: 1 }), null);
  assert.equal(st.battle, 2);
  assert.equal(st.first, 1);
  assert.deepEqual(st.order, ['sea', 'air', 'land']);
  assert.equal(st.hands[0].length, 6);
});

test('view redacts opponent hand, deck, and face-down cards', () => {
  const st = newGame(9);
  const p = st.turn;
  applyAction(st, p, { t: 'play', card: st.hands[p][0], theater: 'air', faceDown: true });
  const v = viewFor(st, 1 - p);
  assert.ok(v.hands[p].every(x => x === null));
  assert.equal(v.deck.length, 0);
  assert.equal(v.deckCount, 6);
  assert.equal(v.board.air[p][0].id, null);
  const own = viewFor(st, p);
  assert.equal(typeof own.board.air[p][0].id, 'string');
});

// Random playout fuzz: no crashes, conservation of cards, games end.
function legalActions(st) {
  if (st.phase === 'battleOver') return [{ actor: 0, a: { t: 'next', battle: st.battle } }];
  if (st.phase !== 'battle') return [];
  if (st.pending) {
    const pd = st.pending;
    const acts = [];
    if (pd.skippable) acts.push({ actor: pd.player, a: { t: 'skip' } });
    if (pd.type === 'reinforce' || pd.type === 'transport-dest') {
      for (const t of pd.options) acts.push({ actor: pd.player, a: { t: 'pick', theater: t } });
    } else {
      for (const ref of pd.options) acts.push({ actor: pd.player, a: { t: 'pick', ref } });
    }
    return acts;
  }
  const p = st.turn;
  const acts = [{ actor: p, a: { t: 'withdraw' } }];
  for (const card of st.hands[p]) {
    for (const t of st.order) {
      acts.push({ actor: p, a: { t: 'play', card, theater: t, faceDown: true } });
      if (canPlayFaceUp(st, p, byId[card], t)) {
        acts.push({ actor: p, a: { t: 'play', card, theater: t, faceDown: false } });
      }
    }
  }
  return acts;
}

test('fuzz: 40 random games complete legally', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const st = newGame(seed * 977);
    let guard = 0;
    while (st.phase !== 'gameOver') {
      const acts = legalActions(st);
      assert.ok(acts.length, 'always at least one legal action');
      // Bias away from withdrawing so battles usually complete.
      const pool = acts.length > 1 && guard % 7 !== 0
        ? acts.filter(x => x.a.t !== 'withdraw') : acts;
      const pick = pool[Math.floor((Math.sin(seed * 1000 + guard) / 2 + 0.5) * pool.length) % pool.length];
      const err = applyAction(st, pick.actor, pick.a);
      assert.equal(err, null, `legal action rejected: ${JSON.stringify(pick)} → ${err}`);
      if (st.phase === 'battle') {
        const onBoard = st.order.flatMap(t => [...st.board[t][0], ...st.board[t][1]]).length;
        const total = st.hands[0].length + st.hands[1].length + st.deck.length + st.discard.length + onBoard;
        assert.equal(total, 18, 'card conservation');
      }
      assert.ok(++guard < 3000, 'game terminates');
    }
    assert.ok(st.vp[st.winner] >= 12);
  }
});

console.log(`\n${passed} tests passed`);
