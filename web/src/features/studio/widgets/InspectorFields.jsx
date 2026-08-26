function FieldShell({ label, className = "", children }) {
  return (
    <label className={`studio-widget-field${className ? ` ${className}` : ""}`}>
      <span className="studio-widget-label">{label}</span>
      {children}
    </label>
  );
}

export function InspectorTextField({ label, value, onChange }) {
  return (
    <FieldShell label={label}>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function InspectorSelectField({ label, value, onChange, children }) {
  return (
    <FieldShell label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </FieldShell>
  );
}

export function InspectorColorField({ label, value, onChange }) {
  return (
    <FieldShell label={label} className="studio-widget-color">
      <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function InspectorRangeField({ label, value, min, max, step, digits = 2, editable = false, onChange }) {
  const numericValue = Number(value);
  const formatted = Number.isFinite(numericValue) ? numericValue.toFixed(digits) : "–";
  const update = (nextValue) => {
    const number = Number(nextValue);
    if (Number.isFinite(number)) onChange(number);
  };
  return (
    <label className="studio-widget-field studio-widget-range">
      <span className="studio-widget-range-head">
        <span className="studio-widget-label">{label}</span>
        {editable ? (
          <input type="number" aria-label={label} min={min} max={max} step={step} value={formatted} onChange={(event) => update(event.target.value)} />
        ) : <output>{formatted}</output>}
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(event) => update(event.target.value)} />
    </label>
  );
}

export function InspectorToggleField({ label, checked, onChange, indicator }) {
  return (
    <label className="studio-widget-toggle">
      <span className="studio-widget-label">{label}</span>
      <span className="studio-widget-switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span aria-hidden="true" />
      </span>
      {indicator ? <b aria-hidden="true">{indicator}</b> : null}
    </label>
  );
}
