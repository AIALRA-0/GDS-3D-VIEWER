import type { LayoutManifest, PerformanceMode, SampleSummary, ScenePanelId } from "../../../../packages/shared/types";

export type UiLanguage = "en" | "zh";

export const DEFAULT_EXPLAIN_PROMPTS: Record<UiLanguage, string> = {
  en: "Summarize the strongest engineering story in this layout.",
  zh: "总结这个版图里最值得展示的工程故事。"
};

export const DEFAULT_OPERATOR_PROMPTS: Record<UiLanguage, string> = {
  en: "Focus the control plane, save a bookmark, and suggest the best demo path.",
  zh: "聚焦控制区域，保存一个书签，并给出最佳演示路径。"
};

type GuideBlock = {
  title: string;
  detail: string;
};

type UiCopy = {
  boot: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  topbar: {
    eyebrow: string;
    title: string;
    hero: string;
    exportSession: string;
    exporting: string;
    copySceneLink: string;
    copiedLink: string;
    switchLanguage: string;
  };
  quickstart: {
    eyebrow: string;
    title: string;
    steps: string[];
    areas: GuideBlock[];
  };
  load: {
    eyebrow: string;
    title: string;
    working: string;
    uploadBadge: string;
    sourceFiles: string;
    format: string;
    technology: string;
    warnings: string;
    uploadHint: string;
  };
  layers: {
    eyebrow: string;
    title: string;
    all: string;
    none: string;
    empty: string;
  };
  markers: {
    eyebrow: string;
    title: string;
    empty: string;
  };
  center: {
    bundle: string;
    fit: string;
    reset: string;
    showAll: string;
    saveBookmark: string;
  };
  sceneFoot: {
    selection: string;
    mode: string;
    markers: string;
    bookmarks: string;
    overview: string;
  };
  overview: {
    eyebrow: string;
    title: string;
    hierarchyTitle: string;
    metricsTitle: string;
    layers: string;
    cells: string;
    instances: string;
    polygons: string;
    area: string;
    utilization: string;
    wirelength: string;
    selectionMetadata: string;
    selectionHelp: string;
    instancesShort: string;
    noSelection: string;
    emptyHierarchy: string;
  };
  explain: {
    eyebrow: string;
    title: string;
    run: string;
    runSelection: string;
    running: string;
    confidence: string;
    selectionLabel: string;
    selectionIdle: string;
    empty: string;
  };
  operator: {
    eyebrow: string;
    title: string;
    run: string;
    runSelection: string;
    running: string;
    selectionLabel: string;
    selectionIdle: string;
    empty: string;
  };
  review: {
    eyebrow: string;
    title: string;
    noteCount: string;
    bookmarkLabel: string;
    save: string;
    notePlaceholder: string;
    addNote: string;
    added: string;
    changed: string;
    delta: string;
    noAdditions: string;
    noChanges: string;
  };
  sourceLabel: Record<"sample" | "upload", string>;
  panelLabel: Record<ScenePanelId, string>;
  panelHelp: Record<ScenePanelId, string>;
  modeLabel: Record<PerformanceMode, string>;
  severityLabel: Record<"critical" | "warning" | "info", string>;
  status: {
    booting: string;
    backendLoaded: (name: string) => string;
    backendFailed: string;
    sampleLoaded: (name: string) => string;
    sampleFailed: string;
    importedSession: (name: string) => string;
    uploadedBundle: (files: string) => string;
    uploadFailed: string;
    explainRemote: string;
    explainLocal: string;
    explainFailed: string;
    operatorRemote: string;
    operatorLocal: string;
    operatorFailed: string;
    noteAdded: string;
    bookmarkSaved: (label: string) => string;
    performanceMode: (mode: string) => string;
      exportDone: string;
      exportFailed: string;
      linkCopied: string;
      readyBlank: string;
      detailDeferred: string;
    detailGenerating: string;
    detailReady: string;
    detailFailed: string;
    ready: (name: string) => string;
  };
  viewer: {
    eyebrow: string;
    caption: string;
    cells: string;
    instances: string;
    markers: string;
    emptyBadge: string;
    emptyHint: string;
    emptyTitle: string;
    emptySelection: string;
  };
};

