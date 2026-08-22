// Card definitions and hand-drawn SVG assets for the Air · Land · Sea fan clone.
// All art is original; ability text is paraphrased game logic.

export const THEATERS = ['air', 'land', 'sea'];

export const cap = s => s[0].toUpperCase() + s.slice(1);

export const CARDS = [
  { id: 'A1', theater: 'air',  str: 1, name: 'Support',          kind: 'ongoing', effect: 'aura', aura: 3, text: '+3 strength in each lane next to this one.' },
  { id: 'A2', theater: 'air',  str: 2, name: 'Air Drop',         kind: 'instant', effect: 'airdrop',       text: 'On your next turn, you may deploy face-up to any lane.' },
  { id: 'A3', theater: 'air',  str: 3, name: 'Maneuver',         kind: 'instant', effect: 'flip-adjacent', text: 'Flip an uncovered card in a lane next to this one.' },
  { id: 'A4', theater: 'air',  str: 4, name: 'Aerodrome',        kind: 'ongoing', effect: 'aerodrome',     text: 'You may deploy cards of strength 3 or less face-up to any lane.' },
  { id: 'A5', theater: 'air',  str: 5, name: 'Containment',      kind: 'ongoing', effect: 'containment',   text: 'Nobody may play cards face-down.' },
  { id: 'A6', theater: 'air',  str: 6, name: 'Heavy Bombers',    kind: 'none',    effect: 'none',          text: 'No ability — 6 raw strength.' },
  { id: 'L1', theater: 'land', str: 1, name: 'Reinforce',        kind: 'instant', effect: 'reinforce',     text: 'Peek at the top deck card. You may play it face-down to a lane next to this one.' },
  { id: 'L2', theater: 'land', str: 2, name: 'Ambush',           kind: 'instant', effect: 'flip-any',      text: 'Flip any uncovered card, anywhere.' },
  { id: 'L3', theater: 'land', str: 3, name: 'Maneuver',         kind: 'instant', effect: 'flip-adjacent', text: 'Flip an uncovered card in a lane next to this one.' },
  { id: 'L4', theater: 'land', str: 4, name: 'Cover Fire',       kind: 'ongoing', effect: 'coverfire',     text: 'Your cards beneath this one are strength 4.' },
  { id: 'L5', theater: 'land', str: 5, name: 'Disrupt',          kind: 'instant', effect: 'disrupt',       text: 'You, then your opponent, must each flip one of your own uncovered cards.' },
  { id: 'L6', theater: 'land', str: 6, name: 'Heavy Tanks',      kind: 'none',    effect: 'none',          text: 'No ability — 6 raw strength.' },
  { id: 'S1', theater: 'sea',  str: 1, name: 'Transport',        kind: 'instant', effect: 'transport',     text: 'You may move one of your cards to another lane.' },
  { id: 'S2', theater: 'sea',  str: 2, name: 'Escalation',       kind: 'ongoing', effect: 'escalation',    text: 'Your face-down cards are strength 4.' },
  { id: 'S3', theater: 'sea',  str: 3, name: 'Maneuver',         kind: 'instant', effect: 'flip-adjacent', text: 'Flip an uncovered card in a lane next to this one.' },
  { id: 'S4', theater: 'sea',  str: 4, name: 'Redeploy',         kind: 'instant', effect: 'redeploy',      text: 'Return one of your face-down cards to your hand. If you do, take another turn.' },
  { id: 'S5', theater: 'sea',  str: 5, name: 'Blockade',         kind: 'ongoing', effect: 'blockade',      text: 'No cards may be played into a lane next to this one while it holds 3+ cards.' },
  { id: 'S6', theater: 'sea',  str: 6, name: 'Super Battleship', kind: 'none',    effect: 'none',          text: 'No ability — 6 raw strength.' },
];

