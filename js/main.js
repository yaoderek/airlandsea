// Lobby + game modes. Three ways to play:
//  - hotseat: one screen, the view flips to whoever must act (with a pass curtain)
//  - host:    owns the authoritative state, relays redacted views over PeerJS
//  - guest:   renders views from the host and sends actions back

import { newGame, applyAction, viewFor, activePlayer } from './engine.js';
import { render, toast } from './ui.js';

const $ = q => document.querySelector(q);
const rand = () => Math.floor(Math.random() * 2 ** 31);
const chosenDeck = () => (document.querySelector('input[name="deck"]:checked') || {}).value || 'classic';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'alsw-clone-';

let state = null;
let conn = null;
let lastHotseatP = null;

function showApp() {
  $('#lobby').hidden = true;
  $('#app').hidden = false;
}

function lobbyStatus(msg) {
  $('#lobby-status').innerHTML = msg;
}

// ---------- hotseat ----------

function startHotseat() {
  state = newGame(rand(), chosenDeck());
  lastHotseatP = null;
  showApp();
  hotseatUpdate();
}

function hotseatUpdate() {
  const p = state.phase === 'battle' ? activePlayer(state) : (lastHotseatP ?? 0);
  const doRender = () => {
    lastHotseatP = p;
    render(viewFor(state, p), {
      me: p,
      names: p === 0 ? ['Player 1', 'Player 2'] : ['Player 2', 'Player 1'],
      send: a => {
        const err = applyAction(state, p, a);
        if (err) toast(err);
        hotseatUpdate();
      },
      onRestart: () => { state = newGame(rand(), state.deckName); lastHotseatP = null; hotseatUpdate(); },
    });
  };
  if (state.phase === 'battle' && lastHotseatP !== null && p !== lastHotseatP) {
    showCurtain(`Pass the device — Player ${p + 1}'s move`, doRender);
  } else {
    doRender();
  }
}

function showCurtain(msg, onContinue) {
  $('#overlay').hidden = true; // the curtain replaces any result popup
  const el = $('#curtain');
  el.innerHTML = `<div class="panel"><h2>${msg}</h2><button id="btn-curtain">Ready</button></div>`;
  el.hidden = false;
  $('#btn-curtain').onclick = () => { el.hidden = true; onContinue(); };
}

// ---------- host ----------

function startHost() {
  const code = Array.from({ length: 5 }, () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  lobbyStatus('Creating room…');
  const peer = new Peer(PEER_PREFIX + code);
  peer.on('open', () => {
    const link = `${location.origin}${location.pathname}?join=${code}`;
    lobbyStatus(`Room code: <b class="code">${code}</b><br>
      Send your friend this link:<br><input class="linkbox" readonly value="${link}">
      <button id="btn-copy">Copy link</button><br><span class="muted">Waiting for them to join…</span>`);
    $('#btn-copy').onclick = () => {
      navigator.clipboard.writeText(link).then(() => toast('Link copied'));
    };
  });
  peer.on('error', e => lobbyStatus(`Connection error (${e.type}). Refresh and try again.`));
  peer.on('connection', c => {
    if (conn) { c.close(); return; } // one opponent only
    conn = c;
    c.on('open', () => {
      state = newGame(rand(), chosenDeck());
      showApp();
      hostSync();
    });
    c.on('data', d => {
      if (!state) return;
      if (d.t === 'action') {
        const err = applyAction(state, 1, d.a);
        if (err) c.send({ t: 'err', msg: err });
        hostSync();
      }
    });
    c.on('close', () => toast('Opponent disconnected. Refresh to host a new game.'));
  });
}

function hostSync() {
  if (conn && conn.open) conn.send({ t: 'view', view: viewFor(state, 1) });
  render(viewFor(state, 0), {
    me: 0,
    names: ['You', 'Opponent'],
    send: a => {
      const err = applyAction(state, 0, a);
      if (err) toast(err);
      hostSync();
    },
    onRestart: () => { state = newGame(rand(), state.deckName); hostSync(); },
  });
}

// ---------- guest ----------

function startJoin(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 5) { lobbyStatus('Enter the 5-letter room code.'); return; }
  lobbyStatus('Connecting…');
  const peer = new Peer();
  peer.on('error', e => lobbyStatus(`Connection error (${e.type}). Check the code and try again.`));
  peer.on('open', () => {
    const c = peer.connect(PEER_PREFIX + code, { reliable: true });
    conn = c;
    c.on('open', () => lobbyStatus('Connected — starting…'));
    c.on('data', d => {
      if (d.t === 'view') {
        showApp();
        render(d.view, {
          me: 1,
          names: ['You', 'Opponent'],
          send: a => c.send({ t: 'action', a }),
          onRestart: null,
        });
      } else if (d.t === 'err') {
        toast(d.msg);
      }
    });
    c.on('close', () => toast('Host disconnected.'));
  });
}

// ---------- lobby wiring ----------

$('#btn-hotseat').onclick = startHotseat;
$('#btn-host').onclick = startHost;
$('#btn-join').onclick = () => startJoin($('#join-code').value);
$('#join-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') startJoin($('#join-code').value);
});

const joinParam = new URLSearchParams(location.search).get('join');
if (joinParam) {
  $('#join-code').value = joinParam.toUpperCase();
  startJoin(joinParam);
}
