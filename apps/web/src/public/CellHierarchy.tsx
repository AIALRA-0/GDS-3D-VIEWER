import { useMemo, useState } from "react";
import type { Layout } from "./types";
import { useI18n } from "./i18n";
import { IconButton } from "./IconButton";

export function CellHierarchy({ layout, busy, onOpen, onInstances }: { layout: Layout; busy: boolean; onOpen: (name: string) => void; onInstances: (name: string) => void }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(layout.tops.map((name) => JSON.stringify(name))));
  const graph = useMemo(() => {
    const cells = new Map(layout.cells.map((cell) => [cell.name, cell]));
    const children = new Map<string, Map<string, number>>();
    for (const ref of layout.gds?.references ?? []) {
      const targets = children.get(ref.cell) ?? new Map<string, number>();
      targets.set(ref.target, (targets.get(ref.target) ?? 0) + ref.columns * ref.rows);
      children.set(ref.cell, targets);
    }
    return { cells, children };
  }, [layout]);
  const rows: { name: string; path: string; depth: number; count: number; cycle: boolean; branch: boolean }[] = [];
  // Render only expanded branches; cap both depth and rows even for cyclic or dense graphs.
  const visit = (name: string, path: string, ancestors: string[], count: number) => {
    if (rows.length >= 300) return;
    const cycle = ancestors.includes(name), depth = ancestors.length;
    const targets = graph.children.get(name);
    const branch = !cycle && depth < 32 && !!targets?.size;
    rows.push({ name, path, depth, count, cycle, branch });
    if (branch && expanded.has(path)) for (const [target, instances] of targets!) {
      visit(target, `${path}/${JSON.stringify(target)}`, [...ancestors, name], instances);
      if (rows.length >= 300) break;
    }
  };
  for (const root of layout.tops) visit(root, JSON.stringify(root), [], 1);
  return <div className="hierarchy-list" aria-label={t("单元层级")}>
    {rows.map((row) => <div className={`hierarchy-row ${layout.top === row.name ? "selected" : ""}`} key={row.path} style={{ paddingLeft: Math.min(row.depth, 8) * 12 + 4 }}>
      <button className="hierarchy-toggle" aria-label={t("展开或收起引用")} title={row.name} aria-expanded={row.branch ? expanded.has(row.path) : undefined} disabled={!row.branch} onClick={() => setExpanded((previous) => { const next = new Set(previous); next.has(row.path) ? next.delete(row.path) : next.add(row.path); return next; })}>{row.branch ? expanded.has(row.path) ? "▾" : "▸" : "·"}</button>
      <button className="hierarchy-cell cell-row" disabled={busy || !graph.cells.has(row.name)} onClick={() => onOpen(row.name)} title={row.name}>
        <span>{row.name}</span><small>{row.cycle ? t("循环引用，停止展开") : !graph.cells.has(row.name) ? t("缺失单元定义") : row.depth ? t("{{0}} 个实例", { "0": row.count }) : t("顶层单元")}</small>
      </button>
      <IconButton icon="locate" label={t("定位 {{0}} 的全部实例", { "0": row.name })} popup="dialog" disabled={busy || !graph.cells.has(row.name)} onClick={() => onInstances(row.name)} />
    </div>)}
    {rows.length >= 300 && <p className="muted field-help">{t("层级仅显示前 300 项，可收起分支或筛选单元")}</p>}
  </div>;
}
