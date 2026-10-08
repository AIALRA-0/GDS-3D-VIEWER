import { useState } from "react";
import { useI18n } from "./i18n";
import { IconButton } from "./IconButton";
import { BUILTIN_PALETTES, resolvePalette, validatePalettePreferences, type ColorPalette, type PalettePreferences } from "./palettes";

export function PalettePanel({ preferences, activeId, currentColors, onPreferences, onApply }: {
  preferences: PalettePreferences; activeId: string; currentColors?: string[]; onPreferences: (value: PalettePreferences) => void; onApply: (id: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(""), [draft, setDraft] = useState<ColorPalette | null>(null), [error, setError] = useState("");
  const palettes = [...BUILTIN_PALETTES, ...preferences.custom];
  const create = (palette: ColorPalette) => {
    setError(""); setDraft({ id: "", name: "", colors: [...palette.colors] });
  };
  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setError("请输入配色组合名称"); return; }
    if (palettes.some(p => p.id !== draft.id && p.name.toLowerCase() === name.toLowerCase())) { setError("配色组合名称已存在"); return; }
    const palette = { ...draft, id: draft.id || `palette-${crypto.randomUUID()}`, name };
    try {
      const custom = draft.id ? preferences.custom.map(p => p.id === draft.id ? palette : p) : [...preferences.custom, palette];
      onPreferences(validatePalettePreferences({ ...preferences, custom })); onApply(palette.id); setDraft(null); setError("");
    } catch { setError("配色组合最多 32 组，每组最多 32 个颜色"); }
  };
  return <div className="palette-panel">
    <p className="muted">{t("仅将组合名称、颜色和默认组合保存在本机浏览器，版图与密钥不写入配色偏好")}</p>
    <div className="palette-toolbar">
      <input aria-label={t("筛选配色组合")} placeholder={t("筛选配色组合")} value={query} maxLength={80} onChange={e => setQuery(e.target.value)} />
      <IconButton icon="plus" label={t("新增配色组合")} disabled={preferences.custom.length >= 32} onClick={() => create({ ...resolvePalette(activeId, preferences.custom), ...(currentColors?.length ? { colors: currentColors.slice(0, 32) } : {}) })} />
    </div>
    <div className="palette-list">
      {palettes.filter(p => `${t(p.name)} ${p.name}`.toLowerCase().includes(query.toLowerCase())).map(palette => {
        const custom = preferences.custom.some(p => p.id === palette.id);
        return <div className={`palette-row ${activeId === palette.id ? "selected" : ""}`} key={palette.id}>
          <button className="palette-apply" aria-label={t("应用配色 {{0}}", { "0": custom ? palette.name : t(palette.name) })} aria-pressed={activeId === palette.id} onClick={() => onApply(palette.id)}>
            <strong>{custom ? palette.name : t(palette.name)}</strong>
            <span className="palette-strip" aria-hidden="true">{palette.colors.map((color, i) => <span key={i} style={{ background: color }} />)}</span>
          </button>
          <div className="palette-actions">
            <IconButton icon="star" label={t("设为默认配色 {{0}}", { "0": custom ? palette.name : t(palette.name) })} pressed={preferences.defaultId === palette.id} onClick={() => { onPreferences({ ...preferences, defaultId: palette.id }); onApply(palette.id); }} />
            <IconButton icon="copy" label={t("复制配色 {{0}}", { "0": custom ? palette.name : t(palette.name) })} disabled={preferences.custom.length >= 32} onClick={() => create(palette)} />
            {custom && <>
              <IconButton icon="edit" label={t("编辑配色 {{0}}", { "0": palette.name })} onClick={() => { setDraft({ ...palette, colors: [...palette.colors] }); setError(""); }} />
              <IconButton icon="trash" label={t("删除配色 {{0}}", { "0": palette.name })} onClick={() => {
                onPreferences({ ...preferences, custom: preferences.custom.filter(p => p.id !== palette.id), defaultId: preferences.defaultId === palette.id ? "original" : preferences.defaultId });
                if (activeId === palette.id) onApply("original"); if (draft?.id === palette.id) setDraft(null);
              }} />
            </>}
          </div>
        </div>;
      })}
      {!palettes.some(p => `${t(p.name)} ${p.name}`.toLowerCase().includes(query.toLowerCase())) && <p className="muted">{t("没有匹配的配色组合")}</p>}
    </div>
    {draft && <section className="palette-editor" aria-label={t("编辑配色组合")}>
      <label>{t("组合名称")}<input aria-label={t("组合名称")} value={draft.name} maxLength={80} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <div className="palette-colors">
        {draft.colors.map((color, index) => <div className="palette-color" key={index}>
          <input type="color" aria-label={t("组合颜色 {{0}}", { "0": index + 1 })} value={color} onChange={e => setDraft({ ...draft, colors: draft.colors.map((c, i) => i === index ? e.target.value : c) })} />
          <code>{color}</code>
          <IconButton icon="close" label={t("删除颜色 {{0}}", { "0": index + 1 })} disabled={draft.colors.length <= 1} onClick={() => setDraft({ ...draft, colors: draft.colors.filter((_, i) => i !== index) })} />
        </div>)}
      </div>
      <div className="group-actions">
        <IconButton icon="plus" label={t("添加颜色")} disabled={draft.colors.length >= 32} onClick={() => setDraft({ ...draft, colors: [...draft.colors, "#808080"] })} />
        <IconButton icon="check" label={t("保存并应用配色")} className="primary" onClick={save} />
        <IconButton icon="close" label={t("取消编辑配色")} onClick={() => { setDraft(null); setError(""); }} />
      </div>
    </section>}
    {error && <p role="alert" className="ai-error">{t(error)}</p>}
    <p className="muted field-help">{t("星标指定新打开文件的默认组合，应用组合会替换当前图层的自定义颜色")}</p>
  </div>;
}
