export function validateLayerNames(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("图层映射必须是层号/类型号到名称的对象");
  const entries = Object.entries(value);
  if (entries.length > 10000 || entries.some(([id, name]) => !/^\d{1,5}\/\d{1,5}$/.test(id) || id.split("/").some((n) => Number(n) > 65535) || typeof name !== "string" || !name.trim() || name.length > 128 || /[\u0000-\u001f]/.test(name))) throw new Error("图层映射无效，名称最多 128 字符");
  return Object.fromEntries(entries.map(([id, name]) => [id, (name as string).trim()]));
}

export function parseLayerNames(text: string, filename: string): Record<string, string> {
  if (new TextEncoder().encode(text).length > 1024 * 1024) throw new Error("图层映射不能超过 1 MB");
  if (!filename.toLowerCase().endsWith(".lyp")) return validateLayerNames(JSON.parse(text));
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("图层映射不允许外部实体");
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror") || document.documentElement.tagName !== "layer-properties") throw new Error("图层映射 XML 无效");
  const names = new Map<string, string>();
  for (const entry of document.querySelectorAll("properties, group-members")) {
    const name = [...entry.children].find((el) => el.tagName === "name")?.textContent?.trim();
    const source = [...entry.children].find((el) => el.tagName === "source")?.textContent?.trim();
    // Import exact numeric layers of the default layout only; ranges and wildcards
    // do not identify a unique process layer and must not be guessed.
    const match = source?.match(/^(\d{1,5})\/(\d{1,5})(?:@1)?$/);
    if (!name || !match) continue;
    const id = `${Number(match[1])}/${Number(match[2])}`;
    if (names.has(id) && names.get(id) !== name) throw new Error("同一图层存在冲突名称");
    names.set(id, name);
  }
  if (!names.size) throw new Error("没有找到明确的图层名称，范围或通配符需要手动命名");
  return validateLayerNames(Object.fromEntries(names));
}
