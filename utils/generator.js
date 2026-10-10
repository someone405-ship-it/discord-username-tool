const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const ALNUM = LETTERS + DIGITS;
const VOWELS = 'aeiou';
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randChar(set) { return set[Math.floor(Math.random() * set.length)]; }

function product(sets, max = 50000) {
  const out = [];
  function rec(i, cur) {
    if (out.length >= max) return;
    if (i === sets.length) { out.push(cur); return; }
    for (const c of sets[i]) {
      rec(i + 1, cur + c);
      if (out.length >= max) return;
    }
  }
  rec(0, '');
  return out;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function gen2L(limit = 676) { return product([LETTERS, LETTERS], limit); }
export function gen2C(limit = 1296) { return product([ALNUM, ALNUM], limit); }
export function gen2N(limit = 100) { return product([DIGITS, DIGITS], limit); }
export function gen3L(limit = 17576) { return product([LETTERS, LETTERS, LETTERS], limit); }
export function gen3C(limit = 46656) { return product([ALNUM, ALNUM, ALNUM], limit); }
export function gen3N(limit = 1000) { return product([DIGITS, DIGITS, DIGITS], limit); }
export function gen4N(limit = 10000) { return product([DIGITS, DIGITS, DIGITS, DIGITS], limit); }

export function gen4L(limit = 20000) {
  const out = [], seen = new Set();
  while (out.length < limit) {
    let s = '';
    for (let i = 0; i < 4; i++) s += randChar(LETTERS);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

export function gen4C(limit = 30000) {
  const out = [], seen = new Set();
  while (out.length < limit) {
    let s = '';
    for (let i = 0; i < 4; i++) s += randChar(ALNUM);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

export function genSemi3L(limit = 5000) {
  const out = [], seen = new Set();
  const patterns = [
    () => randChar(LETTERS) + '_' + randChar(LETTERS),
    () => randChar(LETTERS) + randChar(LETTERS) + '_',
    () => '_' + randChar(LETTERS) + randChar(LETTERS),
    () => randChar(LETTERS) + '.' + randChar(LETTERS),
    () => randChar(LETTERS) + randChar(LETTERS) + '.'
  ];
  while (out.length < limit) {
    const s = rand(patterns)();
    if (s.length >= 2 && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

export function genDotted(limit = 8000) {
  const out = [], seen = new Set();
  while (out.length < limit) {
    const parts = 1 + Math.floor(Math.random() * 2);
    const segs = [];
    for (let i = 0; i < parts + 1; i++) {
      let p = '';
      const len = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < len; j++) p += randChar(LETTERS);
      segs.push(p);
    }
    const s = segs.join('.');
    if (s.length >= 2 && s.length <= 32 && !seen.has(s) && !s.includes('..')) {
      seen.add(s); out.push(s);
    }
  }
  return out;
}

export function genRepeaters(limit = 5000) {
  const out = [], seen = new Set();
  while (out.length < limit) {
    const c = randChar(LETTERS);
    const styles = [`${c}${c}_${c}${c}`, `${c}_${c}${c}${c}`, `${c}${c}${c}_${c}`, `${c}${c}.${c}${c}`, `_${c}${c}${c}_`];
    const s = rand(styles);
    if (s.length >= 2 && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

export function genLetterRepeaters(limit = 4000) {
  const out = [], seen = new Set();
  for (const c of LETTERS) {
    for (let n = 2; n <= 6; n++) {
      const s = c.repeat(n);
      if (!seen.has(s)) { seen.add(s); out.push(s); }
    }
  }
  while (out.length < limit) {
    const a = randChar(LETTERS), b = randChar(LETTERS);
    const s = a + a + b + b;
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out.slice(0, limit);
}

export function genPronounceable(len = 4, limit = 10000) {
  const out = [], seen = new Set();
  while (out.length < limit) {
    let s = '';
    for (let i = 0; i < len; i++) s += i % 2 === 0 ? randChar(CONSONANTS) : randChar(VOWELS);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

export function genFaces(limit = 2000) {
  const faces = ['o_o', 'x_x', '0_0', 'v_v', 'w_w', 'u_u', 'n_n', 'q_q', 'p_p', 'b_b', 'd_d', 'c_c'];
  const out = [...faces], seen = new Set(faces);
  while (out.length < limit) {
    const a = randChar(LETTERS + DIGITS), b = randChar(LETTERS + DIGITS);
    const s = `${a}_${b}`;
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out.slice(0, limit);
}

const WORDS_EN = [
  'shadow','neon','void','ghost','frost','blaze','echo','nova','pixel','cyber',
  'lunar','solar','toxic','crypt','raven','steel','ember','drift','pulse','flux',
  'omega','alpha','sigma','delta','hyper','ultra','nano','quantum','astro','cosmo',
  'silent','rapid','frozen','hollow','crimson','azure','violet','amber','jade','onyx'
];
const WORDS_FR = [
  'ombre','neon','vide','fantome','givre','flamme','echo','nova','pixel','cyber',
  'lunaire','solaire','toxique','crypte','corbeau','acier','braise','derive','pulsar','flux',
  'omega','alpha','sigma','delta','hyper','ultra','nano','quantique','astro','cosmo'
];

export function genWords(lang = 'en', limit = 5000) {
  const base = lang === 'fr' ? WORDS_FR : WORDS_EN;
  const out = [], seen = new Set();
  for (const w of base) { if (!seen.has(w)) { seen.add(w); out.push(w); } }
  while (out.length < limit) {
    const w = rand(base);
    const styles = [w, w + randChar(DIGITS), w + randChar(DIGITS) + randChar(DIGITS), w + '_' + randChar(DIGITS), w.slice(0, 3) + '_' + w.slice(3), w[0] + '.' + w.slice(1)];
    const s = rand(styles);
    if (s.length >= 2 && s.length <= 32 && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out.slice(0, limit);
}

const PRESETS = {
  '2L': (n) => gen2L(n), '2C': (n) => gen2C(n), '2N': (n) => gen2N(n),
  '3L': (n) => gen3L(n), '3C': (n) => gen3C(n), '3N': (n) => gen3N(n),
  '4N': (n) => gen4N(n), '4L': (n) => gen4L(n), '4C': (n) => gen4C(n),
  'Semi3L': (n) => genSemi3L(n), 'Dotted': (n) => genDotted(n),
  'Repeaters': (n) => genRepeaters(n), 'LetterRepeaters': (n) => genLetterRepeaters(n),
  '4LPronounceable': (n) => genPronounceable(4, n), '5LPronounceable': (n) => genPronounceable(5, n),
  'Faces': (n) => genFaces(n), 'WordsEN': (n) => genWords('en', n), 'WordsFR': (n) => genWords('fr', n)
};

export function generate(preset, limit = 5000, { shuffle: doShuffle = true } = {}) {
  const fn = PRESETS[preset];
  if (!fn) throw new Error(`unknown preset: ${preset}. available: ${Object.keys(PRESETS).join(', ')}`);
  let list = fn(limit);
  if (doShuffle) list = shuffle(list);
  return list;
}

export const PRESET_NAMES = Object.keys(PRESETS);
