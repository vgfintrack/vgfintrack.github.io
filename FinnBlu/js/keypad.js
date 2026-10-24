// The amount box is a small calculator: "60+80+150" or "12×35" adds up as you
// type on FinnBlu's own number pad, so the phone keyboard never covers the form.
// Sums are read by a tiny parser (numbers and + − × ÷ only), never eval().

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function normalizeExpr(s) {
  return String(s ?? '')
    .replace(/[০-৯]/g, (d) => BN_DIGITS.indexOf(d))
    .replace(/[×xX*]/g, '×')
    .replace(/[÷/]/g, '÷')
    .replace(/[−–-]/g, '−')
    .replace(/,/g, '')
    .replace(/\s+/g, '');
}

// { value, parts, isSum }: value is NaN when the sum is incomplete or invalid.
export function evalExpr(raw) {
  const s = normalizeExpr(raw);
  const tokens = s.match(/\d+(?:\.\d*)?|\.\d+|[+−×÷]/g) || [];
  if (!s || tokens.join('') !== s) return { value: NaN, parts: [], isSum: false };
  // × and ÷ first, then + and −.
  const terms = [];
  let sign = 1;
  let cur = null;
  let op = null;
  for (const tk of tokens) {
    if (/[+−]/.test(tk)) {
      if (cur == null) return { value: NaN, parts: [], isSum: true };
      terms.push(sign * cur);
      sign = tk === '+' ? 1 : -1;
      cur = null;
      op = null;
    } else if (/[×÷]/.test(tk)) {
      if (cur == null) return { value: NaN, parts: [], isSum: true };
      op = tk;
    } else {
      const n = Number(tk);
      if (op === '×') cur *= n;
      else if (op === '÷') cur = n === 0 ? NaN : cur / n;
      else if (cur == null) cur = n;
      else return { value: NaN, parts: [], isSum: true };
      op = null;
    }
  }
  if (cur == null || op) return { value: NaN, parts: [], isSum: true };
  terms.push(sign * cur);
  const value = Math.round(terms.reduce((a, b) => a + b, 0) * 100) / 100;
  return { value, parts: terms, isSum: /[+−×÷]/.test(s) };
}

// "60+80+150" -> "60 + 80 + 150", for the note.
export const prettyExpr = (raw) => normalizeExpr(raw).replace(/([+−×÷])/g, ' $1 ');

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '⌫', '+'];

// Draws the pad under an input and keeps a "= total" line up to date.
export function attachKeypad(input, pad, result, { onChange } = {}) {
  pad.innerHTML = KEYS.map((k) => `<button type="button" data-k="${k}" class="${/[+−×÷]/.test(k) ? 'op' : k === '⌫' ? 'del' : ''}" aria-label="${k === '⌫' ? 'Delete' : k}">${k}</button>`).join('');
  const show = () => {
    const r = evalExpr(input.value);
    result.textContent = r.isSum && !isNaN(r.value) ? `= ${r.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '';
    result.hidden = !result.textContent;
  };
  const press = (k) => {
    let v = normalizeExpr(input.value);
    if (k === '⌫') v = v.slice(0, -1);
    else if (/[+−×÷]/.test(k)) v = v ? v.replace(/[+−×÷]$/, '') + k : v; // no sum starts with a sign
    else if (k === '.') {
      const last = v.split(/[+−×÷]/).pop();
      if (!last.includes('.')) v += last ? '.' : '0.';
    } else v += k;
    input.value = v;
    show();
    onChange?.();
  };
  pad.querySelectorAll('[data-k]').forEach((b) => {
    b.onpointerdown = (e) => e.preventDefault(); // keep focus (and no keyboard) on the amount
    b.onclick = () => press(b.dataset.k);
  });
  // Hold ⌫ to clear.
  const del = pad.querySelector('[data-k="⌫"]');
  let hold;
  del.addEventListener('pointerdown', () => (hold = setTimeout(() => ((input.value = ''), show(), onChange?.()), 600)));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => del.addEventListener(ev, () => clearTimeout(hold)));
  input.addEventListener('input', show);
  return { refresh: show };
}