export const UI_COPY: Record<UiLanguage, UiCopy> = {
  en: {
    boot: {
      eyebrow: "GDS-3D-VIEWER cockpit",
      title: "Loading the review cockpit.",
      subtitle: "Fetching sample inventory, baseline session, and viewer assets."
    },
    topbar: {
      eyebrow: "GDS-3D-VIEWER cockpit",
      title: "Explainable 3D IC layout review for GDS, sidecars, and AI-assisted inspection.",
      hero: "Backend-backed sample sessions, OpenROAD-compatible sidecars, CAD-style camera controls, and exportable review state in one cockpit.",
      exportSession: "Export session",
      exporting: "Exporting",
      copySceneLink: "Copy scene link",
      copiedLink: "Copied link",
      switchLanguage: "中文"
    },
    quickstart: {
      eyebrow: "Quickstart",
      title: "How to use GDS-3D-VIEWER",
      steps: [
        "1. Load a sample bundle or upload a GDS file with optional manifest, metrics, markers, DEF, and LEF sidecars.",
        "2. Inspect the central viewer with left drag to orbit, right drag to pan, wheel to zoom to cursor, and double click to focus.",
        "3. Use the right rail for hierarchy, explain, operator, notes, bookmarks, and diff during a review session."
      ],
      areas: [
        {
          title: "Left rail",
          detail: "Use Sample gallery to load data, Visibility rail to filter layers, and Review stops to jump across markers."
        },
        {
          title: "Center viewer",
          detail: "Inspect geometry, focus cells or markers, then use Fit, Reset, Show all, and Save bookmark while navigating."
        },
        {
          title: "Right rail",
          detail: "Read metrics, click hierarchy nodes, run Explain or Operator, add notes, restore bookmarks, and compare diff."
        }
      ]
    },
    load: {
      eyebrow: "Load",
      title: "Upload bundle",
      working: "Working",
      uploadBadge: "Upload",
      sourceFiles: "Source files",
      format: "Format",
      technology: "Technology",
      warnings: "Warnings",
      uploadHint: "Drop a GDS bundle with manifest, metrics, markers sidecars, or import an exported session JSON."
    },
    layers: {
      eyebrow: "Layers",
      title: "Visibility rail",
      all: "All",
      none: "None",
      empty: "Upload a layout to enable layer filters."
    },
    markers: {
      eyebrow: "Markers",
      title: "Review stops",
      empty: "Upload a layout to enable review markers."
    },
    center: {
      bundle: "Bundle",
      fit: "Fit",
      reset: "Reset",
      showAll: "Show all",
      saveBookmark: "Save bookmark"
    },
    sceneFoot: {
      selection: "Selection",
      mode: "Mode",
      markers: "Markers",
      bookmarks: "Bookmarks",
      overview: "Overview"
    },
    overview: {
      eyebrow: "Overview",
      title: "Metrics and hierarchy",
      hierarchyTitle: "Hierarchy",
      metricsTitle: "Metrics",
      layers: "layers",
      cells: "Cells",
      instances: "Instances",
      polygons: "Polygons",
      area: "Area",
      utilization: "Utilization",
      wirelength: "Wirelength",
      selectionMetadata: "Selection metadata",
      selectionHelp: "Focus a hierarchy node or marker to inspect its engineering context.",
      instancesShort: "inst",
      noSelection: "No selection",
      emptyHierarchy: "Upload a layout to populate the hierarchy."
    },
    explain: {
      eyebrow: "Explain",
      title: "AI explainer",
      run: "Run explain",
      runSelection: "Explain selection",
      running: "Explaining",
      confidence: "Confidence",
      selectionLabel: "AI scope",
      selectionIdle: "No active selection. The AI will explain the whole loaded layout.",
      empty: "Upload a layout first, then click Run explain."
    },
    operator: {
      eyebrow: "Operator",
      title: "AI action planner",
      run: "Run operator",
      runSelection: "Plan around selection",
      running: "Running",
      selectionLabel: "Action scope",
      selectionIdle: "No active selection. The operator will plan against the whole loaded layout.",
      empty: "Upload a layout first, then ask the operator for actions."
    },
    review: {
      eyebrow: "Review",
      title: "Notes, bookmarks, and diff",
      noteCount: "notes",
      bookmarkLabel: "Bookmark label",
      save: "Save",
      notePlaceholder: "Leave a review note tied to the current visible layers.",
      addNote: "Add note",
      added: "Added",
      changed: "Changed",
      delta: "Delta",
      noAdditions: "No additions",
      noChanges: "No changes"
    },
    sourceLabel: {
      sample: "sample",
      upload: "upload"
    },
    panelLabel: {
      viewer: "Viewer",
      layers: "Layers",
      hierarchy: "Hierarchy",
      metrics: "Metrics",
      markers: "Markers",
      explain: "Explain",
      operator: "Operator",
      notes: "Notes",
      bookmarks: "Bookmarks",
      diff: "Diff"
    },
    panelHelp: {
      viewer: "Inspect geometry and navigate the 3D scene here.",
      layers: "Filter summarized review layers and isolate visibility groups.",
      hierarchy: "Jump across summarized cells and focus specific hierarchy nodes.",
      metrics: "Read layout scale, utilization, and engineering summary metrics.",
      markers: "Review flagged checkpoints and jump directly to them.",
      explain: "Generate an AI explanation of the current layout session.",
      operator: "Ask the AI operator to propose or run viewer actions.",
      notes: "Write review notes tied to the current scene state.",
      bookmarks: "Save and restore camera viewpoints and review context.",
      diff: "Compare the current session against the baseline sample."
    },
    modeLabel: {
      full: "Full",
      simplified: "Simplified",
      "hierarchy-preview": "Hierarchy preview"
    },
    severityLabel: {
      critical: "critical",
      warning: "warning",
      info: "info"
    },
    status: {
      booting: "Booting GDS-3D-VIEWER cockpit.",
      backendLoaded: (name) => `Loaded backend session: ${name}.`,
      backendFailed: "Backend bootstrap failed.",
      sampleLoaded: (name) => `Loaded sample bundle: ${name}.`,
      sampleFailed: "Sample load failed.",
      importedSession: (name) => `Imported exported session: ${name}.`,
      uploadedBundle: (files) => `Loaded uploaded bundle: ${files}.`,
      uploadFailed: "Upload failed.",
      explainRemote: "Explain summary generated by DeepSeek.",
      explainLocal: "Explain summary generated locally.",
      explainFailed: "Explain failed.",
      operatorRemote: "Operator actions returned by DeepSeek.",
      operatorLocal: "Operator actions generated locally.",
      operatorFailed: "Operator failed.",
      noteAdded: "Review note added.",
      bookmarkSaved: (label) => `Saved bookmark: ${label}.`,
      performanceMode: (mode) => `Performance mode: ${mode}.`,
      exportDone: "Exported review session JSON.",
      exportFailed: "Export failed.",
      linkCopied: "Shareable scene link copied.",
      readyBlank: "Upload a GDS bundle to start.",
      detailDeferred: "Detailed mesh is available on demand in Full mode.",
      detailGenerating: "Generating detailed mesh for Full mode.",
      detailReady: "Detailed mesh is ready.",
      detailFailed: "Detailed mesh generation failed.",
      ready: (name) => `Loaded session: ${name}.`
    },
    viewer: {
      eyebrow: "Central viewer",
      caption: "Left drag rotates, right drag pans, wheel zooms to cursor, and double click focuses the selected block or review marker.",
      cells: "cells",
      instances: "instances",
      markers: "markers",
      emptyBadge: "Upload required",
      emptyHint: "Upload a GDS bundle to start the workspace.",
      emptyTitle: "No layout loaded",
      emptySelection: "No layout"
    }
  },
  zh: {
    boot: {
      eyebrow: "GDS-3D-VIEWER 驾驶舱",
      title: "正在加载审阅驾驶舱。",
      subtitle: "正在获取样例清单、基线会话和 viewer 资源。"
    },
    topbar: {
      eyebrow: "GDS-3D-VIEWER 驾驶舱",
      title: "面向 GDS、sidecar 与 AI 辅助审阅的可解释 3D IC 版图审阅平台。",
      hero: "把真实后端样例会话、兼容 OpenROAD 的 sidecar、接近 CAD 的相机控制和可导出的审阅状态放进同一个驾驶舱。",
      exportSession: "导出会话",
      exporting: "导出中",
      copySceneLink: "复制场景链接",
      copiedLink: "已复制",
      switchLanguage: "English"
    },
    quickstart: {
      eyebrow: "快速上手",
      title: "如何使用 GDS-3D-VIEWER",
      steps: [
        "1. 加载一个样例 bundle，或上传一个 GDS 文件，并可选附带 manifest、metrics、markers、DEF、LEF sidecar。",
        "2. 在中央 viewer 里检查模型：左键拖拽旋转，右键拖拽平移，滚轮按光标缩放，双击聚焦。",
        "3. 在右侧栏里使用 hierarchy、explain、operator、notes、bookmarks 和 diff 完成一次审阅。"
      ],
      areas: [
        {
          title: "左侧栏",
          detail: "用 Sample gallery 加载数据，用 Visibility rail 过滤层，用 Review stops 在 markers 之间跳转。"
        },
        {
          title: "中央 viewer",
          detail: "检查几何体，聚焦 cell 或 marker，然后在导航过程中使用 Fit、Reset、Show all 和 Save bookmark。"
        },
        {
          title: "右侧栏",
          detail: "查看 metrics，点击 hierarchy 节点，运行 Explain 或 Operator，添加 note，恢复 bookmark，并比较 diff。"
        }
      ]
    },
    load: {
      eyebrow: "加载",
      title: "上传 bundle",
      working: "处理中",
      uploadBadge: "上传",
      sourceFiles: "源文件",
      format: "格式",
      technology: "工艺",
      warnings: "警告",
      uploadHint: "拖入一个带 manifest、metrics、markers sidecar 的 GDS bundle，或者导入一个已导出的 session JSON。"
    },
    layers: {
      eyebrow: "层",
      title: "可见性栏",
      all: "全部",
      none: "清空",
      empty: "先上传一个版图，再启用层过滤。"
    },
    markers: {
      eyebrow: "标记",
      title: "审阅站点",
      empty: "先上传一个版图，再启用审阅标记。"
    },
    center: {
      bundle: "Bundle",
      fit: "聚焦",
      reset: "重置",
      showAll: "显示全部",
      saveBookmark: "保存书签"
    },
    sceneFoot: {
      selection: "当前选择",
      mode: "模式",
      markers: "标记",
      bookmarks: "书签",
      overview: "总览"
    },
    overview: {
      eyebrow: "总览",
      title: "指标与层级",
      hierarchyTitle: "层级",
      metricsTitle: "指标",
      layers: "层",
      cells: "单元",
      instances: "实例",
      polygons: "多边形",
      area: "面积",
      utilization: "利用率",
      wirelength: "线长",
      selectionMetadata: "选择元数据",
      selectionHelp: "聚焦一个 hierarchy 节点或 marker 来查看它对应的工程上下文。",
      instancesShort: "实例",
      noSelection: "暂无选择",
      emptyHierarchy: "先上传一个版图来生成层级。"
    },
    explain: {
      eyebrow: "解释",
      title: "AI 解释器",
      run: "运行解释",
      runSelection: "解释当前选择",
      running: "解释中",
      confidence: "置信度",
      selectionLabel: "AI 范围",
      selectionIdle: "当前没有激活选择，AI 会解释整个已加载版图。",
      empty: "先上传一个版图，然后点击运行解释。"
    },
    operator: {
      eyebrow: "操作器",
      title: "AI 动作规划器",
      run: "运行操作器",
      runSelection: "围绕当前选择规划",
      running: "运行中",
      selectionLabel: "动作范围",
      selectionIdle: "当前没有激活选择，操作器会针对整个已加载版图进行规划。",
      empty: "先上传一个版图，然后让操作器给出动作。"
    },
    review: {
      eyebrow: "审阅",
      title: "备注、书签与差异",
      noteCount: "条备注",
      bookmarkLabel: "书签名称",
      save: "保存",
      notePlaceholder: "留下一个与当前可见层绑定的审阅备注。",
      addNote: "添加备注",
      added: "新增",
      changed: "变化",
      delta: "增量",
      noAdditions: "没有新增项",
      noChanges: "没有变化项"
    },
    sourceLabel: {
      sample: "样例",
      upload: "上传"
    },
    panelLabel: {
      viewer: "Viewer",
      layers: "层",
      hierarchy: "层级",
      metrics: "指标",
      markers: "标记",
      explain: "解释",
      operator: "操作器",
      notes: "备注",
      bookmarks: "书签",
      diff: "差异"
    },
    panelHelp: {
      viewer: "在这里查看几何体并进行 3D 场景导航。",
      layers: "过滤审阅用的摘要层，并隔离可见性分组。",
      hierarchy: "在摘要后的单元层级之间跳转并聚焦特定节点。",
      metrics: "查看版图尺度、利用率和工程摘要指标。",
      markers: "查看被标注的检查点并直接跳转过去。",
      explain: "为当前版图会话生成 AI 解释。",
      operator: "让 AI 操作器提出或执行 viewer 动作。",
      notes: "写下与当前场景状态绑定的审阅备注。",
      bookmarks: "保存和恢复相机视角与审阅上下文。",
      diff: "把当前会话与基线样例进行比较。"
    },
    modeLabel: {
      full: "完整",
      simplified: "简化",
      "hierarchy-preview": "层级预览"
    },
    severityLabel: {
      critical: "严重",
      warning: "警告",
      info: "信息"
    },
    status: {
      booting: "正在启动 GDS-3D-VIEWER 驾驶舱。",
      backendLoaded: (name) => `已加载后端会话：${name}。`,
      backendFailed: "后端初始化失败。",
      sampleLoaded: (name) => `已加载样例 bundle：${name}。`,
      sampleFailed: "样例加载失败。",
      importedSession: (name) => `已导入导出的会话：${name}。`,
      uploadedBundle: (files) => `已加载上传 bundle：${files}。`,
      uploadFailed: "上传失败。",
      explainRemote: "解释结果由 DeepSeek 生成。",
      explainLocal: "解释结果由本地规则生成。",
      explainFailed: "解释失败。",
      operatorRemote: "操作动作由 DeepSeek 返回。",
      operatorLocal: "操作动作由本地规则生成。",
      operatorFailed: "操作器失败。",
      noteAdded: "已添加审阅备注。",
      bookmarkSaved: (label) => `已保存书签：${label}。`,
      performanceMode: (mode) => `性能模式：${mode}。`,
      exportDone: "已导出审阅会话 JSON。",
      exportFailed: "导出失败。",
      linkCopied: "已复制可分享的场景链接。",
      readyBlank: "上传一个 GDS bundle 开始使用。",
      detailDeferred: "完整细节网格会在切换到完整模式时按需生成。",
      detailGenerating: "正在为完整模式生成细节网格。",
      detailReady: "细节网格已就绪。",
      detailFailed: "细节网格生成失败。",
      ready: (name) => `已加载会话：${name}。`
    },
    viewer: {
      eyebrow: "中央 viewer",
      caption: "左键拖拽旋转，右键拖拽平移，滚轮按光标缩放，双击聚焦当前选中的模块或审阅标记。",
      cells: "个单元",
      instances: "个实例",
      markers: "个标记",
      emptyBadge: "需要上传",
      emptyHint: "上传一个 GDS bundle 来启动工作区。",
      emptyTitle: "尚未加载版图",
      emptySelection: "尚未加载"
    }
  }
};

