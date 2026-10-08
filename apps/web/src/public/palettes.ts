export interface ColorPalette { id: string; name: string; colors: string[] }
export interface PalettePreferences { version: 1; custom: ColorPalette[]; defaultId: string }
export const PALETTE_STORAGE = "gds-3d-viewer.palettes.v1";
export const BUILTIN_PALETTES: ColorPalette[] = [
  { id: "original", name: "原始柔和", colors: ["#a7b9d0", "#d9b990", "#91bcac", "#c7a4c4", "#8bb9c6", "#caca91", "#b0a5d2", "#d39891"] },
  { id: "tableau", name: "经典分类", colors: ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"] },
  { id: "contrast", name: "清晰对比", colors: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#888888"] },
  { id: "neon", name: "深色霓虹", colors: ["#00d4ff", "#ff6b9d", "#a7f432", "#ffd166", "#c792ea", "#ff8c42", "#69f0ae", "#82aaff"] },
  { id: "mono", name: "灰阶结构", colors: ["#d9d9d9", "#999999", "#eeeeee", "#666666", "#bbbbbb", "#808080", "#f5f5f5", "#aaaaaa"] },
  { id: "coast", name: "海岸蓝绿", colors: ["#22577a", "#38a3a5", "#57cc99", "#80ed99", "#c7f9cc", "#468faf", "#89c2d9", "#e9d8a6"] },
  { id: "earth", name: "暖色陶土", colors: ["#bc6c25", "#dda15e", "#606c38", "#a3b18a", "#e9c46a", "#e76f51", "#8d5b4c", "#f4a261"] },
  { id: "retro", name: "复古终端", colors: ["#33ff99", "#ffcc33", "#66ccff", "#ff6699", "#cc99ff", "#99dd66", "#ff9966", "#99cccc"] },
  { id: "muted", name: "低饱和雾色", colors: ["#899f99", "#ac9fbb", "#c5ada0", "#8198b2", "#b9bc96", "#c69a9c", "#8ba9b2", "#c6bbac"] },
  { id: "spectrum", name: "高亮彩虹", colors: ["#e63946", "#ff9f1c", "#f4d35e", "#52b788", "#00b4d8", "#4361ee", "#9d4edd", "#f15bb5"] },
];
export const DEFAULT_PALETTE_PREFERENCES: PalettePreferences = { version: 1, custom: [], defaultId: "original" };
export function validColor(value: unknown): value is string { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value); }
export function validatePalettePreferences(value: unknown): PalettePreferences {
  const p = value as PalettePreferences;
  if (!p || p.version !== 1 || !Array.isArray(p.custom) || p.custom.length > 32 || typeof p.defaultId !== "string") throw Error("配色偏好无效");
  const ids = new Set(BUILTIN_PALETTES.map(p => p.id));
  for (const palette of p.custom) {
    if (!palette || typeof palette.id !== "string" || !/^palette-[\w-]{1,64}$/.test(palette.id) || ids.has(palette.id) || typeof palette.name !== "string" || !palette.name.trim() || palette.name.length > 80 || /[\u0000-\u001f]/.test(palette.name) || !Array.isArray(palette.colors) || !palette.colors.length || palette.colors.length > 32 || !palette.colors.every(validColor)) throw Error("配色偏好无效");
    ids.add(palette.id);
  }
  if (!ids.has(p.defaultId)) throw Error("配色偏好无效");
  return { version: 1, defaultId: p.defaultId, custom: p.custom.map(p => ({ id: p.id, name: p.name.trim(), colors: p.colors.map(c => c.toLowerCase()) })) };
}
export function readPalettePreferences(): PalettePreferences {
  const raw = localStorage.getItem(PALETTE_STORAGE);
  if (!raw) return DEFAULT_PALETTE_PREFERENCES;
  if (raw.length > 65536) throw Error("配色偏好无效");
  return validatePalettePreferences(JSON.parse(raw));
}
export function resolvePalette(id: string, custom: ColorPalette[]) { return [...BUILTIN_PALETTES, ...custom].find(p => p.id === id) ?? BUILTIN_PALETTES[0]; }

export function exportPalettePreferences(preferences: PalettePreferences): string {
  const text = JSON.stringify(validatePalettePreferences(preferences), null, 2);
  if (new TextEncoder().encode(text).length > 65536) throw Error("配色文件超过 64 KB");
  return text;
}
export function importPalettePreferences(text: string, current: PalettePreferences): PalettePreferences {
  if (new TextEncoder().encode(text).length > 65536) throw Error("配色文件超过 64 KB");
  const imported = validatePalettePreferences(JSON.parse(text));
  const merged = new Map(current.custom.map(p => [p.id, p]));
  for (const palette of imported.custom) merged.set(palette.id, palette);
  const result = validatePalettePreferences({ version: 1, custom: [...merged.values()], defaultId: imported.defaultId });
  const names = new Set(BUILTIN_PALETTES.map(p => p.name.toLowerCase()));
  for (const palette of result.custom) { const name = palette.name.toLowerCase(); if (names.has(name)) throw Error("配色组合名称已存在"); names.add(name); }
  return result;
}
