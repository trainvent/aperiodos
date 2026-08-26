export default function StudioSurface({ as: Element = "div", className = "", children, ...props }) {
  return (
    <Element className={`panel studio-surface${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </Element>
  );
}
