// Theme definitions: accent palette plus the background each theme paints.
export const THEMES = [
  { id: 'default', label: 'Default', primary: '#95ff50', secondary: '#43861e', pill: '#ffffff', pillFg: '#000', bg: { kind: 'liquid', colors: ['#021409', '#1c5a0e', '#7bf02f', '#d6ff9b'] } },
  { id: 'surface', label: 'Surface', primary: '#95ff50', secondary: '#43861e', pill: '#ffffff', pillFg: '#000', solid: true, bg: { kind: 'liquid', colors: ['#031a0a', '#1f6a10', '#86f53a', '#dfffa8'] } },
  { id: 'aero', label: 'Aero', primary: '#2f95d0', secondary: '#8cc63f', pill: 'aero', pillFg: '#06324f', bg: { kind: 'aero' } },
  { id: 'blue', label: 'Blue', primary: '#5d65ae', secondary: '#3b438c', pill: '#5d65ae', pillFg: '#fff', bg: { kind: 'liquid', colors: ['#07071a', '#1b2a8a', '#4f63e8', '#a9b6ff'] } },
  { id: 'teal', label: 'Teal', primary: '#5dae8b', secondary: '#3b8c69', pill: '#5dae8b', pillFg: '#04140e', bg: { kind: 'liquid', colors: ['#04141a', '#14586b', '#4cc3d0', '#b6f3ea'] } },
  { id: 'forest', label: 'Forest', primary: '#5b9457', secondary: '#3f7a3c', pill: '#5b9457', pillFg: '#04100a', bg: { kind: 'liquid', colors: ['#030a04', '#1b4a1d', '#4f9a4a', '#a6d9a0'] } },
  { id: 'mocha', label: 'Mocha', primary: '#987a4e', secondary: '#775936', pill: '#987a4e', pillFg: '#150f06', bg: { kind: 'liquid', colors: ['#120d07', '#6b4a22', '#c79a5b', '#f0d3a5'] } },
  { id: 'red', label: 'Red', primary: '#ae5d65', secondary: '#8c3b43', pill: '#ae5d65', pillFg: '#fff', bg: { kind: 'liquid', colors: ['#14070a', '#7a1f2a', '#e35a68', '#ffc1c7'] } },
  { id: 'pink', label: 'Pink', primary: '#ae5d9c', secondary: '#8c3b87', pill: '#ae5d9c', pillFg: '#fff', bg: { kind: 'liquid', colors: ['#14061a', '#7a1f78', '#e04fd0', '#ffc0f4'] } },
  { id: 'dark', label: 'Dark', primary: '#95ff50', secondary: '#43861e', pill: '#ffffff', pillFg: '#000', bg: { kind: 'liquid', colors: ['#010301', '#0a2410', '#1d6029', '#66cf78'] } },
  { id: 'amoled', label: 'AMOLED', primary: '#95ff50', secondary: '#43861e', pill: '#ffffff', pillFg: '#000', bg: { kind: 'stars' } },
];

const clamp = (n, a = 0, b = 255) => Math.min(b, Math.max(a, Math.round(n)));
const parse = h => { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function customTheme(primaryHex) {
  const p = parse(primaryHex || '#8a7bff');
  const black = [4, 4, 6], white = [255, 255, 255];
  return {
    id: 'custom', label: 'Custom', primary: toHex(p), secondary: toHex(mix(p, black, 0.45)), pill: toHex(p), pillFg: luma(p) > 0.55 ? '#05070a' : '#ffffff',
    bg: { kind: 'liquid', colors: [toHex(mix(p, black, 0.93)), toHex(mix(p, black, 0.5)), toHex(p), toHex(mix(p, white, 0.55))] },
  };
}
export function resolveTheme(settings) {
  if (settings.theme === 'custom') return customTheme(settings.customPrimary);
  return THEMES.find(t => t.id === settings.theme) || THEMES[0];
}
export function applyTheme(settings, bg) {
  const t = resolveTheme(settings); const root = document.documentElement;
  root.dataset.theme = t.id;
  root.dataset.solid = t.solid ? 'on' : 'off';
  root.style.setProperty('--accent', t.primary);
  root.style.setProperty('--accent-2', t.secondary);
  root.style.setProperty('--pill-bg', t.pill === 'aero' ? 'linear-gradient(180deg, #c9f0ff 0%, #7cc8f0 46%, #2c86c4 50%, #6fc3ee 100%)' : t.pill);
  root.style.setProperty('--pill-fg', t.pillFg);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', t.primary);
  bg?.set(t.bg); bg?.setStill(!!settings.reduceMotion);
  return t;
}
