// Engine tests: node test/engine.test.mjs
import assert from 'node:assert/strict';
import {
  newGame, applyAction, viewFor, strength, canPlayFaceUp, canPlayFaceDown, activePlayer,
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
function bareState({ first = 0, deck = 'classic' } = {}) {
  const st = newGame(1, deck);
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

test('Containment prevents face-down plays entirely', () => {
  const st = bareState();
  put(st, 'air', 1, 'A5', true); // opponent's Containment
  st.hands[0] = ['L6'];
  st.hands[1] = ['S6'];
  assert.ok(!canPlayFaceDown(st, 'sea'));
  assert.ok(applyAction(st, 0, { t: 'play', card: 'L6', theater: 'sea', faceDown: true })); // rejected
  assert.deepEqual(st.hands[0], ['L6']); // card kept, turn not spent
  assert.equal(st.turn, 0);
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L6', theater: 'land', faceDown: false }), null); // face-up still fine
});

test('Blockade prevents any play into a full adjacent lane', () => {
  const st = bareState();
  put(st, 'sea', 1, 'S5', true); // Blockade; adjacent lane is land
  put(st, 'land', 0, 'L6', true);
  put(st, 'land', 1, 'L1', true);
  put(st, 'land', 1, 'L2', false);
  st.hands[0] = ['L4'];
  st.hands[1] = ['S6'];
  assert.ok(!canPlayFaceUp(st, 0, byId.L4, 'land'));
  assert.ok(!canPlayFaceDown(st, 'land'));
  assert.ok(applyAction(st, 0, { t: 'play', card: 'L4', theater: 'land', faceDown: false })); // rejected
  assert.deepEqual(st.hands[0], ['L4']);
  assert.equal(st.board.land[0].length, 1);
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L4', theater: 'air', faceDown: true }), null); // elsewhere ok
});

test('Reinforce only offers lanes that are legal for a face-down play', () => {
  const st = bareState();
  put(st, 'sea', 1, 'S5', true); // Blockade watching land
  put(st, 'land', 0, 'L6', true);
  put(st, 'land', 1, 'L2', true);
  put(st, 'land', 1, 'S6', false); // land now holds 3 → closed
  put(st, 'air', 0, 'A4', true);   // Aerodrome lets Reinforce (str 1) deploy to air
  st.deck = ['A6'];
  st.hands[0] = ['L1', 'L4'];
  st.hands[1] = ['S1'];
  // Playing into the closed lane itself is rejected outright.
  assert.ok(applyAction(st, 0, { t: 'play', card: 'L1', theater: 'land', faceDown: false }));
  // Deploy Reinforce to air instead: its only adjacent lane (land) is closed,
  // so no reinforce prompt appears and the deck card stays put.
  assert.equal(applyAction(st, 0, { t: 'play', card: 'L1', theater: 'air', faceDown: false }), null);
  assert.equal(st.pending, null);
  assert.equal(st.deck.length, 1);
  assert.equal(st.turn, 1);
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
  assert.equal(st.pending.mode, 'adjacent');
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

// ---------- Second Front (alternate deck) ----------

test('second deck deals 6/6/6 unique alt cards', () => {
  const st = newGame(42, 'second');
  const all = [...st.hands[0], ...st.hands[1], ...st.deck];
  assert.equal(new Set(all).size, 18);
  assert.ok(all.every(id => /^[XYZ]/.test(id)));
});

test('Spotter wins ties in its lane; initiative rules elsewhere', () => {
  const st = bareState({ first: 1, deck: 'second' });
  put(st, 'air', 0, 'X1', true);  // P0 Spotter (1) in air
  put(st, 'air', 1, 'Y1', true);  // P1 Trench Line (1) → air tied 1-1
  st.hands = [['X6'], []];
  st.turn = 0;
  assert.equal(applyAction(st, 0, { t: 'play', card: 'X6', theater: 'land', faceDown: true }), null);
  const air = st.result.theaters.find(x => x.t === 'air');
  assert.equal(air.winner, 0); // Spotter beats initiative on the tie
  const sea = st.result.theaters.find(x => x.t === 'sea');
  assert.equal(sea.winner, 1); // empty lane still goes to initiative
});

test('No-Fly Zone blocks enemy face-up plays into its lane only', () => {
  const st = bareState({ deck: 'second' });
  put(st, 'air', 1, 'X5', true); // P1's No-Fly Zone in air
  st.hands[0] = ['X6'];
  st.hands[1] = ['Z6'];
  assert.ok(!canPlayFaceUp(st, 0, byId.X6, 'air'));
  assert.ok(applyAction(st, 0, { t: 'play', card: 'X6', theater: 'air', faceDown: false }));
  assert.ok(canPlayFaceDown(st, 'air')); // improvising is still allowed
  assert.ok(canPlayFaceUp(st, 1, byId.Z6, 'sea')); // owner unaffected elsewhere
  assert.equal(applyAction(st, 0, { t: 'play', card: 'X6', theater: 'air', faceDown: true }), null);
});

test('Strafing Run auto-flips the enemy uncovered card in its lane', () => {
  const st = bareState({ deck: 'second' });
  put(st, 'air', 1, 'Y6', true);
  st.hands[0] = ['X4', 'X6'];
  st.hands[1] = ['Z6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'X4', theater: 'air', faceDown: false }), null);
  assert.equal(st.board.air[1][0].faceUp, false);
  assert.equal(st.pending, null); // no choice involved
  assert.equal(st.turn, 1);
});

test('Bunker Network stops enemy flips in its lane', () => {
  const st = bareState({ deck: 'second' });
  put(st, 'land', 1, 'Y4', true); // P1 Bunker Network
  put(st, 'land', 1, 'Z6', false); // protected face-down card on top
  put(st, 'sea', 1, 'X6', true);   // unprotected elsewhere
  st.hands[0] = ['Y3', 'X6'];
  st.hands[1] = ['Z6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'Y3', theater: 'land', faceDown: false }), null); // Artillery Strike
  // Only P0's own card (the strike itself) is flippable in land; P1's are guarded.
  assert.ok(st.pending.options.every(o => o.p === 0));
  assert.equal(applyAction(st, 0, { t: 'skip' }), null);
});

test('Conscription draws the top deck card into hand', () => {
  const st = bareState({ deck: 'second' });
  st.deck = ['X6', 'Z6'];
  st.hands[0] = ['Y5', 'Y6'];
  st.hands[1] = ['Z1'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'Y5', theater: 'land', faceDown: false }), null);
  assert.deepEqual(st.hands[0], ['Y6', 'X6']);
  assert.equal(st.deck.length, 1);
  assert.equal(st.turn, 1);
});

test('Amphibious Assault moves a face-down card and triggers its reveal', () => {
  const st = bareState({ deck: 'second' });
  put(st, 'air', 0, 'Y5', false); // P0's face-down Conscription
  st.deck = ['X6'];
  st.hands[0] = ['Z5', 'Z6'];
  st.hands[1] = ['Y6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'Z5', theater: 'sea', faceDown: false }), null);
  assert.equal(st.pending.type, 'transport-pick');
  assert.equal(applyAction(st, 0, { t: 'pick', ref: { t: 'air', p: 0, i: 0 } }), null);
  assert.equal(st.pending.type, 'transport-dest');
  assert.equal(applyAction(st, 0, { t: 'pick', theater: 'land' }), null);
  const moved = st.board.land[0][0];
  assert.equal(moved.id, 'Y5');
  assert.equal(moved.faceUp, true);            // flipped on arrival
  assert.deepEqual(st.hands[0], ['Z6', 'X6']); // …and its Conscription instant fired
});

test('Jet Stream pushes the enemy uncovered card to an adjacent lane', () => {
  const st = bareState({ deck: 'second' });
  put(st, 'air', 1, 'Y6', true);
  st.hands[0] = ['X3', 'X6'];
  st.hands[1] = ['Z6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'X3', theater: 'air', faceDown: false }), null);
  assert.equal(st.pending.type, 'transport-dest');
  assert.deepEqual(st.pending.options, ['land']);
  assert.equal(applyAction(st, 0, { t: 'pick', theater: 'land' }), null);
  assert.equal(st.board.air[1].length, 0);
  assert.equal(st.board.land[1][0].id, 'Y6');
});

test('Scout Report reveals the opponent hand to its player only', () => {
  const st = bareState({ deck: 'second' });
  st.hands[0] = ['Y2', 'Y6'];
  st.hands[1] = ['Z1', 'Z6'];
  assert.equal(applyAction(st, 0, { t: 'play', card: 'Y2', theater: 'land', faceDown: false }), null);
  assert.equal(st.pending.type, 'peek');
  assert.deepEqual(viewFor(st, 0).pending.cards, ['Z1', 'Z6']);
  assert.equal(viewFor(st, 1).pending.cards, null);
  assert.equal(applyAction(st, 0, { t: 'skip' }), null); // acknowledge
  assert.equal(st.turn, 1);
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
      for (const ref of pd.options || []) acts.push({ actor: pd.player, a: { t: 'pick', ref } });
    }
    return acts;
  }
  const p = st.turn;
  const acts = [{ actor: p, a: { t: 'withdraw' } }];
  for (const card of st.hands[p]) {
    for (const t of st.order) {
      if (canPlayFaceDown(st, t)) {
        acts.push({ actor: p, a: { t: 'play', card, theater: t, faceDown: true } });
      }
      if (canPlayFaceUp(st, p, byId[card], t)) {
        acts.push({ actor: p, a: { t: 'play', card, theater: t, faceDown: false } });
      }
    }
  }
  return acts;
}

test('fuzz: 40 random games complete legally (both decks)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const st = newGame(seed * 977, seed % 2 ? 'classic' : 'second');
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