export function localizePanelLabel(panel: ScenePanelId, language: UiLanguage): string {
  return UI_COPY[language].panelLabel[panel];
}

export function localizeModeLabel(mode: PerformanceMode, language: UiLanguage): string {
  return UI_COPY[language].modeLabel[mode];
}

export function localizeSourceLabel(source: string, language: UiLanguage): string {
  if (source === "sample") {
    return UI_COPY[language].sourceLabel.sample;
  }
  if (source === "upload") {
    return UI_COPY[language].sourceLabel.upload;
  }
  return source;
}

export function localizeSeverityLabel(severity: "critical" | "warning" | "info", language: UiLanguage): string {
  return UI_COPY[language].severityLabel[severity];
}

export function localizeSampleName(entry: Pick<SampleSummary, "id" | "name">, language: UiLanguage): string {
  if (language === "zh") {
    if (entry.id === "default") {
      return "TinyTapeout 样例";
    }
    if (entry.id === "openroad-demo") {
      return "OpenROAD Bundle 演示";
    }
  }
  return entry.name;
}

export function localizeSampleDescription(entry: Pick<SampleSummary, "id" | "description">, language: UiLanguage): string {
  if (language === "zh") {
    if (entry.id === "default") {
      return "仓库内置样例，用作默认基线会话和 smoke 测试目标。";
    }
    if (entry.id === "openroad-demo") {
      return "在 example GDS 之上叠加 OpenROAD 风格 sidecar 的工程审阅演示。";
    }
  }
  return entry.description;
}

export function localizeManifestName(manifest: Pick<LayoutManifest, "id" | "name">, language: UiLanguage): string {
  if (language === "zh") {
    if (manifest.id === "default") {
      return "TinyTapeout 样例";
    }
    if (manifest.id === "openroad-demo") {
      return "OpenROAD Bundle 演示";
    }
  }
  return manifest.name;
}