// "Second Front" — an original alternate set of 18 cards.
export const ALT_CARDS = [
  { id: 'X1', theater: 'air',  str: 1, name: 'Spotter',            kind: 'ongoing', effect: 'spotter',       text: 'You win ties in this lane.' },
  { id: 'X2', theater: 'air',  str: 2, name: 'Glider Drop',        kind: 'instant', effect: 'selfmove',      text: 'Move this card to any other lane.' },
  { id: 'X3', theater: 'air',  str: 3, name: 'Jet Stream',         kind: 'instant', effect: 'shove',         text: "Push the enemy uncovered card in this lane to an adjacent lane." },
  { id: 'X4', theater: 'air',  str: 4, name: 'Strafing Run',       kind: 'instant', effect: 'strafe',        text: 'The enemy uncovered card in this lane is flipped face-down.' },
  { id: 'X5', theater: 'air',  str: 5, name: 'No-Fly Zone',        kind: 'ongoing', effect: 'nofly',         text: 'Your opponent cannot play cards face-up into this lane.' },
  { id: 'X6', theater: 'air',  str: 6, name: 'Zeppelin Fleet',     kind: 'none',    effect: 'none',          text: 'No ability — 6 raw strength.' },
  { id: 'Y1', theater: 'land', str: 1, name: 'Trench Line',        kind: 'ongoing', effect: 'trench',        text: 'While covered by another card, this card is strength 4.' },
  { id: 'Y2', theater: 'land', str: 2, name: 'Scout Report',       kind: 'instant', effect: 'peekhand',      text: "Look at your opponent's hand." },
  { id: 'Y3', theater: 'land', str: 3, name: 'Artillery Strike',   kind: 'instant', effect: 'flip-lane',     text: 'Flip an uncovered card in this lane.' },
  { id: 'Y4', theater: 'land', str: 4, name: 'Bunker Network',     kind: 'ongoing', effect: 'flipguard',     text: "Your opponent's abilities can't flip your cards in this lane." },
  { id: 'Y5', theater: 'land', str: 5, name: 'Conscription',       kind: 'instant', effect: 'conscript',     text: 'Add the top card of the deck to your hand.' },
  { id: 'Y6', theater: 'land', str: 6, name: 'Juggernaut',         kind: 'none',    effect: 'none',          text: 'No ability — 6 raw strength.' },
  { id: 'Z1', theater: 'sea',  str: 1, name: 'Codebreakers',       kind: 'instant', effect: 'peekdown',      text: "Look at all of your opponent's face-down cards." },
  { id: 'Z2', theater: 'sea',  str: 2, name: 'Drift Mine',         kind: 'instant', effect: 'fdmove',        text: 'Move one of your face-down cards to another lane.' },
  { id: 'Z3', theater: 'sea',  str: 3, name: 'Naval Maneuvers',    kind: 'instant', effect: 'flip-adjacent', text: 'Flip an uncovered card in an adjacent lane.' },
  { id: 'Z4', theater: 'sea',  str: 4, name: 'Flagship',           kind: 'ongoing', effect: 'aura', aura: 2, text: '+2 strength in each lane next to this one.' },
  { id: 'Z5', theater: 'sea',  str: 5, name: 'Amphibious Assault', kind: 'instant', effect: 'assault',       text: 'Move one of your cards to another lane. If it was face-down, flip it face-up (its ability triggers).' },
  { id: 'Z6', theater: 'sea',  str: 6, name: 'Dreadnought',        kind: 'none',    effect: 'none',          text: 'No ability — 6 raw strength.' },
];

export const DECKS = { classic: CARDS, second: ALT_CARDS };

export const byId = Object.fromEntries([...CARDS, ...ALT_CARDS].map(c => [c.id, c]));

