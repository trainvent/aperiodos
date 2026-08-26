export function InspectorPanel({ ariaLabel, icon, title, children, help }) {
  return (
    <aside className="studio-context-bar" aria-label={ariaLabel}>
      <header className="studio-context-heading">
        <span className="studio-context-type" title={title} aria-hidden="true">{icon}</span>
        <strong>{title}</strong>
      </header>
      <div className="studio-inspector-content">
        {children}
        {help ? <p className="studio-widget-help">{help}</p> : null}
      </div>
    </aside>
  );
}

export function InspectorGroup({ title, titleId, children, className = "" }) {
  return (
    <section className={`studio-widget-group${className ? ` ${className}` : ""}`} aria-labelledby={title ? titleId : undefined}>
      {title ? <h3 id={titleId}>{title}</h3> : null}
      <div className="studio-widget-grid">{children}</div>
    </section>
  );
}

export function InspectorActions({ children }) {
  return <div className="studio-widget-actions">{children}</div>;
}

export function InspectorMetric({ children, warning = false }) {
  return <output className={`studio-widget-metric${warning ? " warning" : ""}`}>{children}</output>;
}
