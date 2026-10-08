import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";
import { ColorField } from "./ColorField";
import { BUILTIN_PALETTES, resolvePalette, validatePalettePreferences, type ColorPalette, type PalettePreferences } from "./palettes";

export function PalettePanel({ preferences, activeId, currentColors, onPreferences, onApply }: {
  preferences: PalettePreferences; activeId: string; currentColors?: string[]; onPreferences: (value: PalettePreferences) => void; onApply: (id: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(""), [draft, setDraft] = useState<ColorPalette | null>(null), [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (draft) nameInput.current?.focus(); }, [!!draft]);
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
    <div className="palette-intro"><Icon name="palette" /><div><strong>{t(draft ? "设计自己的图层配色" : "为版图选择一套配色")}</strong><p className="muted">{t(draft ? "点击色块调整颜色，保存后立即应用到当前版图" : "点击卡片应用，星标设为新文件的默认组合")}</p></div></div>
    {!draft && <>
      <div className="palette-toolbar"><div className="palette-search"><Icon name="search" /><input aria-label={t("筛选配色组合")} placeholder={t("筛选配色组合")} value={query} maxLength={80} onChange={e => setQuery(e.target.value)} /></div>
        <IconButton icon="plus" label={t("新增配色组合")} disabled={preferences.custom.length >= 32} onClick={() => create({ ...resolvePalette(activeId, preferences.custom), ...(currentColors?.length ? { colors: currentColors.slice(0, 32) } : {}) })} />
      </div>
      <div className="palette-list">
        {palettes.filter(p => `${t(p.name)} ${p.name}`.toLowerCase().includes(query.toLowerCase())).map(palette => {
          const custom = preferences.custom.some(p => p.id === palette.id), name = custom ? palette.name : t(palette.name);
          const selected = activeId === palette.id;
          return <div className={`palette-row ${selected ? "selected" : ""}`} key={palette.id}>
            <button className="palette-apply" aria-label={t("应用配色 {{0}}", { "0": name })} aria-pressed={selected} onClick={() => onApply(palette.id)}>
              <span className="palette-card-title"><strong>{name}</strong>{selected && <span className="palette-active-badge"><Icon name="check" />{t("已应用")}</span>}</span>
              <span className="palette-strip" aria-hidden="true">{palette.colors.map((color, i) => <span key={i} style={{ background: color }} />)}</span>
            </button>
            <div className="palette-card-foot"><span className="palette-card-meta">{t(custom ? "自定义" : "预设")} · {palette.colors.length} {t("色")}</span><div className="palette-actions">
              <IconButton icon="star" label={t("设为默认配色 {{0}}", { "0": name })} pressed={preferences.defaultId === palette.id} onClick={() => { onPreferences({ ...preferences, defaultId: palette.id }); onApply(palette.id); }} />
              <IconButton icon="copy" label={t("复制配色 {{0}}", { "0": name })} disabled={preferences.custom.length >= 32} onClick={() => create(palette)} />
              {custom && <>
                <IconButton icon="edit" label={t("编辑配色 {{0}}", { "0": palette.name })} onClick={() => { setDraft({ ...palette, colors: [...palette.colors] }); setError(""); }} />
                <IconButton icon="trash" label={t("删除配色 {{0}}", { "0": palette.name })} onClick={() => {
                  onPreferences({ ...preferences, custom: preferences.custom.filter(p => p.id !== palette.id), defaultId: preferences.defaultId === palette.id ? "original" : preferences.defaultId });
                  if (activeId === palette.id) onApply("original");
                }} />
              </>}
            </div></div>
          </div>;
        })}
        {!palettes.some(p => `${t(p.name)} ${p.name}`.toLowerCase().includes(query.toLowerCase())) && <p className="muted">{t("没有匹配的配色组合")}</p>}
      </div>
    </>}
    {draft && <section className="palette-editor" aria-label={t("编辑配色组合")}>
      <label>{t("组合名称")}<input ref={nameInput} aria-label={t("组合名称")} value={draft.name} maxLength={80} placeholder={t("例如：我的金属层配色")} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <div className="palette-editor-heading"><strong>{t("颜色顺序")}</strong><span className="muted">{draft.colors.length} / 32</span></div>
      <div className="palette-colors">
        {draft.colors.map((color, index) => <div className="palette-color" key={index}>
          <div className="palette-color-heading"><span>{t("颜色 {{0}}", { "0": String(index + 1).padStart(2, "0") })}</span><IconButton icon="close" label={t("删除颜色 {{0}}", { "0": index + 1 })} disabled={draft.colors.length <= 1} onClick={() => setDraft({ ...draft, colors: draft.colors.filter((_, i) => i !== index) })} /></div>
          <ColorField showValue label={t("组合颜色 {{0}}", { "0": index + 1 })} value={color} onChange={value => setDraft({ ...draft, colors: draft.colors.map((c, i) => i === index ? value : c) })} />
        </div>)}
        <button className="palette-add-color" aria-label={t("添加颜色")} disabled={draft.colors.length >= 32} onClick={() => setDraft({ ...draft, colors: [...draft.colors, "#808080"] })}><Icon name="plus" /><span>{t("添加颜色")}</span></button>
      </div>
      <p className="muted">{t("颜色按图层顺序依次使用，图层较多时循环组合")}</p>
      <div className="palette-editor-actions"><IconButton icon="back" label={t("取消编辑配色")} onClick={() => { setDraft(null); setError(""); }} /><button className="text-button primary" onClick={save}><Icon name="check" />{t("保存并应用配色")}</button></div>
    </section>}
    {error && <p role="alert" className="ai-error">{t(error)}</p>}
    <div className="palette-privacy"><Icon name="shield" /><p className="muted">{t("仅将组合名称、颜色和默认组合保存在本机浏览器，版图与密钥不写入配色偏好")}</p></div>
  </div>;
}
