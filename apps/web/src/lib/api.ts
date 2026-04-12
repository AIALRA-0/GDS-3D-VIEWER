import type { DiffSummary, ExplainResult, LayoutManifest, OperatorResult, SessionPayload } from "../../../../packages/shared/types";
import { createLocalExplainResult, createLocalOperatorResult, createLocalSessionPayload, createLocalDiffSummary } from "./demo";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

function pickFile(files: File[], matcher: (file: File) => boolean): File | null {
  return files.find(matcher) ?? null;
}

export async function loadDefaultSession(): Promise<SessionPayload> {
  try {
    return await fetchJson<SessionPayload>("/api/samples/default");
  } catch {
    return createLocalSessionPayload();
  }
}

export async function createSessionFromFiles(files: File[]): Promise<SessionPayload> {
  const gds = pickFile(files, (file) => /\.(gds|gdsii)$/i.test(file.name));
  if (!gds) {
    return createLocalSessionPayload(files);
  }

  const formData = new FormData();
  formData.append("gds", gds);

  const manifest = pickFile(files, (file) => /manifest\.json$/i.test(file.name));
  const metrics = pickFile(files, (file) => /metrics?\.json$/i.test(file.name));
  const defFile = pickFile(files, (file) => /\.def$/i.test(file.name));
  const lefFile = pickFile(files, (file) => /\.lef$/i.test(file.name));

  if (manifest) {
    formData.append("manifest", manifest);
  }
  if (metrics) {
    formData.append("metrics", metrics);
  }
  if (defFile) {
    formData.append("def_file", defFile);
  }
  if (lefFile) {
    formData.append("lef_file", lefFile);
  }
  formData.append("technology", "sky130");

  try {
    return await fetchJson<SessionPayload>("/api/sessions", {
      method: "POST",
      body: formData
    });
  } catch {
    return createLocalSessionPayload(files);
  }
}

export async function explainLayout(manifest: LayoutManifest, prompt: string): Promise<ExplainResult> {
  try {
    return await fetchJson<ExplainResult>("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest, prompt })
    });
  } catch {
    return createLocalExplainResult(manifest, prompt);
  }
}

export async function runOperator(manifest: LayoutManifest, prompt: string): Promise<OperatorResult> {
  try {
    return await fetchJson<OperatorResult>("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest, prompt })
    });
  } catch {
    return createLocalOperatorResult(manifest, prompt);
  }
}

export function buildDiffSummary(current: LayoutManifest, baseline: LayoutManifest): DiffSummary {
  return createLocalDiffSummary(current, baseline);
}
