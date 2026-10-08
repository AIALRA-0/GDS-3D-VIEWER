export function ColorField({ label, value, onChange, showValue = false, inputClass = "" }: {
  label: string; value: string; onChange: (value: string) => void; showValue?: boolean; inputClass?: string;
}) {
  return <span className={`color-field ${showValue ? "with-value" : ""}`}>
    <span className="color-preview" style={{ backgroundColor: value }} aria-hidden="true" />
    {showValue && <code aria-hidden="true">{value.toUpperCase()}</code>}
    <input type="color" className={inputClass} aria-label={label} title={label} value={value} onChange={e => onChange(e.target.value)} />
  </span>;
}
