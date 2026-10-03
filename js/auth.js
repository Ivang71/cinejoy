// Local-only account system that mirrors the "16-digit account number" flow.
// There is no server: accounts live in this browser's localStorage, keyed by a
// SHA-256 hash of the number so the raw number is never stored.
const ACC_KEY = 'cinejoy::accounts::v1';
const SES_KEY = 'cinejoy::session::v1';
const listeners = new Set();

const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export const digitsOnly = s => String(s || '').replace(/\D/g, '');
export const formatNumber = s => digitsOnly(s).replace(/(\d{4})(?=\d)/g, '$1 ').trim();

async function sha256(text) {
  try {
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cinejoy:' + text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through */ }
  let h = 2166136261; for (const c of 'cinejoy:' + text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return 'f' + (h >>> 0).toString(16);
}

export function generateNumber() {
  const bytes = new Uint32Array(4); crypto.getRandomValues(bytes);
  // first digit non-zero so the number never looks truncated
  let out = String(1 + (bytes[0] % 9));
  for (let i = 1; i < 16; i++) out += String(bytes[Math.floor(i / 4)] >> ((i % 4) * 8) & 0xff).slice(-1);
  return out;
}

export const auth = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get user() { const id = read(SES_KEY, null); if (!id) return null; const acc = read(ACC_KEY, {})[id]; return acc ? { id, ...acc } : null; },
  get signedIn() { return !!this.user; },
  async register() {
    const number = generateNumber(); const id = await sha256(number);
    const accounts = read(ACC_KEY, {}); accounts[id] = { createdAt: Date.now(), last4: number.slice(-4), name: '' };
    write(ACC_KEY, accounts); return number;
  },
  async signIn(number) {
    const n = digitsOnly(number);
    if (n.length !== 16) return { ok: false, error: 'Enter all 16 digits.' };
    const id = await sha256(n); const acc = read(ACC_KEY, {})[id];
    if (!acc) return { ok: false, error: 'No account with that number exists on this device.' };
    write(SES_KEY, id); listeners.forEach(f => f(this.user)); return { ok: true };
  },
  async completeRegistration(number) { const id = await sha256(digitsOnly(number)); write(SES_KEY, id); listeners.forEach(f => f(this.user)); },
  signOut() { try { localStorage.removeItem(SES_KEY); } catch { /* ignore */ } listeners.forEach(f => f(null)); },
  setName(name) { const u = this.user; if (!u) return; const accounts = read(ACC_KEY, {}); accounts[u.id] = { ...accounts[u.id], name: name.trim().slice(0, 32) }; write(ACC_KEY, accounts); listeners.forEach(f => f(this.user)); },
  displayName() { const u = this.user; if (!u) return ''; return u.name || `user-${u.last4}`; },
};
