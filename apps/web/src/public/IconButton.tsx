import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export function IconButton({ icon, label, onClick, pressed, disabled = false, className = "", buttonRef, popup, loading = false, children }: {
  icon: string; label: string; onClick: () => void; pressed?: boolean; disabled?: boolean;
  className?: string; buttonRef?: Ref<HTMLButtonElement>; popup?: "dialog"; loading?: boolean; children?: ReactNode;
}) {
  const id = useId(), anchor = useRef<HTMLButtonElement | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number; below: boolean; host: HTMLElement } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = () => { clearTimeout(timer.current); setTip(null); };
  const show = () => {
    const button = anchor.current; if (!button) return;
    const box = button.getBoundingClientRect(), below = box.top < 48;
    setTip({ left: Math.max(124, Math.min(innerWidth - 124, box.left + box.width / 2)), top: below ? box.bottom + 8 : box.top - 8, below, host: button.closest("dialog") ?? document.body });
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!tip) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    addEventListener("keydown", escape); addEventListener("resize", hide); addEventListener("scroll", hide, true);
    return () => { removeEventListener("keydown", escape); removeEventListener("resize", hide); removeEventListener("scroll", hide, true); };
  }, [tip]);
  return <>
    <button type="button" className={`icon-button ${className}`} aria-label={label} aria-describedby={tip ? id : undefined}
      aria-pressed={pressed} aria-haspopup={popup} aria-busy={loading || undefined} disabled={disabled}
      ref={(button) => { anchor.current = button; if (typeof buttonRef === "function") buttonRef(button); else if (buttonRef) Object.assign(buttonRef, { current: button }); }}
      onMouseEnter={() => { clearTimeout(timer.current); timer.current = setTimeout(show, 250); }} onMouseLeave={() => { clearTimeout(timer.current); timer.current = setTimeout(hide, 150); }}
      onFocus={show} onBlur={hide} onClick={() => { hide(); onClick(); }}>
      {loading ? <span className="ai-spinner" aria-hidden="true" /> : children ?? <Icon name={icon} />}
    </button>
    {tip && createPortal(<span id={id} role="tooltip" className="button-tooltip" onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={hide} style={{ left: tip.left, top: tip.top, transform: tip.below ? "translateX(-50%)" : "translate(-50%, -100%)" }}>{label}</span>, tip.host)}
  </>;
}
