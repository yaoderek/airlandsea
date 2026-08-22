// Card definitions and hand-drawn SVG assets for the Air · Land · Sea fan clone.
// All art is original; ability text is paraphrased game logic.

export const THEATERS = ['air', 'land', 'sea'];

export const cap = s => s[0].toUpperCase() + s.slice(1);

export const CARDS = [
  { id: 'A1', theater: 'air',  str: 1, name: 'Support',          kind: 'ongoing', text: '+3 strength in each lane next to this one.' },
  { id: 'A2', theater: 'air',  str: 2, name: 'Air Drop',         kind: 'instant', text: 'On your next turn, you may deploy face-up to any lane.' },
  { id: 'A3', theater: 'air',  str: 3, name: 'Maneuver',         kind: 'instant', text: 'Flip an uncovered card in a lane next to this one.' },
  { id: 'A4', theater: 'air',  str: 4, name: 'Aerodrome',        kind: 'ongoing', text: 'You may deploy cards of strength 3 or less face-up to any lane.' },
  { id: 'A5', theater: 'air',  str: 5, name: 'Containment',      kind: 'ongoing', text: 'Nobody may play cards face-down.' },
  { id: 'A6', theater: 'air',  str: 6, name: 'Heavy Bombers',    kind: 'none',    text: 'No ability — 6 raw strength.' },
  { id: 'L1', theater: 'land', str: 1, name: 'Reinforce',        kind: 'instant', text: 'Peek at the top deck card. You may play it face-down to a lane next to this one.' },
  { id: 'L2', theater: 'land', str: 2, name: 'Ambush',           kind: 'instant', text: 'Flip any uncovered card, anywhere.' },
  { id: 'L3', theater: 'land', str: 3, name: 'Maneuver',         kind: 'instant', text: 'Flip an uncovered card in a lane next to this one.' },
  { id: 'L4', theater: 'land', str: 4, name: 'Cover Fire',       kind: 'ongoing', text: 'Your cards beneath this one are strength 4.' },
  { id: 'L5', theater: 'land', str: 5, name: 'Disrupt',          kind: 'instant', text: 'You, then your opponent, must each flip one of your own uncovered cards.' },
  { id: 'L6', theater: 'land', str: 6, name: 'Heavy Tanks',      kind: 'none',    text: 'No ability — 6 raw strength.' },
  { id: 'S1', theater: 'sea',  str: 1, name: 'Transport',        kind: 'instant', text: 'You may move one of your cards to another lane.' },
  { id: 'S2', theater: 'sea',  str: 2, name: 'Escalation',       kind: 'ongoing', text: 'Your face-down cards are strength 4.' },
  { id: 'S3', theater: 'sea',  str: 3, name: 'Maneuver',         kind: 'instant', text: 'Flip an uncovered card in a lane next to this one.' },
  { id: 'S4', theater: 'sea',  str: 4, name: 'Redeploy',         kind: 'instant', text: 'Return one of your face-down cards to your hand. If you do, take another turn.' },
  { id: 'S5', theater: 'sea',  str: 5, name: 'Blockade',         kind: 'ongoing', text: 'No cards may be played into a lane next to this one while it holds 3+ cards.' },
  { id: 'S6', theater: 'sea',  str: 6, name: 'Super Battleship', kind: 'none',    text: 'No ability — 6 raw strength.' },
];

export const byId = Object.fromEntries(CARDS.map(c => [c.id, c]));

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
