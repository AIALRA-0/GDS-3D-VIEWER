import type {
  DiffSummary,
  ExplainResult,
  LayoutManifest,
  OperatorResult,
  SampleSummary,
  SessionPayload
} from "../../../../packages/shared/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        message = payload.detail;
      }
    } catch {
      // Fall back to the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function pickFile(files: File[], matcher: (file: File) => boolean): File | null {
  return files.find(matcher) ?? null;
}

function inferTechnology(files: File[]): string {
  return files.some((file) => /openroad|openlane|def|lef/i.test(file.name)) ? "openroad-sky130" : "sky130";
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SessionPayload>;
  return Boolean(candidate.manifest && candidate.state && candidate.explain && candidate.operator && candidate.diff);
}

async function readImportedSession(file: File | null): Promise<SessionPayload | null> {
  if (!file) {
    return null;
  }
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (!isSessionPayload(parsed)) {
    return null;
  }
  return parsed;
}

export async function loadSamples(): Promise<SampleSummary[]> {
  return await fetchJson<SampleSummary[]>("/api/samples");
}

export async function loadDefaultSession(): Promise<SessionPayload> {
  return await fetchJson<SessionPayload>("/api/samples/default");
}

export async function loadSampleSession(sampleId: string): Promise<SessionPayload> {
  return await fetchJson<SessionPayload>(`/api/samples/${sampleId}`);
}

export async function loadSession(sessionId: string): Promise<SessionPayload> {
  return await fetchJson<SessionPayload>(`/api/sessions/${sessionId}`);
}

export async function ensureDetailedSession(sessionId: string): Promise<SessionPayload> {
  return await fetchJson<SessionPayload>(`/api/sessions/${sessionId}/detail`, {
    method: "POST"
  });
}

export async function createSessionFromFiles(files: File[]): Promise<SessionPayload> {
  const imported = await readImportedSession(
    pickFile(files, (file) => /session\.json$/i.test(file.name) || /gds-3d-viewer|icviewer/i.test(file.name))
  );
  if (imported) {
    return imported;
  }

  const gds = pickFile(files, (file) => /\.(gds|gdsii)$/i.test(file.name));
  if (!gds) {
    throw new Error("Upload a GDS bundle or an exported session JSON.");
  }

  const formData = new FormData();
  formData.append("gds", gds);

  const manifest = pickFile(files, (file) => /manifest\.json$/i.test(file.name));
  const metrics = pickFile(files, (file) => /metrics?\.json$/i.test(file.name));
  const markers = pickFile(files, (file) => /markers?\.json$/i.test(file.name));
  const defFile = pickFile(files, (file) => /\.def$/i.test(file.name));
  const lefFile = pickFile(files, (file) => /\.lef$/i.test(file.name));

  if (manifest) {
    formData.append("manifest", manifest);
  }
  if (metrics) {
    formData.append("metrics", metrics);
  }
  if (markers) {
    formData.append("markers", markers);
  }
  if (defFile) {
    formData.append("def_file", defFile);
  }
  if (lefFile) {
    formData.append("lef_file", lefFile);
  }
  formData.append("technology", inferTechnology(files));

  return await fetchJson<SessionPayload>("/api/sessions", {
    method: "POST",
    body: formData
  });
}

export async function explainLayout(manifest: LayoutManifest, prompt: string): Promise<ExplainResult> {
  return await fetchJson<ExplainResult>("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, prompt })
  });
}

export async function runOperator(manifest: LayoutManifest, prompt: string): Promise<OperatorResult> {
  return await fetchJson<OperatorResult>("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, prompt })
  });
}

export async function buildDiffSummary(current: LayoutManifest, baseline: LayoutManifest): Promise<DiffSummary> {
  return await fetchJson<DiffSummary>("/api/diff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ left: baseline, right: current })
  });
}

export async function exportSessionPayload(session: SessionPayload): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session })
  });
  if (!response.ok) {
    let message = `Export failed with ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        message = payload.detail;
      }
    } catch {
      // Ignore JSON parsing failures and keep the default message.
    }
    throw new Error(message);
  }
  return await response.blob();
}
