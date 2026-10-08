const paths: Record<string, string> = {
  palette: "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-10zM7 8h.01M11 6h.01M16 7h.01M6 13h.01",
  plus: "M12 4v16M4 12h16",
  check: "m4 12 5 5L20 6",
  star: "m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z",
  copy: "M8 8h12v13H8zM4 16H3V3h13v1",
  edit: "m16 3 5 5-12 12-6 1 1-6zM14 5l5 5",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0",
  eyeoff: "M3 3l18 18M2 12s3-6 8-7M22 12s-3 6-8 7M7 7c-3 2-5 5-5 5s4 7 10 7c2 0 4-.7 5-2M17 7c3 2 5 5 5 5",
  plane: "M4 4h16v16H4zM8 16V8h8M8 8l8 8",
  topview: "M4 7h16v13H4zM8 3h8M12 2v6m-3-3 3 3 3-3",
  frontview: "M4 4h13v16H4zM22 8v8M23 12h-7m3-3-3 3 3 3",
  ruler: "m3 16 13-13 5 5-13 13zM8 11l2 2M11 8l2 2M14 5l2 2",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  back: "M20 12H4m5-5-5 5 5 5",
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
  code: "m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18",
  github: "M9 21v-4c-4 1-4-2-6-3M15 21v-4c0-1-.4-1.5-1-2 4-.5 6-2 6-6 0-1.5-.5-2.5-1.5-3.5L18 2l-4 2h-4L6 2l-.5 3.5C4.5 6.5 4 7.5 4 9c0 4 2 5.5 6 6-.6.5-1 1-1 2",
  explain: "M4 3h16v14H9l-5 4zM8 7h8M8 11h5",
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
