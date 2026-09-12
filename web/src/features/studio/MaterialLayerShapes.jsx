export default function MaterialLayerShapes({ layers, colorFor, baseColor, mapPoint, renderPath, strokeScale, radiusScale = strokeScale, onSelect, selectedIds = {} }) {
  return layers.map(({ kind, id, item }) => {
    if (kind === "polygon") {
      return <polygon
        key={`${kind}:${id}`}
        className="studio-material-polygon"
        points={item.points.map((point) => {
          const mapped = mapPoint(point);
          return `${mapped.x},${mapped.y}`;
        }).join(" ")}
        fill={colorFor(item)}
        stroke={item.strokeColor || "none"}
        strokeWidth={(item.width || 0) * strokeScale}
        strokeLinejoin="round"
        onPointerDown={onSelect ? () => onSelect(kind, id) : undefined}
      />;
    }
    if (kind === "circle") {
      const center = mapPoint(item.center);
      const color = item.operation === "ink" ? colorFor(item) : baseColor;
      const radius = item.radius * radiusScale;
      const hollow = item.hollow === true;
      const strokeWidth = Math.min(item.width ?? 0.05, item.radius) * strokeScale;
      return <circle
        key={`${kind}:${id}`}
        className="studio-material-circle"
        cx={center.x}
        cy={center.y}
        r={radius}
        fill={hollow ? "none" : color}
        stroke={hollow ? color : "none"}
        strokeWidth={hollow ? strokeWidth : undefined}
        onPointerDown={onSelect ? () => onSelect(kind, id) : undefined}
      />;
    }
    const selected = id === selectedIds[kind];
    return <path key={`${kind}:${id}`} className={`studio-material-path${kind === "circularPath" ? " studio-circular-material-path" : ""}${selected ? " selected" : ""}`} d={renderPath(kind, item)} fill="none" stroke={colorFor(item)} strokeWidth={item.width * strokeScale} strokeLinecap="round" strokeLinejoin="round" onPointerDown={onSelect ? () => onSelect(kind, id) : undefined} />;
  });
}
