const paths: Record<string, string> = {
  chip: "M7 7h10v10H7z M4 9H1m3 6H1m19-6h3m-3 6h3M9 4V1m6 3V1M9 20v3m6-3v3",
  layers: "m12 3 10 5-10 5L2 8z M2 12l10 5 10-5M2 16l10 5 10-5",
  tree: "M3 3h6v6H3zM15 15h6v6h-6zM15 3h6v6h-6zM9 6h6M6 9v9h9",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  fit: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
  close: "m6 6 12 12M6 18 18 6",
  left: "M3 4h18v16H3zM9 4v16",
  right: "M3 4h18v16H3zM15 4v16",
  sun: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0",
  moon: "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z",
  info: "M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0m-2 5 7 7",
  note: "M4 3h16v18H4zM8 8h8M8 12h8M8 16h5",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z m-4 10 3 3 5-6",
  camera: "M3 6h4l2-3h6l2 3h4v15H3zM16 13a4 4 0 1 1-8 0 4 4 0 1 1 8 0",
  reset: "M3 10a9 9 0 1 1 2 8M3 4v6h6",
  swap: "M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4",
  cube: "m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
};
export function Icon({ name }: { name: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.chip} />
    </svg>
  );
}
