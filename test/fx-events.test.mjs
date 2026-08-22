// Animation event diff tests: node test/fx-events.test.mjs
import assert from 'node:assert/strict';
import { newGame, applyAction, viewFor } from '../js/engine.js';
import { diffViews } from '../js/fx-events.js';

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

// Hand-shaped mid-battle state, mirroring the engine test helper.
function midState() {
  const st = newGame(1);
  st.first = 0;
  st.turn = 0;
  st.order = ['air', 'land', 'sea'];
  st.board = { air: [[], []], land: [[], []], sea: [[], []] };
  st.hands = [['A2', 'L2', 'S4', 'S1'], ['A6', 'L6', 'S6', 'L1']];
  st.deck = ['A3', 'L3', 'S3', 'A1', 'S2', 'L4'];
  st.pending = null;
  st.stack = [];
  st.airDrop = [false, false];
  return st;
}

// Applies an action and returns [prevView, nextView] for the given seat.
function step(st, actor, action, seat = 0) {
  const prev = viewFor(st, seat);
  const err = applyAction(st, actor, action);
  assert.equal(err, null);
  return [prev, viewFor(st, seat)];
}

test('face-up deploy yields a play event', () => {
  const st = midState();
  const [a, b] = step(st, 0, { t: 'play', card: 'L2', theater: 'land' });
  const evs = diffViews(a, b).filter(e => e.type === 'play');
  assert.deepEqual(evs, [{ type: 'play', player: 0, ref: { t: 'land', p: 0, i: 0 }, id: 'L2', faceUp: true }]);
});

test('opponent improvise yields a play event with hidden id', () => {
  const st = midState();
  st.turn = 1;
  const [a, b] = step(st, 1, { t: 'play', card: 'A6', theater: 'sea', faceDown: true });
  const evs = diffViews(a, b);
  assert.deepEqual(evs, [{ type: 'play', player: 1, ref: { t: 'sea', p: 1, i: 0 }, id: null, faceUp: false }]);
});

test('ambush flip of an enemy card yields a flip event with the ambusher as actor', () => {
  const st = midState();
  st.board.sea[1] = [{ id: 'L6', faceUp: false }];
  applyAction(st, 0, { t: 'play', card: 'L2', theater: 'land' }); // Ambush, pending flip
  const [a, b] = step(st, 0, { t: 'pick', ref: { t: 'sea', p: 1, i: 0 } });
  const evs = diffViews(a, b);
  assert.deepEqual(evs, [{ type: 'flip', ref: { t: 'sea', p: 1, i: 0 }, id: 'L6', faceUp: true, actor: 0, via: 'Ambush' }]);
});

test('redeploy yields a redeploy event', () => {
  const st = midState();
  st.board.air[0] = [{ id: 'A2', faceUp: false }];
  applyAction(st, 0, { t: 'play', card: 'S4', theater: 'sea' }); // Redeploy, pending pick
  const [a, b] = step(st, 0, { t: 'pick', ref: { t: 'air', p: 0, i: 0 } });
  const evs = diffViews(a, b);
  assert.deepEqual(evs, [{ type: 'redeploy', player: 0, from: { t: 'air', p: 0, i: 0 } }]);
});

test('transport yields a move event', () => {
  const st = midState();
  st.board.air[0] = [{ id: 'A2', faceUp: false }];
  applyAction(st, 0, { t: 'play', card: 'S1', theater: 'sea' }); // Transport
  applyAction(st, 0, { t: 'pick', ref: { t: 'air', p: 0, i: 0 } });
  const [a, b] = step(st, 0, { t: 'pick', theater: 'land' });
  const evs = diffViews(a, b);
  assert.deepEqual(evs, [{ type: 'move', player: 0, from: { t: 'air', p: 0, i: 0 },
    to: { t: 'land', p: 0, i: 0 }, id: 'A2', faceUp: false, flipped: false, via: 'Transport' }]);
});

test('reinforce yields a reinforce event', () => {
  const st = midState();
  st.hands[0].push('L1');
  applyAction(st, 0, { t: 'play', card: 'L1', theater: 'land' }); // Reinforce, pending lane
  const [a, b] = step(st, 0, { t: 'pick', theater: 'air' });
  const evs = diffViews(a, b);
  assert.deepEqual(evs, [{ type: 'reinforce', player: 0, ref: { t: 'air', p: 0, i: 0 }, id: 'A3' }]);
});

test('conscription deploy yields play + draw events, not reinforce', () => {
  const st = midState();
  st.hands[0].push('Y5'); // Conscription: add the top deck card to hand
  const [a, b] = step(st, 0, { t: 'play', card: 'Y5', theater: 'land' });
  const evs = diffViews(a, b);
  assert.deepEqual(evs.map(e => e.type).sort(), ['draw', 'play']);
  assert.deepEqual(evs.find(e => e.type === 'draw'), { type: 'draw', player: 0, count: 1 });
});

test('air drop deploy yields play + airdrop events', () => {
  const st = midState();
  const [a, b] = step(st, 0, { t: 'play', card: 'A2', theater: 'air' });
  const types = diffViews(a, b).map(e => e.type).sort();
  assert.deepEqual(types, ['airdrop', 'play']);
});

test('a fresh battle deal produces no events', () => {
  const st = midState();
  st.phase = 'battleOver';
  st.result = { winner: 0, vp: 6, reason: 'x', theaters: [], battle: st.battle };
  const [a, b] = step(st, 0, { t: 'next', battle: st.battle });
  assert.deepEqual(diffViews(a, b), []);
});

test('identical or missing views produce no events', () => {
  const st = midState();
  const v = viewFor(st, 0);
  assert.deepEqual(diffViews(v, v), []);
  assert.deepEqual(diffViews(null, v), []);
});

console.log(`\n${passed} fx-event tests passed.`);
