import { useI18n } from "./i18n";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Icon } from "./Icon";
import { IconButton as Button } from "./IconButton";
import { PalettePanel } from "./PalettePanel";
import { PALETTE_STORAGE, DEFAULT_PALETTE_PREFERENCES, readPalettePreferences, resolvePalette, validColor } from "./palettes";
import { LIMITS } from "./types";
import type { Layout, PickInfo } from "./types";
import { Viewer } from "./Viewer";
import { featureKind } from "./Viewer";
import type { CameraPose, ViewerHandle } from "./Viewer";
import { ExplanationPanel } from "./ExplanationPanel";
import { SourceData } from "./SourceData";
import { parseLayerNames, validateLayerNames, exportLayerNames } from "./layerNames";
import { CellHierarchy } from "./CellHierarchy";
import "./workbench.css";
import tokens from "./tokens.json";
type Panel = "layers" | "cells" | "notes" | "bookmarks";
interface Bookmark {
  name: string;
  camera: CameraPose;
  visible: string[];
  explode: number;
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="modal"
      aria-labelledby={titleId}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <Button icon="close" label={t("关闭")} onClick={onClose} />
      </div>
      <div className="modal-body">{children}</div>
      <div className="modal-foot">
        <Button icon="back" label={t("返回工作台")} onClick={onClose} />
      </div>
    </dialog>
  );
}
export default function Workbench() {
  const { t, locale, setLocale } = useI18n();
  const [selectedObject, setSelectedObject] = useState<PickInfo | null>(null);
  const [inspectorTab, setInspectorTab] = useState("overview");
  const [layerNames, setLayerNames] = useState<Record<string, string>>({});
  const [palettePreferences, setPalettePreferences] = useState(() => { try { return readPalettePreferences(); } catch { return DEFAULT_PALETTE_PREFERENCES; } });
  const [paletteId, setPaletteId] = useState(palettePreferences.defaultId);
  const [layerColors, setLayerColors] = useState<Record<string, string>>({});
  const [paletteOpen, setPaletteOpen] = useState(false), [exportOpen, setExportOpen] = useState<"all" | "maps" | null>(null);
  const activePalette = resolvePalette(paletteId, palettePreferences.custom);
  const defaultPaletteId = useRef(palettePreferences.defaultId);
  defaultPaletteId.current = palettePreferences.defaultId;
  const applyPalette = (id: string) => { setPaletteId(id); setLayerColors({}); };
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [measuring, setMeasuring] = useState(false);
  const [cellView, setCellView] = useState<"list" | "hierarchy">("hierarchy");
  const [rename, setRename] = useState<{ id: string; value: string } | null>(null);
  const mappingInput = useRef<HTMLInputElement>(null);
  const layerName = (id: string, fallback?: string) => layerNames[id] ?? fallback ?? `Layer ${id}`;
  const [layout, setLayout] = useState<Layout | null>(null),
    [visible, setVisible] = useState<string[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const displayedColors = useMemo(() => Object.fromEntries((layout?.layers ?? []).map((layer, index) => [layer.id, layerColors[layer.id] ?? (activePalette.id === "original" ? layer.color : activePalette.colors[index % activePalette.colors.length])])), [layout, layerColors, activePalette]);
  const colorForLayer = (id: string, _index?: number) => displayedColors[id] ?? activePalette.colors[0];
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("等待打开文件");
  const [panel, setPanel] = useState<Panel>("layers"),
    [left, setLeft] = useState(true),
    [right, setRight] = useState(true),
    [swapped, setSwapped] = useState(false);
  const [widths, setWidths] = useState([256, 272]),
    [theme, setTheme] = useState("dark"),
    [help, setHelp] = useState(false),
    [search, setSearch] = useState("");
  const [explode, setExplode] = useState(0),
    [note, setNote] = useState(""),
    [notes, setNotes] = useState<string[]>([]),
    [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [baseline, setBaseline] = useState<{
      name: string;
      layers: number;
      triangles: number;
    } | null>(null),
    [storage, setStorage] = useState("偏好仅保存在本次会话");
  const [viewport, setViewport] = useState(innerWidth);
  const [dragging, setDragging] = useState(false),
    [mobile, setMobile] = useState(
      () => matchMedia("(max-width: 1050px)").matches,
    );
  const fileInput = useRef<HTMLInputElement>(null),
    reviewInput = useRef<HTMLInputElement>(null),
    viewer = useRef<ViewerHandle>(null),
    worker = useRef<Worker | null>(null),
    source = useRef<File | null>(null),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    abort = useRef<AbortController | null>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const palettePreferenceReady = useRef(false);
  useEffect(() => {
    if (!palettePreferenceReady.current) { palettePreferenceReady.current = true; return; }
    try { localStorage.setItem(PALETTE_STORAGE, JSON.stringify(palettePreferences)); }
    catch { setStorage("配色偏好保存失败，当前使用会话模式"); }
  }, [palettePreferences]);
  useEffect(() => {
    const media = matchMedia("(max-width: 1050px)");
    const update = () => {
      setMobile(media.matches);
      setLeft(!media.matches);
      setRight(!media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("gds-3d-viewer.preferences.v1") ?? "null",
      );
      if (saved) {
        if (["dark", "light"].includes(saved.theme)) setTheme(saved.theme);
        if (
          Array.isArray(saved.widths) &&
          saved.widths.length === 2 &&
          saved.widths.every(
            (x: number) => Number.isFinite(x) && x >= 220 && x <= 400,
          )
        )
          setWidths(saved.widths);
        setSwapped(saved.swapped === true);
      }
      setStorage("只保存界面偏好，版图与记录留在本次会话");
    } catch {
      setStorage("浏览器禁止保存偏好，当前使用会话模式");
    }
    return () => {
      generation.current++;
      worker.current?.terminate();
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    const update = () => setViewport(innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    if (!mobile || (!left && !right)) return;
    const aside = document.querySelector<HTMLElement>(
        left ? ".navigation-pane" : ".inspector-pane",
      ),
      previous = document.activeElement;
    const main = document.querySelector<HTMLElement>(".main-pane"),
      top = document.querySelector<HTMLElement>(".topbar"),
      rail = document.querySelector<HTMLElement>(".activity-rail");
    [main, top, rail].forEach((el) => {
      if (el) el.inert = true;
    });
    aside?.querySelector<HTMLElement>("button")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !aside || document.querySelector("dialog[open]")) return;
      const controls = [
        ...aside.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea,a[href]",
        ),
      ].filter((x) => x.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      [main, top, rail].forEach((el) => {
        if (el) el.inert = false;
      });
      window.removeEventListener("keydown", trap);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [mobile, left, right]);
  const preferenceReady = useRef(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!preferenceReady.current) {
      preferenceReady.current = true;
      return;
    }
    try {
      localStorage.setItem(
        "gds-3d-viewer.preferences.v1",
        JSON.stringify({ theme, widths, swapped }),
      );
    } catch {
      setStorage("偏好保存失败，当前使用会话模式");
    }
  }, [theme, widths, swapped]);
  const cancel = useCallback(() => {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setStatus("导入已取消，原版图保留");
  }, []);
  const openFile = useCallback(async (file: File, top?: string) => {
    const id = ++generation.current;
    worker.current?.terminate();
    abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    setError("");
    if (!/\.(gds|gds2|gdsii|gltf|glb)$/i.test(file.name)) {
      setError("请选择 .gds、.gds2、.gdsii、.gltf 或 .glb 文件");
      setBusy(false);
      return;
    }
    if (file.size > LIMITS.fileBytes) {
      setError("文件超过 32 MB，请在原版图工具中导出较小单元");
      setBusy(false);
      return;
    }
    setBusy(true);
    setStatus("正在本地解析，文件不会上传");
    const task = new Worker(new URL("./parser.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = task;
    const fail = (message: string) => {
      if (id !== generation.current) return;
      task.terminate();
      worker.current = null;
      if (timer.current) clearTimeout(timer.current);
      setBusy(false);
      setError(message);
      setStatus("导入失败，原版图保留");
    };
    timer.current = setTimeout(
      () => fail("解析超过 45 秒，任务已终止，请尝试较小单元"),
      LIMITS.seconds * 1000,
    );
    task.onerror = () => fail("解析任务异常，原版图和记录已保留");
    task.onmessage = (
      event: MessageEvent<{ layout?: Layout; error?: string }>,
    ) => {
      if (id !== generation.current) return;
      if (event.data.error || !event.data.layout) {
        fail(event.data.error ?? "解析结果无效");
        return;
      }
      task.terminate();
      worker.current = null;
      if (timer.current) clearTimeout(timer.current);
      const result = event.data.layout;
      if (!top) { setLayerNames({}); setLayerColors({}); setPaletteId(defaultPaletteId.current); }
      setRename(null);
      setLayout(result);
      setVisible(result.layers.map((l) => l.id));
      setSelected(null);
      setSelectedObject(null);
      setExplode(0);
      setSearch("");
      if (!top) {
        setNotes([]);
        setNote("");
      }
      setBookmarks([]);
      source.current = file;
      setBusy(false);
      setStatus(
        result.layers.length
          ? `${file.name} · ${result.layers.length} 个图层 · ${result.incomplete ? "不完整预览，缺失引用已列出" : "本地解析完成"}`
          : result.incomplete && result.missingReferences?.length
            ? "已读取单元目录，缺失引用已列出"
            : "已读取单元目录，请选择较小单元",
      );
      if (!result.layers.length) {
        if (!result.incomplete && result.gds?.labels.length) {
          setInspectorTab("source"); setRight(true); setLeft(false);
          setStatus("已读取文字标签，请在源数据中查看");
          return;
        }
        setPanel("cells");
        setLeft(true);
        setRight(false);
      }
    };
    try {
      const buffer = await file.arrayBuffer();
      if (id !== generation.current) return;
      task.postMessage({ buffer, name: file.name, top }, [buffer]);
    } catch {
      fail("无法读取文件，请重新选择");
    }
  }, []);
  async function demo() {
    const id = ++generation.current;
    worker.current?.terminate();
    if (timer.current) clearTimeout(timer.current);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setBusy(true);
    setStatus("正在加载合成示例");
    try {
      const response = await fetch("/samples/demo.gds", {
        signal: controller.signal,
        credentials: "omit",
      });
      if (!response.ok) throw new Error("示例暂时无法读取，请打开本地文件");
      const blob = await response.blob();
      if (id !== generation.current) return;
      await openFile(new File([blob], "aialra-demo.gds"));
    } catch (e) {
      if (id !== generation.current) return;
      setBusy(false);
      setError(e instanceof Error ? e.message : "示例加载失败");
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !help && !paletteOpen && !exportOpen) {
        if (search) {
          setSearch("");
        } else if (busy) cancel();
        else if (mobile) {
          setLeft(false);
          setRight(false);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInput.current?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help, paletteOpen, exportOpen, search, busy, mobile, cancel]);
  function saveBlob(content: string, name: string) {
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportReview() {
    if (!layout) return;
    saveBlob(
      JSON.stringify(
        {
          format: "gds-3d-viewer-review",
          version: 1,
          file: layout.name,
          top: layout.top,
          notes,
          layerNames,
          layerColors: Object.fromEntries(layout.layers.map((layer, index) => [layer.id, colorForLayer(layer.id, index)])),
          bookmarks,
          visible,
          explode,
          metrics: {
            layers: layout.layers.length,
            triangles: layout.triangles,
            instances: layout.instances,
            bounds: layout.bounds,
          },
          camera: viewer.current?.camera(),
        },
        null,
        2,
      ),
      `${layout.name}.review.json`,
    );
    setStatus("已导出审阅记录，原始版图文件需单独保留");
  }
  async function importReview(file: File) {
    const current = layout,
      id = generation.current;
    if (!current) {
      setError("请先打开对应版图，再导入审阅记录");
      return;
    }
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("审阅记录不能超过 2 MB");
      const data = JSON.parse(await file.text());
      if (id !== generation.current) return;
      const pose = (v: CameraPose) =>
        v &&
        (v.projection === undefined || v.projection === "2d" || v.projection === "3d") &&
        (v.zoom === undefined || (Number.isFinite(v.zoom) && v.zoom >= 0.05 && v.zoom <= 1000)) &&
        (v.projection !== "2d" || current.format === "gds") &&
        [v.position, v.target].every(
          (a) =>
            Array.isArray(a) &&
            a.length === 3 &&
            a.every(
              (n) =>
                typeof n === "number" &&
                Number.isFinite(n) &&
                Math.abs(n) <= 1000,
            ),
        );
      const layerIds = (v: unknown): v is string[] =>
        Array.isArray(v) &&
        v.length <= current.layers.length &&
        v.every(
          (x) =>
            typeof x === "string" && current.layers.some((l) => l.id === x),
        );
      if (
        !["gds-3d-viewer-review", "icviewer-review"].includes(data.format) ||
        data.version !== 1 ||
        data.file !== current.name ||
        data.top !== current.top ||
        !Array.isArray(data.notes) ||
        data.notes.length > 200 ||
        data.notes.some(
          (n: unknown) => typeof n !== "string" || n.length > 4000,
        ) ||
        !Array.isArray(data.bookmarks) ||
        data.bookmarks.length > 50 ||
        data.bookmarks.some(
          (b: Bookmark) =>
            !b ||
            typeof b.name !== "string" ||
            b.name.length > 128 ||
            !pose(b.camera) ||
            !layerIds(b.visible) ||
            !Number.isFinite(b.explode) ||
            b.explode < 0 ||
            b.explode > 10,
        ) ||
        !layerIds(data.visible) ||
        !Number.isFinite(data.explode) ||
        data.explode < 0 ||
        data.explode > 10 ||
        !pose(data.camera)
      )
        throw new Error("审阅记录无效，或与当前文件及单元不匹配");
      const restoredNames = validateLayerNames(data.layerNames ?? {});
      const restoredColors = data.layerColors ?? {};
      if (!restoredColors || typeof restoredColors !== "object" || Array.isArray(restoredColors) || Object.keys(restoredColors).length > current.layers.length || Object.entries(restoredColors).some(([id, color]) => !current.layers.some(layer => layer.id === id) || !validColor(color))) throw new Error("审阅记录中的颜色无效");
      setLayerNames(restoredNames);
      setLayerColors(restoredColors);
      setNotes(data.notes);
      setBookmarks(data.bookmarks);
      setVisible(data.visible);
      setExplode(data.explode);
      viewer.current?.restore(data.camera);
      setError("");
      setStatus("审阅记录已恢复到当前会话");
    } catch (e) {
      setError(e instanceof Error ? e.message : "审阅记录无法读取");
    }
  }
  function showPanel(next: Panel) {
    setPanel(next);
    setLeft(true);
    if (mobile) setRight(false);
    setSearch("");
  }
  async function importMapping(file: File) {
    const id = generation.current;
    try {
      if (file.size > 1024 * 1024) throw new Error("图层映射不能超过 1 MB");
      const names = parseLayerNames(await file.text(), file.name);
      if (id !== generation.current) return;
      setLayerNames(names); setRename(null); setError("");
      setStatus(`当前单元匹配 ${layout?.layers.filter((layer) => names[layer.id]).length ?? 0} / ${Object.keys(names).length} 个图层名称，其他名称仍保留在映射中`);
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "图层映射无法读取"); }
  }
  function exportMapping(format: "json" | "lyp") {
    try {
      const url = URL.createObjectURL(new Blob([exportLayerNames(layerNames, format)], { type: format === "json" ? "application/json" : "application/xml" }));
      const link = document.createElement("a"); link.href = url; link.download = `gds-layer-names.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setExportOpen(null);
    } catch (error) { setError(error instanceof Error ? error.message : "图层映射无法读取"); }
  }
  function toggleLayer(id: string) {
    setVisible((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  }
  function resize(side: number, delta: number) {
    setWidths((w) =>
      w.map((value, i) =>
        i === side ? Math.min(400, Math.max(220, value + delta)) : value,
      ),
    );
  }
  function startResize(
    e: ReactPointerEvent<HTMLDivElement>,
    index: number,
    direction: number,
  ) {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const initial = widths[index],
      start = e.clientX;
    const move = (p: PointerEvent) =>
      setWidths((w) =>
        w.map((v, i) =>
          i === index
            ? Math.min(
                400,
                Math.max(220, initial + direction * (p.clientX - start)),
              )
            : v,
        ),
      );
    const cleanup = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", rollback);
      window.removeEventListener("keydown", escape);
    };
    const finish = () => cleanup();
    const rollback = () => {
      setWidths((w) => w.map((v, i) => (i === index ? initial : v)));
      cleanup();
    };
    const escape = (k: KeyboardEvent) => {
      if (k.key === "Escape") rollback();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish, { once: true });
    target.addEventListener("pointercancel", rollback, { once: true });
    window.addEventListener("keydown", escape);
  }
  const leftIndex = swapped ? 1 : 0,
    rightIndex = swapped ? 0 : 1,
    hasLeft = swapped ? right : left,
    hasRight = swapped ? left : right;
  const budget = Math.max(
    440,
    viewport - 84 - 360 - (hasLeft ? 16 : 0) - (hasRight ? 16 : 0),
  );
  const requested =
      (hasLeft ? widths[leftIndex] : 0) + (hasRight ? widths[rightIndex] : 0),
    ratio = requested > budget ? budget / requested : 1;
  const renderedLeft = Math.max(220, Math.floor(widths[leftIndex] * ratio)),
    renderedRight = Math.max(220, Math.floor(widths[rightIndex] * ratio));
  const selectedLayer = layout?.layers.find((l) => l.id === selected),
    shownLayers =
      layout?.layers.filter((l) =>
        `${layerName(l.id, l.name)} ${l.id}`.toLowerCase().includes(search.toLowerCase()),
      ) ?? [],
    shownCells =
      layout?.cells.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      ) ?? [];
  const tools = (
    <>
      <Button
        icon="fit"
        label={t("适应整个版图")}
        onClick={() => viewer.current?.view("fit")}
        disabled={!layout}
      />
      <Button icon="plane" label={t("二维")} pressed={viewMode === "2d"} disabled={!layout || layout.format !== "gds" || !layout.layers.length} onClick={() => viewer.current?.view("2d")} />
      <Button icon="topview" label={t("俯视")} onClick={() => viewer.current?.view("top")} disabled={!layout} />
      <Button icon="frontview" label={t("正视")} onClick={() => viewer.current?.view("front")} disabled={!layout} />
      <Button icon="cube" label={t("三维")} onClick={() => viewer.current?.view("iso")} pressed={viewMode === "3d"} disabled={!layout} />
      <Button icon="ruler" label={t("测量")} pressed={measuring} disabled={!layout || layout.format !== "gds" || !layout.layers.length} onClick={() => { if (!measuring) viewer.current?.view("2d"); setMeasuring(value => !value); }} />
    </>
  );
  const navigator = (
    <aside
      className={`pane navigation-pane ${swapped ? "on-right" : ""}`}
      aria-label={t("版图导航")}
    >
      <div className="pane-head">
        <h2>
          {
            {
              layers: t("图层"),
              cells: t("单元"),
              notes: t("审阅记录"),
              bookmarks: t("视角书签"),
            }[panel]
          }
        </h2>
        <Button icon="close" label={t("收起导航")} onClick={() => setLeft(false)} />
      </div>
      <div className="pane-content">
        {(panel === "layers" || panel === "cells") && (
          <div className="filter-box">
            <Icon name="search" />
            <input
              aria-label={panel === "layers" ? t("筛选图层") : t("筛选单元")}
              value={search}
              placeholder={panel === "layers" ? t("筛选图层…") : t("筛选单元…")}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button
                icon="close"
                label={t("清除筛选")}
                onClick={() => setSearch("")}
              />
            )}
          </div>
        )}
        {panel === "layers" && (
          <>
            <div className="group-actions">
              <Button icon="upload" label={t("导入层映射")} disabled={!layout || layout.format !== "gds"} onClick={() => mappingInput.current?.click()} />
              <Button icon="download" label={t("导出图层映射")} popup="dialog" disabled={!layout || layout.format !== "gds"} onClick={() => setExportOpen("maps")} />
              <Button icon="palette" label={t("配色组合")} popup="dialog" onClick={() => setPaletteOpen(true)} />
              <Button icon="eye" label={t("显示全部")} disabled={!layout} onClick={() => setVisible(layout?.layers.map(l => l.id) ?? [])} />
              <Button icon="eyeoff" label={t("隐藏全部")} disabled={!layout} onClick={() => setVisible([])} />
            </div>
            <p className="muted field-help">{t("映射仅包含自定义名称，不包含颜色、厚度或版图几何")}</p>
            <div className="layer-list">
              {shownLayers.map((layer) => (
                <div
                  key={layer.id}
                  className={`layer-row ${selected === layer.id ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    aria-label={t("显示 {{0}}", {"0": layerName(layer.id, layer.name)})}
                    checked={visible.includes(layer.id)}
                    onChange={() => toggleLayer(layer.id)}
                  />
                  <input type="color" className="layer-color" aria-label={t("修改图层 {{0}} 的颜色", { "0": layer.id })} title={t("修改图层 {{0}} 的颜色", { "0": layer.id })}
                    value={colorForLayer(layer.id, layout!.layers.indexOf(layer))} onChange={e => setLayerColors(colors => ({ ...colors, [layer.id]: e.target.value }))} />
                  <button
                    className="layer-name"
                    title={`${layerName(layer.id, layer.name)} · ${layer.id}`}
                    onClick={() => { setSelected(layer.id); setSelectedObject(null); setInspectorTab("overview"); setRight(true); if (mobile) setLeft(false); }}
                  >
                    {layerName(layer.id, layer.name)}
                    <small>
                      {layerNames[layer.id] && `${layer.id} · `}
                      {layer.polygons.toLocaleString()}{" "}
                      {layout?.format === "gds" ? t("多边形") : t("三角形")}
                    </small>
                  </button>
                  <button
                    className="icon-button isolate"
                    title={t("只看 {{0}}", {"0": layer.name})}
                    aria-label={t("只看 {{0}}", {"0": layer.name})}
                    onClick={() => {
                      setVisible([layer.id]);
                      setSelected(layer.id);
                      setSelectedObject(null);
                    }}
                  >
                    <Icon name="fit" />
                  </button>
                </div>
              ))}
            </div>
            {!shownLayers.length && (
              <p className="muted empty-panel">
                {layout ? t("没有匹配图层") : t("打开版图后显示图层")}
              </p>
            )}
          </>
        )}
        {panel === "cells" && (
          <>
            {layout?.format === "gds" && <div className="group-actions" role="group" aria-label={t("单元浏览方式")}>
              <Button icon="tree" label={t("层级树")} pressed={cellView === "hierarchy"} onClick={() => setCellView("hierarchy")} />
              <Button icon="list" label={t("全部单元")} pressed={cellView === "list"} onClick={() => setCellView("list")} />
            </div>}
            <p className="muted field-help">
              {layout?.format === "gds"
                ? t("选择单元可独立查看其几何与引用")
                : t("模型节点与引用数量")}
            </p>
            {layout?.format === "gds" && cellView === "hierarchy" && !search ? <CellHierarchy key={layout.name} layout={layout} busy={busy} onOpen={(name) => { if (source.current) void openFile(source.current, name); }} /> : <div className="cell-list">
              {shownCells.slice(0, 300).map((cell, index) => (
                <button
                  key={`${cell.name}-${index}`}
                  className={`cell-row ${layout?.top === cell.name ? "selected" : ""}`}
                  disabled={busy || layout?.format !== "gds"}
                  onClick={() => {
                    if (source.current)
                      void openFile(source.current, cell.name);
                  }}
                  title={cell.name}
                >
                  <Icon name="chip" />
                  <span>
                    {cell.name}
                    <small>
                      {cell.polygons}  {t("个直接多边形 ·")} {cell.references}  {t("个引用")} </small>
                  </span>
                  {layout?.top === cell.name && (
                    <span className="current-label"> {t("当前")} </span>
                  )}
                </button>
              ))}
            </div>}
            {shownCells.length > 300 && (
              <p className="muted"> {t("显示前 300 项，请使用筛选定位")} </p>
            )}
            {!shownCells.length && (
              <p className="muted empty-panel">
                {layout ? t("没有匹配单元") : t("打开版图后显示单元")}
              </p>
            )}
          </>
        )}
        {panel === "notes" && (
          <div className="notes-content">
            <label htmlFor="review-note"> {t("新增记录")} </label>
            <textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={4000}
              rows={5}
              placeholder={t("记录当前观察与待核对问题…")}
            />
            <Button icon="plus" label={t("加入记录")} className="primary"
              disabled={!layout || !note.trim() || notes.length >= 200}
              onClick={() => {
                setNotes((n) => [...n, note.trim()]);
                setNote("");
                setStatus("记录已加入当前会话，请导出以保留");
              }}
            />
            <p className="muted"> {t("关闭页面后会话会清空，请导出记录")} </p>
            {notes.map((n, i) => (
              <article className="note-item" key={i}>
                <small> {t("记录")} {i + 1}</small>
                <p>{n}</p>
              </article>
            ))}
            {!notes.length && <p className="muted"> {t("暂无审阅记录")} </p>}
          </div>
        )}
        {panel === "bookmarks" && (
          <div className="bookmarks-content">
            <Button icon="bookmark" label={t("保存当前视角")}
              disabled={!layout || bookmarks.length >= 50}
              onClick={() => {
                const camera = viewer.current?.camera();
                if (camera)
                  setBookmarks((b) => [
                    ...b,
                    {
                      name: `视角 ${b.length + 1}`,
                      camera,
                      visible: [...visible],
                      explode,
                    },
                  ]);
              }}
            />
            {bookmarks.map((b, i) => (
              <button
                className="cell-row"
                key={i}
                onClick={() => {
                  setVisible(b.visible);
                  setExplode(b.explode);
                  viewer.current?.restore(b.camera);
                }}
              >
                <Icon name="bookmark" />
                {b.name}
              </button>
            ))}
            {!bookmarks.length && (
              <p className="muted"> {t("保存相机位置、图层选择与展开距离")} </p>
            )}
          </div>
        )}
      </div>
      <div className="pane-foot">
        {panel === "layers"
          ? t("{{0}} / {{1}} 个图层 · {{2}} 个显示", {"0": shownLayers.length, "1": layout?.layers.length ?? 0, "2": visible.length})
          : panel === "cells"
            ? t("{{0}} / {{1}} 个单元", {"0": shownCells.length, "1": layout?.cells.length ?? 0})
            : t("记录仅保存在当前会话")}
      </div>
    </aside>
  );
  const inspector = (
    <aside
      className={`pane inspector-pane ${swapped ? "on-left" : ""}`}
      aria-label={t("版图检查器")}
    >
      <div className="pane-head">
        <h2> {t("检查器")} </h2>
        <Button
          icon="close"
          label={t("收起检查器")}
          onClick={() => setRight(false)}
        />
      </div>
      <div className="inspector-tabs" role="tablist" aria-label={t("检查器标签页")}>
        {[["overview", t("概览")], ["display", t("显示")], ["source", t("源数据")], ["ai", t("AI")]].map(([id, label], i, tabs) => <button key={id} id={`inspector-tab-${id}`} role="tab" aria-selected={inspectorTab === id} aria-controls={`inspector-panel-${id}`} tabIndex={inspectorTab === id ? 0 : -1} onClick={() => setInspectorTab(id)} onKeyDown={(event) => {
          const target = event.key === "ArrowRight" ? (i + 1) % tabs.length : event.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (target < 0) return; event.preventDefault(); setInspectorTab(tabs[target][0]); document.getElementById(`inspector-tab-${tabs[target][0]}`)?.focus();
        }}>{label}</button>)}
      </div>
      <div className="pane-content inspector-content">
        <div role="tabpanel" id="inspector-panel-overview" aria-labelledby="inspector-tab-overview" hidden={inspectorTab !== "overview"}>
        {selectedObject?.feature && <section className="object-inspection" aria-label={t("选中图形详情")}>
          <h3> {t("选中图形")} </h3>
          <p className="object-name">{t(featureKind(selectedObject.feature.kind))}</p>
          <dl>
            <div><dt> {t("来源单元")} </dt><dd>{selectedObject.feature.cell}</dd></div>
            <div><dt> {t("图层 / 类型")} </dt><dd>{layerName(selectedObject.layerId)} · {selectedObject.layerId}</dd></div>
            <div><dt> {t("图形标识")} </dt><dd>{selectedObject.feature.id}</dd></div>
            <div><dt> {t("点击坐标")} </dt><dd>{selectedObject.point.slice(0, layout?.format === "gds" ? 2 : 3).map((v) => v.toFixed(3)).join(", ")} {layout?.unit}</dd></div>
            <div><dt> {t("平面范围")} </dt><dd>{selectedObject.feature.bounds.map((v) => v.toFixed(3)).join(", ")} {layout?.unit}</dd></div>
            <div><dt> {t("顶点")} </dt><dd>{selectedObject.feature.vertices.toLocaleString()}</dd></div>
            {selectedObject.feature.area !== undefined && <div><dt> {t("几何面积")} </dt><dd>{selectedObject.feature.area.toFixed(3)} {layout?.unit}²</dd></div>}
            {selectedObject.feature.pathWidth !== undefined && <div><dt> {t("路径宽度")} </dt><dd>{selectedObject.feature.pathWidth.toFixed(3)} {layout?.unit}</dd></div>}
            {selectedObject.feature.pathLength !== undefined && <div><dt> {t("路径长度")} </dt><dd>{selectedObject.feature.pathLength.toFixed(3)} {layout?.unit}</dd></div>}
            {selectedObject.feature.byteOffset !== undefined && <div><dt> {t("源记录偏移")} </dt><dd>{selectedObject.feature.byteOffset}  {t("字节")} </dd></div>}
          </dl>
          <details><summary> {t("查看引用实例路径")} </summary><p className="instance-path">{selectedObject.feature.instance}</p></details>
          {!!selectedObject.feature.properties?.length && <details><summary>{t("元素属性")}</summary>{selectedObject.feature.properties.map((property, i) => <p className="instance-path" key={i}>{property.attribute}: {property.value}</p>)}</details>}
          <p className="muted"> {t("几何属性来自文件，电气连通性与工艺用途需要额外资料")} </p>
          <Button icon="close" label={t("清除选择")} onClick={() => setSelectedObject(null)} />
        </section>}
        <section>
          <h3>{selectedLayer ? t("选中图层") : t("当前版图")}</h3>
          <p className="object-name">
            {selectedLayer ? layerName(selectedLayer.id, selectedLayer.name) : layout?.top ?? t("尚未打开")}
          </p>
          <dl>
            <div>
              <dt> {t("文件")} </dt>
              <dd title={layout?.name}>{layout?.name ?? "—"}</dd>
            </div>
            <div>
              <dt> {t("格式")} </dt>
              <dd>{layout?.format.toUpperCase() ?? "—"}</dd>
            </div>
            {selectedLayer && (
              <div>
                <dt>{layout?.format === "gds" ? t("多边形") : t("三角形")}</dt>
                <dd>{selectedLayer.polygons.toLocaleString()}</dd>
              </div>
            )}
          </dl>
          {selectedLayer && layout?.format === "gds" && (
            <div className="layer-rename">
              <p className="muted">{selectedLayer.id} · {t("名称由用户或层映射提供，层号保持不变")}</p>
              <label>{t("图层名称")}<input aria-label={t("图层名称")} maxLength={128} value={rename?.id === selectedLayer.id ? rename.value : layerNames[selectedLayer.id] ?? ""} placeholder={selectedLayer.name} onChange={(e) => setRename({ id: selectedLayer.id, value: e.target.value })} /></label>
              <div className="group-actions"><Button icon="check" label={t("保存名称")} onClick={() => {
                const value = rename?.id === selectedLayer.id ? rename.value.trim() : layerNames[selectedLayer.id] ?? "";
                try { const names = value ? validateLayerNames({ ...layerNames, [selectedLayer.id]: value }) : Object.fromEntries(Object.entries(layerNames).filter(([id]) => id !== selectedLayer.id)); setLayerNames(names); setRename(null); }
                catch (e) { setError(e instanceof Error ? e.message : "图层映射无法读取"); }
              }} /><Button icon="reset" label={t("恢复默认")} onClick={() => { setLayerNames(Object.fromEntries(Object.entries(layerNames).filter(([id]) => id !== selectedLayer.id))); setRename(null); }} /></div>
            </div>
          )}
          {selectedLayer && (
            <Button icon="fit" label={t("隔离当前图层")}
              onClick={() => {
                setVisible([selectedLayer.id]);
              }}
            />
          )}
        </section>
        <section>
          <h3> {t("几何统计")} </h3>
          <dl>
            <div>
              <dt> {t("图层 / 材质")} </dt>
              <dd>{layout?.layers.length.toLocaleString() ?? "—"}</dd>
            </div>
            <div>
              <dt> {t("单元 / 节点")} </dt>
              <dd>{layout?.cells.length.toLocaleString() ?? "—"}</dd>
            </div>
            <div>
              <dt> {t("展开实例")} </dt>
              <dd>
                {layout?.layers.length
                  ? layout.instances.toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt> {t("三角形")} </dt>
              <dd>
                {layout?.layers.length
                  ? layout.triangles.toLocaleString()
                  : "—"}
              </dd>
            </div>
            {layout?.rendering && <div><dt>{t("复用源三角形")}</dt><dd>{layout.rendering.storedTriangles.toLocaleString()}</dd></div>}
            <div>
              <dt> {t("平面宽度")} </dt>
              <dd>
                {layout?.layers.length
                  ? `${(layout.bounds[2] - layout.bounds[0]).toFixed(2)} ${layout.unit}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt> {t("平面高度")} </dt>
              <dd>
                {layout?.layers.length
                  ? `${(layout.bounds[3] - layout.bounds[1]).toFixed(2)} ${layout.unit}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
        </div>
        <div role="tabpanel" id="inspector-panel-display" aria-labelledby="inspector-tab-display" hidden={inspectorTab !== "display"}>
        <section>
          <h3> {t("图层展开")} </h3>
          <label className="range-label" htmlFor="explode">
             {t("层间距")} <span>{explode}</span>
          </label>
          <input
            type="range"
            id="explode"
            min="0"
            max="10"
            step="0.5"
            value={explode}
            disabled={!layout}
            onChange={(e) => setExplode(Number(e.target.value))}
          />
          <p className="muted"> {t("用于观察遮挡关系，不表示工艺尺寸")} </p>
          <p className="muted field-help">{t(layout?.format === "gltf" ? "三维模型保留原始高度，滑条仅增加展示间距" : "0 表示层面贴合、没有空隙，保留示意层厚度，非真实工艺堆叠")}</p>
        </section>
        <section>
          <h3>{t("配色")}</h3>
          <div className="display-palette"><span>{palettePreferences.custom.some(p => p.id === paletteId) ? activePalette.name : t(activePalette.name)}</span><Button icon="palette" label={t("配色组合")} popup="dialog" onClick={() => setPaletteOpen(true)} /><Button icon="reset" label={t("恢复组合颜色")} disabled={!Object.keys(layerColors).length} onClick={() => setLayerColors({})} /></div>
          <p className="muted field-help">{t("点击左侧图层色块打开调色板，颜色立即更新，不重新解析版图")}</p>
        </section>
        <section>
          <h3> {t("版图比较")} </h3>
          <Button icon="swap" label={t("设为比较基线")}
            disabled={!layout}
            onClick={() => {
              if (layout)
                setBaseline({
                  name: layout.name,
                  layers: layout.layers.length,
                  triangles: layout.triangles,
                });
              setStatus("当前几何统计已设为比较基线");
            }}
          />
          {baseline && (
            <>
              <p className="muted"> {t("基线：")} {baseline.name}</p>
              <dl>
                <div>
                  <dt> {t("图层变化")} </dt>
                  <dd>{layout ? layout.layers.length - baseline.layers : 0}</dd>
                </div>
                <div>
                  <dt> {t("三角形变化")} </dt>
                  <dd>
                    {layout
                      ? (layout.triangles - baseline.triangles).toLocaleString()
                      : 0}
                  </dd>
                </div>
              </dl>
              <p className="muted"> {t("仅比较数量，不等同于几何差异检查")} </p>
            </>
          )}
        </section>
        </div>
        <div role="tabpanel" id="inspector-panel-source" aria-labelledby="inspector-tab-source" hidden={inspectorTab !== "source"}>
        <SourceData layout={layout} />
        <section>
          <h3> {t("解析说明")} </h3>
          {!!layout?.missingReferences?.length && <details className="missing-references"><summary> {t("缺失引用目标（")} {layout.missingReferences.length}  {t("项）")} </summary><ul>{layout.missingReferences.slice(0, 200).map((r) => <li key={`${r.source}/${r.target}`}><strong>{r.target}</strong><span> {t("来源")} {r.source} · {r.count}  {t("次引用")} </span></li>)}</ul><p className="muted"> {t("目标定义未包含在当前文件中，完整显示需要重新导出包含依赖单元的版图库")} </p></details>}
          {layout ? (
            layout.warnings.map((w) => (
              <p className="muted" key={w}>
                {t(w)}
              </p>
            ))
          ) : (
            <p className="muted"> {t("支持本地版图和自包含静态三维模型")} </p>
          )}
        </section>
        </div>
        <div role="tabpanel" id="inspector-panel-ai" aria-labelledby="inspector-tab-ai" hidden={inspectorTab !== "ai"}>
        <ExplanationPanel layout={layout} object={selectedObject?.feature} layerNames={layerNames} />
        </div>
      </div>
      <div className="pane-foot">
        <Icon name="shield" />
         {t("浏览器内解析 · 无文件上传")} </div>
    </aside>
  );
  return (
    <div
      className="workbench"
      style={
        {
          ...Object.fromEntries(
            Object.entries(theme === "dark" ? tokens.dark : tokens.light).map(
              ([key, value]) => [`--${key}`, value],
            ),
          ),
          "--left-width": `${renderedLeft}px`,
          "--right-width": `${renderedRight}px`,
        } as CSSProperties
      }
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length !== 1) {
          setError("每次请打开一个自包含文件");
          return;
        }
        void openFile(e.dataTransfer.files[0]);
      }}
    >
      <header className="topbar">
        <div className="brand-group"><a className="brand" href="/" aria-label={t("GDS-3D-VIEWER 首页")}>
          <Icon name="chip" />
          <strong>GDS-3D-VIEWER</strong>
          <span className="brand-divider" />
          <span className="brand-caption"> {t("芯片版图预览器")} </span>
        </a>
        </div>
        <div className="top-actions">
          <Button buttonRef={importButton} icon="upload" className="toolbar-button" label={t("打开文件")} onClick={() => fileInput.current?.click()} />
          <Button icon="cube" className="toolbar-button demo-button" label={t("加载示例")} onClick={() => void demo()} disabled={busy} />
          <Button icon="language" className="language-toggle" label={t(locale === "zh" ? "切换为英文" : "切换为中文")} onClick={() => setLocale(locale === "zh" ? "en" : "zh")}>{locale === "zh" ? "EN" : "ZH"}</Button>
          <Button
            icon="download"
            label={t("导出")}
            popup="dialog"
            onClick={() => setExportOpen("all")}
            disabled={!layout}
          />
          <Button
            icon={theme === "dark" ? "sun" : "moon"}
            label={theme === "dark" ? t("切换浅色主题") : t("切换深色主题")}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          />
          <Button
            icon="info"
            label={t("使用说明与隐私")}
            onClick={() => setHelp(true)}
          />
          <a className="icon-button source-link" aria-label={t("查看源码")} title={t("查看源码 · GitHub")} href="https://github.com/AIALRA-0/GDS-3D-VIEWER" target="_blank" rel="noopener noreferrer"><Icon name="github" /></a>
        </div>
      </header>
      <input ref={mappingInput} data-testid="layer-mapping-input" type="file" accept=".lyp,.json" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void importMapping(file); }} />
      <input
        ref={fileInput}
        data-testid="public-file-input"
        type="file"
        accept=".gds,.gds2,.gdsii,.gltf,.glb"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void openFile(f);
        }}
      />
      <input
        ref={reviewInput}
        data-testid="review-file-input"
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importReview(f);
        }}
      />
      <div className="work-area">
        <nav className="activity-rail" aria-label={t("工作台面板")}>
          <Button
            icon="layers"
            label={t("图层")}
            pressed={panel === "layers" && left}
            onClick={() => showPanel("layers")}
          />
          <Button
            icon="tree"
            label={t("单元")}
            pressed={panel === "cells" && left}
            onClick={() => showPanel("cells")}
          />
          <Button
            icon="note"
            label={t("审阅记录")}
            pressed={panel === "notes" && left}
            onClick={() => showPanel("notes")}
          />
          <Button
            icon="bookmark"
            label={t("视角书签")}
            pressed={panel === "bookmarks" && left}
            onClick={() => showPanel("bookmarks")}
          />
          <div className="rail-spacer" />
          <Button
            icon="left"
            label={t("显示或收起导航")}
            pressed={left}
            onClick={() => {
              setLeft((v) => !v);
              if (mobile) setRight(false);
            }}
          />
          <Button
            icon="right"
            label={t("显示或收起检查器")}
            pressed={right}
            onClick={() => {
              setRight((v) => !v);
              if (mobile) setLeft(false);
            }}
          />
          <Button
            icon="swap"
            label={t("交换左右侧栏")}
            onClick={() => setSwapped((v) => !v)}
            disabled={mobile}
          />
        </nav>
        <div
          className={`workspace ${left ? "left-open" : ""} ${right ? "right-open" : ""} ${swapped ? "swapped" : ""}`}
        >
          {mobile && (left || right) && (
            <button
              className="drawer-backdrop"
              aria-label={t("关闭侧栏")}
              onClick={() => {
                setLeft(false);
                setRight(false);
              }}
            />
          )}
          {left && navigator}
          {!mobile && (swapped ? right : left) && (
            <div
              className="splitter left-split"
              role="separator"
              aria-label={t("调整左侧栏宽度")}
              aria-orientation="vertical"
              aria-valuemin={220}
              aria-valuemax={400}
              aria-valuenow={renderedLeft}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  resize(swapped ? 1 : 0, e.key === "ArrowLeft" ? -16 : 16);
                }
              }}
              onPointerDown={(e) => startResize(e, swapped ? 1 : 0, 1)}
            />
          )}
          <main className="pane main-pane">
            <div className="pane-head canvas-head">
              <span className="filename" title={layout?.name ?? t("版图预览")}>
                <Icon name="file" />
                {layout?.name ?? t("版图预览")}
              </span>
              <div className="canvas-tools">
                {tools}
                <Button
                  icon="camera"
                  label={t("保存当前画面")}
                  onClick={() => viewer.current?.screenshot()}
                  disabled={!layout}
                />
              </div>
            </div>
            <div className="canvas-stage">
              <Viewer
                ref={viewer}
                layout={layout}
                visible={visible}
                explode={explode}
                theme={theme}
                selectedObject={selectedObject}
                onPick={(pick) => { setSelectedObject(pick); if (pick) { setInspectorTab("overview"); setRight(true); if (mobile) setLeft(false); } }}
                layerNames={layerNames}
                layerColors={displayedColors}
                onMode={(mode) => { setViewMode(mode); if (mode === "3d") setMeasuring(false); }}
                measuring={measuring}
                onSelect={(id) => {
                  setSelected(id);
                  if (mobile) {
                    setRight(true);
                    setLeft(false);
                  }
                }}
              />
              {layout && !layout.layers.length && !busy && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icon name="tree" />
                  </div>
                  <h1> {t("选择一个单元查看")} </h1>
                  <p>{layout.incomplete && layout.missingReferences?.length ? t("引用目标未包含在文件中，单元目录与缺失列表已读取") : t("完整版图超出当前预览上限，单元目录已读取")}</p>
                  <button
                    className="text-button primary"
                    onClick={() => showPanel("cells")}
                  >
                     {t("打开单元目录")} </button>
                  <p className="muted"> {t("筛选并选择较小单元，文件不会上传")} </p>
                </div>
              )}
              {!layout && !busy && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icon name="chip" />
                  </div>
                  <h1> {t("从版图，看见结构")} </h1>
                  <p> {t("打开本地文件，旋转、分层查看与记录观察")} </p>
                  <div className="empty-actions">
                    <button
                      className="text-button primary"
                      onClick={() => fileInput.current?.click()}
                    >
                      <Icon name="upload" />
                       {t("打开文件")} </button>
                    <button className="text-button" onClick={() => void demo()}>
                       {t("试用合成示例")} <Icon name="arrow" />
                    </button>
                  </div>
                  <p className="file-formats">
                     {t("GDS / GDS2 / GDSII · glTF / GLB · 最大 32 MB")} </p>
                  <div className="privacy-caption">
                    <Icon name="shield" />
                     {t("文件在你的浏览器里解析，不上传服务器")} </div>
                  <button
                    className="text-button quiet"
                    onClick={() => setHelp(true)}
                  >
                     {t("支持范围与使用说明")} </button>
                </div>
              )}
              {busy && (
                <div className="loading-state" role="status">
                  <span className="spinner" />
                  <strong>{t(status)}</strong>
                  <span> {t("最多等待 45 秒，已有文件会保留")} </span>
                  <Button icon="close" label={t("取消导入")} onClick={cancel} />
                </div>
              )}
              {error && (
                <div className="error-banner" role="alert">
                  <span>{t(error)}</span>
                  <Button
                    icon="close"
                    label={t("关闭错误提示")}
                    onClick={() => setError("")}
                  />
                </div>
              )}
              {layout && layout.layers.length > 0 && !busy && (
                <div className="canvas-hint">
                   {t(viewMode === "2d" ? "二维正交 · 拖动平移 · 滚轮缩放 · 可开启测量" : "拖动旋转 · 右键平移 · 滚轮缩放 · 悬停查看 · 点击固定详情")} </div>
              )}
              {layout?.incomplete && !busy && <div className="incomplete-banner" role="status"> {t("不完整预览 ·")} {layout.missingReferences?.length ? t("缺失单元定义，当前仅显示已有几何") : t("完整几何尚未生成")}<Button icon="info" label={t("查看解析说明")} onClick={() => { setInspectorTab("source"); setRight(true); if (mobile) setLeft(false); }} /></div>}
            </div>
            <div className="pane-foot main-foot">
              <span>
                {layout
                  ? `${layout.top} · ${layout.layers.length ? layout.triangles.toLocaleString() + " " + t("个三角形") : t("仅单元目录")}`
                  : t("拖入一个版图或模型文件即可开始")}
              </span>
              <Button icon="upload" label={t("导入审阅记录")} disabled={!layout} onClick={() => reviewInput.current?.click()} />
            </div>
          </main>
          {!mobile && (swapped ? left : right) && (
            <div
              className="splitter right-split"
              role="separator"
              aria-label={t("调整右侧栏宽度")}
              aria-orientation="vertical"
              aria-valuemin={220}
              aria-valuemax={400}
              aria-valuenow={renderedRight}
              onPointerDown={(e) => startResize(e, swapped ? 0 : 1, -1)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  resize(swapped ? 0 : 1, e.key === "ArrowLeft" ? 16 : -16);
                }
              }}
            />
          )}
          {right && inspector}
        </div>
      </div>
      <footer className="global-status">
        <span role="status" title={t(status)}>
          {t(status)}
        </span>
        <span title={t(storage)}> {t("公开预览 · 无需密码 ·")} {t(storage)}</span>
      </footer>
      {dragging && (
        <div className="drop-overlay">
          <Icon name="upload" />
          <strong> {t("松开以打开文件")} </strong>
          <span> {t("每次一个文件，最大 32 MB")} </span>
        </div>
      )}
      {paletteOpen && <Modal title={t("配色组合")} onClose={() => setPaletteOpen(false)}><PalettePanel preferences={palettePreferences} activeId={paletteId} currentColors={layout?.layers.map(layer => colorForLayer(layer.id))} onPreferences={setPalettePreferences} onApply={applyPalette} /></Modal>}
      {exportOpen && <Modal title={t(exportOpen === "maps" ? "导出图层映射" : "导出")} onClose={() => setExportOpen(null)}>
        <p className="muted">{t("选择导出内容与格式，文件直接保存到你的电脑")}</p>
        <div className="export-options">
          {exportOpen === "all" && <>
            <button className="export-option" aria-label={t("导出审阅记录")} disabled={!layout} onClick={() => { exportReview(); setExportOpen(null); }}><Icon name="note" /><span><strong>{t("导出审阅记录")}</strong><small>{t("JSON · 记录、视角、图层名称与颜色，不包含源版图或密钥")}</small></span></button>
            <button className="export-option" aria-label={t("保存当前画面")} disabled={!layout?.layers.length} onClick={() => { viewer.current?.screenshot(); setExportOpen(null); }}><Icon name="camera" /><span><strong>{t("保存当前画面")}</strong><small>{t("PNG · 当前视角与显示配色")}</small></span></button>
          </>}
          {(["json", "lyp"] as const).map(format => <button className="export-option" aria-label={t(format === "json" ? "导出 JSON" : "导出 LYP")} key={format} disabled={!layout || layout.format !== "gds" || !Object.keys(layerNames).length} onClick={() => exportMapping(format)}><Icon name="layers" /><span><strong>{t(format === "json" ? "导出 JSON" : "导出 LYP")}</strong><small>{t(format === "json" ? "JSON · 图层编号与自定义名称映射" : "LYP · KLayout 图层名称映射")}</small></span></button>)}
        </div>
        <p className="muted field-help">{t("名称映射不包含颜色或厚度，配色组合在本机偏好中单独管理")}</p>
      </Modal>}
      {help && (
        <Modal title={t("使用说明与隐私")} onClose={() => setHelp(false)}>
          <p> {t("GDS-3D-VIEWER 是用于教学、演示和早期版图观察的公开预览器")} </p>
          <h3> {t("开始查看")} </h3>
          <ol>
            <li>
               {t("打开本地 .gds、.gds2、.gdsii、.gltf 或 .glb 文件，也可以加载合成示例")} </li>
            <li>
               {t("通过图层开关和单元层级选择内容，二维可平移与测量，三维可旋转与展开图层")} </li>
            <li> {t("把观察写入审阅记录，保存视角书签，再导出记录以便后续恢复")} </li>
          </ol>
          <p>{t("测量在二维平面点击起点与终点，不吸附几何，第三次点击重新测量，结果不随审阅记录保存")}</p>
          <p>{t("单元名称直接读取文件，实际工艺层名需手动命名或导入映射，可导出 JSON 或 LYP，映射不包含颜色与厚度")}</p>
          <h3> {t("文件与会话")} </h3>
          <p>
             {t("解析任务在浏览器中独立运行，不上传你的版图、不共享会话。可选 AI 讲解由浏览器直连你确认的模型服务，只发送预览过的对象摘要；密钥仅留在当前页面，刷新即丢弃")} </p>
          <p>
             {t("网页服务器仍会接收访问网页所需的普通请求，浏览器只保存主题、侧栏、语言和你保存的配色组合")} </p>
          <p>
             {t("版图、审阅记录与书签只在本次会话中保留，刷新或关闭前请导出审阅记录并单独保留原始文件")} </p>
          <h3> {t("支持范围")} </h3>
          <p>
             {t("版图支持边界、方框、常规路径、单元引用和阵列引用，可独立打开不同顶层及子单元")} </p>
          <p>
             {t("圆端路径、绝对宽度路径、绝对缩放或角度需在原版图工具中先转为普通边界，文字标签不渲染")} </p>
          <p>
             {t("三维模型只支持自包含、无纹理、无压缩扩展的静态三角形网格，外部缓冲区与纹理均拒绝加载")} </p>
          <p>
             {t("最大 32 MB、150,000 个展开实例，复用几何最多显示 12,000,000 个三角形，解析超过 45 秒自动终止")} </p>
          <h3> {t("观察边界")} </h3>
          <p>
             {t("版图层高度用于展示，不代表工艺厚度；数量比较不等同于几何差异检查，结果不能代替版图规则检查或流片签核")} </p>
          <p>
            <a
              href="https://github.com/AIALRA-0/GDS-3D-VIEWER"
              target="_blank"
              rel="noreferrer"
            >
               {t("查看项目源码")} </a>{" "}
            ·{" "}
            <a
              href="https://github.com/AIALRA-0/GDS-GLTF-3D-Viewer"
              target="_blank"
              rel="noreferrer"
            >
               {t("查看原始转换器")} </a>{" "}
            ·{" "}
            <a href="https://aialra.online" target="_blank" rel="noreferrer">
               {t("AIALRA 工具首页")} </a>
          </p>
        </Modal>
      )}
    </div>
  );
}
