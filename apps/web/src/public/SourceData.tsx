import { useState } from "react";
import { useI18n } from "./i18n";
import type { Layout } from "./types";

const recordNames = "HEADER BGNLIB LIBNAME UNITS ENDLIB BGNSTR STRNAME ENDSTR BOUNDARY PATH SREF AREF TEXT LAYER DATATYPE WIDTH XY ENDEL SNAME COLROW TEXTNODE NODE TEXTTYPE PRESENTATION SPACING STRING STRANS MAG ANGLE UINTEGER USTRING REFLIBS FONTS PATHTYPE GENERATIONS ATTRTABLE STYPTABLE STRTYPE ELFLAGS ELKEY LINKTYPE LINKKEYS NODETYPE PROPATTR PROPVALUE BOX BOXTYPE PLEX BGNEXTN ENDEXTN TAPENUM TAPECODE STRCLASS RESERVED FORMAT MASK ENDMASKS LIBDIRSIZE SRFNAME LIBSECUR".split(" ");

export function SourceData({ layout }: { layout: Layout | null }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const data = layout?.gds;
  if (!data) return <p className="muted">{t("打开 GDS 文件后查看库信息、文字与引用记录")}</p>;
  const matches = (text: string) => text.toLowerCase().includes(query.toLowerCase());
  const labels = data.labels.filter((label) => matches(`${label.cell} ${label.layer} ${label.text}`));
  const references = data.references.filter((reference) => matches(`${reference.cell} ${reference.target}`));
  return <>
    <section><h3>{t("版图库信息")}</h3><dl>
      <div><dt>{t("库名称")}</dt><dd>{data.library ?? "—"}</dd></div>
      <div><dt>{t("文件版本")}</dt><dd>{data.version ?? "—"}</dd></div>
      <div><dt>{t("数据库单位")}</dt><dd>{data.databaseUnitMeters.toExponential(4)} m</dd></div>
      <div><dt>{t("用户单位")}</dt><dd>{data.userUnitMeters.toExponential(4)} m</dd></div>
    </dl></section>
    <label className="source-filter">{t("筛选文字与引用")}<input aria-label={t("筛选文字与引用")} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={128} /></label>
    <section><h3>{t("文字标签")} · {labels.length.toLocaleString()}</h3>
      <p className="muted">{t("坐标相对来源单元，文字不代表已验证的网络连接")}</p>
      {labels.slice(0, 100).map((label, i) => <details className="source-record" key={i}><summary>{label.text || t("空文字")} · {label.layer}</summary><dl>
        <div><dt>{t("来源单元")}</dt><dd>{label.cell}</dd></div>
        <div><dt>{t("坐标")}</dt><dd>{label.xy.join(", ")} µm</dd></div>
        <div><dt>{t("角度 / 缩放")}</dt><dd>{label.angle}° / {label.magnification}</dd></div>
        <div><dt>{t("镜像")}</dt><dd>{t(label.reflect ? "是" : "否")}</dd></div>
        <div><dt>{t("文字呈现标志")}</dt><dd>{label.presentation}</dd></div>
      </dl>{label.properties.map((p, j) => <p key={j}>{p.attribute}: {p.value}</p>)}</details>)}
      {labels.length > 100 && <p className="muted">{t("仅显示前 100 项，请筛选缩小范围")}</p>}
    </section>
    <section><h3>{t("单元引用")} · {references.length.toLocaleString()}</h3>
      {references.slice(0, 100).map((reference, i) => <details className="source-record" key={i}><summary>{reference.cell} → {reference.target} · {reference.kind}</summary><dl>
        <div><dt>{t("阵列列数 / 行数")}</dt><dd>{reference.columns} / {reference.rows}</dd></div>
        <div><dt>{t("角度 / 缩放")}</dt><dd>{reference.angle}° / {reference.magnification}</dd></div>
        <div><dt>{t("镜像")}</dt><dd>{t(reference.reflect ? "是" : "否")}</dd></div>
        <div><dt>{t("绝对变换标志")}</dt><dd>{t(reference.absolute ? "是" : "否")}</dd></div>
      </dl><p>{reference.xy.map((point) => point.join(", ")).join(" / ")} µm</p>{reference.properties.map((p, j) => <p key={j}>{p.attribute}: {p.value}</p>)}</details>)}
      {references.length > 100 && <p className="muted">{t("仅显示前 100 项，请筛选缩小范围")}</p>}
    </section>
    <section><h3>{t("记录覆盖情况")}</h3><p className="muted">{t("已解释表示结构、几何或源信息已读取；仅统计的记录未解释其内容")}</p>
      {data.records.map((record) => <div className="record-count" key={record.type}><code title={`0x${record.type.toString(16).padStart(2, "0").toUpperCase()}`}>{recordNames[record.type] ?? `0x${record.type.toString(16).toUpperCase()}`}</code><span>{record.count.toLocaleString()}</span><span>{t(record.handled ? "已解释" : "仅统计")}</span></div>)}
    </section>
  </>;
}