// Per-card pictograms. Inner SVG markup for a 48x48 viewBox, drawn in currentColor.
export const ICONS = {
  'Support': `
    <path d="M20 42 L24 14 L28 42 Z"/>
    <circle cx="24" cy="12" r="2.5"/>
    <path d="M15 11 a11 11 0 0 1 18 0 M18.5 14 a7 7 0 0 1 11 0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
  'Air Drop': `
    <path d="M10 22 a14 14 0 0 1 28 0 Z"/>
    <path d="M12 23 L21 33 M36 23 L27 33 M24 22 L24 33" stroke="currentColor" stroke-width="2" fill="none"/>
    <rect x="19" y="33" width="10" height="9" rx="1.5"/>`,
  'Maneuver': `
    <path d="M10 36 A18 18 0 0 1 30 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M26 10 L40 16 L30 28 Z"/>`,
  'Aerodrome': `
    <rect x="21" y="22" width="6" height="16"/>
    <path d="M13 12 h22 l-4 10 h-14 Z"/>
    <path d="M24 12 V6" stroke="currentColor" stroke-width="2.5"/>
    <circle cx="24" cy="5" r="1.8"/>
    <path d="M12 40 h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  'Containment': `
    <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="4.5"/>
    <path d="M13.5 34.5 L34.5 13.5" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`,
  'Heavy Bombers': `
    <path d="M24 4 L27 14 L42 20 L27 23 L26 31 L32 36 L24 33 L16 36 L22 31 L21 23 L6 20 L21 14 Z"/>
    <ellipse cx="16" cy="42" rx="2.2" ry="3.4"/>
    <ellipse cx="32" cy="42" rx="2.2" ry="3.4"/>`,
  'Reinforce': `
    <rect x="10" y="10" width="28" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="3.5"/>
    <path d="M24 17 v14 M17 24 h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  'Ambush': `
    <path d="M6 24 Q24 8 42 24 Q24 40 6 24 Z" fill="none" stroke="currentColor" stroke-width="3"/>
    <circle cx="24" cy="24" r="6"/>`,
  'Cover Fire': `
    <path d="M24 6 L38 11 V22 C38 31 32 37 24 42 C16 37 10 31 10 22 V11 Z" fill="none" stroke="currentColor" stroke-width="3.5"/>
    <path d="M24 12 V36 M16 20 H32" stroke="currentColor" stroke-width="2.5"/>`,
  'Disrupt': `
    <path d="M27 4 L13 27 h8 L19 44 L35 20 h-9 Z"/>`,
  'Heavy Tanks': `
    <rect x="7" y="28" width="34" height="11" rx="5.5"/>
    <rect x="16" y="19" width="13" height="9" rx="2"/>
    <rect x="28" y="21.5" width="14" height="3.5" rx="1.5"/>
    <path d="M13 33.5 h22" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 4" opacity=".5"/>`,
  'Transport': `
    <rect x="8" y="19" width="17" height="15" rx="1.5"/>
    <path d="M10 19 v-4 h13 v4" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <path d="M29 26 h11 M35 20.5 L40.5 26 L35 31.5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  'Escalation': `
    <path d="M13 40 L24 31 L35 40 M13 29 L24 20 L35 29 M13 18 L24 9 L35 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  'Redeploy': `
    <path d="M15 42 V22 a9 9 0 0 1 18 0 v7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M27 29 h12 L33 41 Z"/>`,
  'Blockade': `
    <circle cx="24" cy="9" r="4" fill="none" stroke="currentColor" stroke-width="3"/>
    <path d="M24 13 V38 M14 24 h20" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M10 28 a14 14 0 0 0 28 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
  'Super Battleship': `
    <path d="M4 31 h40 l-7 9 H10 Z"/>
    <rect x="14" y="24" width="9" height="7" rx="1"/>
    <rect x="26" y="21" width="8" height="10" rx="1"/>
    <path d="M14 27 h-8 M34 24 h9" stroke="currentColor" stroke-width="2.5"/>
    <path d="M30 21 v-9 l6 2 -6 2" fill="none" stroke="currentColor" stroke-width="2"/>`,

  // — Second Front set —
  'Spotter': `
    <circle cx="24" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="3.5"/>
    <path d="M24 5 v22 M13 16 h22" stroke="currentColor" stroke-width="2"/>
    <path d="M19 27 L21 34 h6 L29 27" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <rect x="20" y="34" width="8" height="7" rx="1.5"/>`,
  'Glider Drop': `
    <path d="M6 20 L42 12 L26 24 Z"/>
    <path d="M26 24 q-2 10 -12 16" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/>`,
  'Jet Stream': `
    <path d="M8 16 h18 M8 24 h14 M8 32 h18" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M28 12 L44 24 L28 36 Z"/>`,
  'Strafing Run': `
    <path d="M10 10 L13 16 L24 20 L13 22 L12.5 28 L17 31 L10 29 L3 31 L7.5 28 L7 22 Z" transform="rotate(35 14 20)"/>
    <path d="M24 22 L28 30 M30 16 L34 24 M36 10 L40 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <path d="M26 36 h4 M32 40 h4 M38 32 h4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  'No-Fly Zone': `
    <path d="M24 14 L26 20 L34 23 L26 25 L25.5 30 L29 33 L24 31 L19 33 L22.5 30 L22 25 L14 23 L22 20 Z"/>
    <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="4"/>
    <path d="M13 35 L35 13" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  'Zeppelin Fleet': `
    <ellipse cx="23" cy="20" rx="17" ry="7.5"/>
    <path d="M40 16 l6 -3 v14 l-6 -3 Z"/>
    <rect x="18" y="27" width="10" height="5" rx="2"/>
    <ellipse cx="14" cy="38" rx="8" ry="3.4" opacity=".55"/>`,
  'Trench Line': `
    <path d="M4 18 h8 v10 h8 V18 h8 v10 h8 V18 h8" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
    <path d="M4 38 h40" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 4"/>`,
  'Scout Report': `
    <circle cx="15" cy="26" r="8" fill="none" stroke="currentColor" stroke-width="3.5"/>
    <circle cx="33" cy="26" r="8" fill="none" stroke="currentColor" stroke-width="3.5"/>
    <path d="M23 26 h2" stroke="currentColor" stroke-width="3"/>
    <path d="M11 14 l4 5 M37 14 l-4 5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  'Artillery Strike': `
    <path d="M10 32 L30 14 l5 5 L15 37 Z"/>
    <circle cx="14" cy="36" r="6"/>
    <path d="M38 6 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z"/>`,
  'Bunker Network': `
    <path d="M8 34 a16 16 0 0 1 32 0 Z"/>
    <rect x="18" y="26" width="12" height="4" rx="2" fill="#fff" opacity=".85"/>
    <path d="M4 40 h40" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
  'Conscription': `
    <circle cx="18" cy="15" r="6"/>
    <path d="M8 36 a10 10 0 0 1 20 0 Z"/>
    <path d="M34 18 v12 M28 24 h12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  'Juggernaut': `
    <rect x="5" y="27" width="38" height="12" rx="6"/>
    <rect x="14" y="17" width="16" height="10" rx="2"/>
    <rect x="29" y="19" width="15" height="3" rx="1.5"/>
    <rect x="29" y="24" width="12" height="3" rx="1.5"/>
    <path d="M11 33 h26" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 4" opacity=".5"/>`,
  'Codebreakers': `
    <circle cx="16" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="3.5"/>
    <path d="M24 24 h16 M33 24 v7 M39 24 v5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="16" cy="24" r="2.5"/>`,
  'Drift Mine': `
    <circle cx="24" cy="26" r="10"/>
    <path d="M24 10 v6 M24 36 v6 M8 26 h6 M34 26 h6 M13 15 l4 4 M35 15 l-4 4 M13 37 l4 -4 M35 37 l-4 -4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  'Naval Maneuvers': `
    <path d="M10 30 A18 18 0 0 1 30 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M26 4 L40 10 L30 22 Z"/>
    <path d="M6 40 q6 -5 12 0 t12 0 t12 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  'Flagship': `
    <path d="M8 30 h32 l-6 8 H14 Z"/>
    <rect x="20" y="22" width="8" height="8" rx="1"/>
    <path d="M24 22 V8 l8 3 -8 3" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <path d="M10 18 l4 4 M38 18 l-4 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
  'Amphibious Assault': `
    <path d="M12 22 h24 v12 H12 Z"/>
    <path d="M12 22 L4 34 h8" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path d="M20 10 h8 v6 h6 l-10 8 -10 -8 h6 Z" opacity=".8"/>
    <path d="M6 40 q6 -5 12 0 t12 0 t12 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  'Dreadnought': `
    <path d="M2 32 h44 l-8 8 H8 Z"/>
    <rect x="8" y="25" width="8" height="7" rx="1"/>
    <rect x="20" y="21" width="9" height="11" rx="1"/>
    <rect x="32" y="25" width="8" height="7" rx="1"/>
    <path d="M8 28 h-6 M40 28 h6 M24 21 v-7" stroke="currentColor" stroke-width="2.5"/>`,
};

// Wide art strips for the lane tiles (viewBox 0 0 120 40), drawn in currentColor.
export const THEATER_ART = {
  air: `
    <ellipse cx="22" cy="26" rx="14" ry="6" opacity=".35"/>
    <ellipse cx="34" cy="22" rx="10" ry="5" opacity=".25"/>
    <ellipse cx="94" cy="14" rx="13" ry="5" opacity=".3"/>
    <path d="M60 8 L62.4 15 L74 19.5 L62.4 22 L61.6 28 L66 32 L60 30 L54 32 L58.4 28 L57.6 22 L46 19.5 L57.6 15 Z" opacity=".9"/>`,
  land: `
    <path d="M0 38 L22 10 L38 30 L54 6 L80 38 Z" opacity=".55"/>
    <path d="M50 38 L74 16 L92 30 L104 12 L120 38 Z" opacity=".85"/>`,
  sea: `
    <path d="M0 16 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5"/>
    <path d="M0 28 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".9"/>`,
};
