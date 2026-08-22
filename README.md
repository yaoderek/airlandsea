# Air · Land · Sea — fan clone

An unofficial, fan-made clone of the two-player card game *Air, Land & Sea*, built as a
single static web page. All artwork is original SVG and the ability text is paraphrased.

- **Play online with a friend** — one of you clicks *Host online game* and sends the
  other the room link. Connections are peer-to-peer (WebRTC via the free public PeerJS
  broker); there is no game server and nothing to deploy beyond static files.
- **Pass & play** — both players share one screen; the view flips between turns.

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. In the repo: **Settings → Pages → Source**: *Deploy from a branch*, branch `main`,
   folder `/ (root)`. Save.
3. Your game is live at `https://<username>.github.io/<repo>/`. Share that URL —
   the host's room link includes it automatically.

## Run locally

Any static file server works (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

The rules engine is a pure module with a test suite (including a random-playout fuzzer):

```sh
npm test
```

## How it works

| File | Role |
|---|---|
| `js/cards.js` | The 18 card definitions and all SVG art |
| `js/engine.js` | Pure rules engine — turns, abilities, scoring, redacted per-player views |
| `js/ui.js` | Renders a view and turns clicks into actions |
| `js/main.js` | Lobby, PeerJS host/guest wiring, hotseat mode |

The host is authoritative: the guest only ever receives a redacted view (opponent's
hand, deck order, and face-down cards are hidden), and every action is validated by
the engine before it is applied.

*This is a fan project for personal play, not affiliated with or endorsed by the
publishers of Air, Land & Sea. If you enjoy it, buy the real card game.*
