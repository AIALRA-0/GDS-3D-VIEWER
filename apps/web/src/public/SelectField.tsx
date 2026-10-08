import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

type Choice = { value: string; label: string; disabled?: boolean };
export function SelectField({ value, options, onChange, disabled, "aria-label": label }: {
  value: string; options: Choice[]; onChange: (value: string) => void; disabled?: boolean; "aria-label": string;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0), [scroll, setScroll] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const activate = (index: number) => {
    setActive(index); const top = Math.max(0, index * 40 - 80); setScroll(top);
    if (list.current) list.current.scrollTop = top;
  };
  const show = () => { if (disabled || !options.length) return; activate(Math.max(0, options.findIndex(o => o.value === value))); setOpen(true); };
  useLayoutEffect(() => { if (open && list.current) list.current.scrollTop = scroll; }, [open]);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect(), height = Math.min(280, options.length * 40, innerHeight - 24);
      setPosition({ top: rect.bottom + height + 8 <= innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6), left: Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8)), width: Math.min(rect.width, innerWidth - 16), height });
    };
    const outside = (event: Event) => { if (!trigger.current?.contains(event.target as Node) && !list.current?.contains(event.target as Node)) setOpen(false); };
    const moved = (event: Event) => { if (event.target !== list.current) place(); };
    place(); document.addEventListener("pointerdown", outside, true); document.addEventListener("scroll", moved, true); window.addEventListener("resize", place);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("scroll", moved, true); window.removeEventListener("resize", place); };
  }, [open, options.length]);
  const choose = (index: number) => { if (!options[index] || options[index].disabled) return; onChange(options[index].value); setOpen(false); trigger.current?.focus(); };
  const move = (step: number) => { for (let n = 1; n <= options.length; n++) { const index = (active + step * n + options.length) % options.length; if (!options[index].disabled) { activate(index); break; } } };
  const start = Math.max(0, Math.floor(scroll / 40) - 2);
  return <span className="select-field"><button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled || !options.length}
    onClick={() => open ? setOpen(false) : show()} onBlur={event => { if (!list.current?.contains(event.relatedTarget as Node)) setOpen(false); }}
    onKeyDown={event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); if (!open) show(); else move(event.key === "ArrowDown" ? 1 : -1); }
      else if (event.key === "Home" || event.key === "End") { event.preventDefault(); if (!open) show(); activate(event.key === "Home" ? options.findIndex(o => !o.disabled) : options.map(o => !o.disabled).lastIndexOf(true)); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (open) choose(active); else show(); }
      else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      else if (event.key === "Tab") setOpen(false);
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) { const index = options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(event.key.toLowerCase())); if (index >= 0) { event.preventDefault(); setOpen(true); activate(index); } }
    }}><span title={options.find(o => o.value === value)?.label}>{options.find(o => o.value === value)?.label ?? value}</span><Icon name="chevron" /></button>
    {open && createPortal(<div ref={list} id={id} role="listbox" aria-label={label} className="select-menu" style={position} onScroll={e => setScroll(e.currentTarget.scrollTop)} onPointerDown={e => e.preventDefault()}>
      <div style={{ height: options.length * 40, position: "relative" }}>{options.slice(start, start + 12).map((option, index) => <div key={option.value} id={`${id}-${start + index}`} role="option" aria-selected={option.value === value} aria-disabled={!!option.disabled} className={`select-choice ${active === start + index ? "active" : ""}`} style={{ top: (start + index) * 40 }} title={option.label} onPointerMove={() => setActive(start + index)} onClick={() => choose(start + index)}><span>{option.label}</span>{option.value === value && <Icon name="check" />}</div>)}</div>
    </div>, trigger.current?.closest("dialog") ?? trigger.current?.closest(".workbench") ?? document.body)}
  </span>;
}
