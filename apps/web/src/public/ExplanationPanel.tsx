import { useI18n } from "./i18n";
import { useEffect, useRef, useState } from "react";
import type { GeometryFeature, Layout } from "./types";
import { explanationContext, requestExplanation, HARNESS_VERSION } from "./explanation";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";

export function ExplanationPanel({ layout, object }: { layout: Layout | null; object?: GeometryFeature }) {
  const { t, locale } = useI18n();
  const [endpoint, setEndpoint] = useState("https://api.deepseek.com/chat/completions");
  const [model, setModel] = useState("deepseek-flash");
  const [apiKey, setApiKey] = useState("");
  const [geometry, setGeometry] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const keyInput = useRef<HTMLInputElement>(null);
  const context = layout ? explanationContext(layout, geometry ? object : undefined, locale) : null;
  useEffect(() => {
    generation.current++;
    controller.current?.abort();
    setBusy(false); setConsent(false); setResult(""); setError("");
  }, [layout, object?.id, endpoint, model, geometry]);
  useEffect(() => {
    generation.current++;
    controller.current?.abort();
    setBusy(false); setConsent(false); setError("");
  }, [locale]);
  useEffect(() => {
    const discard = () => {
      generation.current++;
      controller.current?.abort();
      if (keyInput.current) keyInput.current.value = "";
      setApiKey(""); setBusy(false);
    };
    const restore = (e: PageTransitionEvent) => { if (e.persisted) discard(); };
    addEventListener("pagehide", discard);
    addEventListener("pageshow", restore);
    return () => { generation.current++; controller.current?.abort(); removeEventListener("pagehide", discard); removeEventListener("pageshow", restore); };
  }, []);
  async function explain() {
    if (!context || !consent) return;
    const id = ++generation.current;
    controller.current?.abort();
    const task = new AbortController(); controller.current = task;
    const timeout = setTimeout(() => task.abort(), 60000);
    setBusy(true); setError(""); setResult("");
    try {
      const response = await requestExplanation({ endpoint, model, apiKey, context, signal: task.signal });
      if (id === generation.current) setResult(response);
    } catch (e) {
      if (id === generation.current) setError(e instanceof Error ? e.message : "讲解请求失败");
    } finally {
      clearTimeout(timeout);
      if (id === generation.current) setBusy(false);
    }
  }
  return <section className="explanation-panel" aria-label={t("AI 讲解")}>
    <h3><Icon name="explain" /> {t("AI 讲解")} </h3>
    <p className="muted"> {t("固定讲解框架 ·")} {HARNESS_VERSION}</p>
    <details>
      <summary> {t("配置本次会话")} </summary>
      <label> {t("模型接口地址")} <input aria-label={t("模型接口地址")} type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} spellCheck={false} /></label>
      <label> {t("模型名称")} <input aria-label={t("模型名称")} value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} /></label>
      <label> {t("本次会话密钥")} <input ref={keyInput} aria-label={t("本次会话密钥")} type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setConsent(false); }} /></label>
      <button className="text-button" disabled={!apiKey && !busy} onClick={() => { generation.current++; controller.current?.abort(); setBusy(false); setApiKey(""); setConsent(false); }}> {t("清除密钥")} </button>
      <p className="muted"> {t("密钥只在当前页面内存中，刷新或离开页面即丢弃，不写入存储或审阅导出")} </p>
    </details>
    <label> {t("讲解对象")} <select aria-label={t("讲解对象")} value={geometry && object ? "geometry" : "cell"} onChange={(e) => setGeometry(e.target.value === "geometry")}>
      <option value="cell"> {t("当前单元：")} {layout?.top ?? t("尚未打开")}</option>
      <option value="geometry" disabled={!object}> {t("选中图形")} {object ? `：${object.kind}` : t("（请先点击几何）")}</option>
    </select></label>
    {context && <details className="request-preview"><summary> {t("查看将发送的对象摘要")} </summary><pre>{JSON.stringify(context, null, 2)}</pre></details>}
    <p className="muted"> {t("浏览器直连你确认的模型服务，仅发送上述摘要，不发送版图文件。密钥会用于向该服务认证；服务须允许浏览器跨域请求")} </p>
    <label className="consent-row"><input type="checkbox" aria-label={t("确认发送所选摘要")} checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t("我已核对服务地址与摘要，同意发送")} </label>
    <div className="explanation-actions" aria-live="polite">
      <button className="text-button primary" disabled={!context || !apiKey.trim() || !consent || busy} onClick={() => void explain()}>{busy ? <span className="ai-spinner" aria-hidden="true" /> : <Icon name="explain" />}{busy ? t("正在讲解…") : t("生成讲解")}</button>
      {busy && <button className="text-button" onClick={() => controller.current?.abort()}> {t("取消讲解")} </button>}
    </div>
    {error && <p className="ai-error" role="alert">{t(error)}</p>}
    {result && <div className="explanation-result" aria-label={t("讲解结果")}><p className="muted"> {t("生成内容依据所选摘要，推测需要独立核对")} </p><Markdown content={result} /></div>}
  </section>;
}
