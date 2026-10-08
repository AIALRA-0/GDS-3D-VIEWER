import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import english from "./translations.en";

export type Locale = "zh" | "en";
type Params = Record<string, string | number>;
const messages: Record<string, string> = english;
const patterns = Object.keys(messages).filter((key) => key.includes("{{")).map((key) => {
  const names: string[] = [];
  const expression = key.split(/(\{\{\d+\}\})/).map((part) => {
    if (/^\{\{\d+\}\}$/.test(part)) { names.push(part.slice(2, -2)); return "(.*?)"; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { key, names, expression: new RegExp(`^${expression}$`) };
});
export function translate(locale: Locale, key: string, params: Params = {}): string {
  let text = locale === "en" ? messages[key] ?? key : key;
  if (locale === "en" && !messages[key] && key.length < 10000) {
    for (const pattern of patterns) {
      const match = key.match(pattern.expression);
      if (match) {
        text = messages[pattern.key];
        params = { ...params, ...Object.fromEntries(pattern.names.map((name, index) => {
          const value = match[index + 1];
          return [name, pattern.key === "{{0}} · {{1}} 个图层 · {{2}}" && name === "2" ? messages[value] ?? value : value];
        })) };
        break;
      }
    }
  }
  return text.replace(/\{\{(\d+)\}\}/g, (placeholder, name: string) => String(params[name] ?? placeholder));
}
const Context = createContext({ locale: "zh" as Locale, setLocale: (_locale: Locale) => {}, t: (key: string, params?: Params) => translate("zh", key, params) });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try { return localStorage.getItem("gds-3d-viewer.locale") === "en" ? "en" : "zh"; }
    catch { return "zh"; }
  });
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = locale === "zh" ? "GDS-3D-VIEWER · 版图三维预览" : "GDS-3D-VIEWER · 3D Layout Preview";
    try { localStorage.setItem("gds-3d-viewer.locale", locale); } catch { /* Session preference still works without storage */ }
  }, [locale]);
  return <Context.Provider value={{ locale, setLocale, t: (key, params) => translate(locale, key, params) }}>{children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);
