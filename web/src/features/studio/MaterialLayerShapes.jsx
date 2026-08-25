export default function MaterialLayerShapes({ layers, colorFor, baseColor, mapPoint, renderPath, strokeScale, onSelect, selectedIds = {} }) {
  return layers.map(({ kind, id, item }) => {
    if (kind === "circle") {
      const center = mapPoint(item.center);
      return <circle key={`${kind}:${id}`} className="studio-material-circle" cx={center.x} cy={center.y} r={item.radius * strokeScale} fill={item.operation === "ink" ? colorFor(item) : baseColor} onPointerDown={onSelect ? () => onSelect(kind, id) : undefined} />;
    }
    const selected = id === selectedIds[kind];
    return <path key={`${kind}:${id}`} className={`studio-material-path${kind === "circularPath" ? " studio-circular-material-path" : ""}${selected ? " selected" : ""}`} d={renderPath(kind, item)} fill="none" stroke={colorFor(item)} strokeWidth={item.width * strokeScale} strokeLinecap="round" strokeLinejoin="round" onPointerDown={onSelect ? () => onSelect(kind, id) : undefined} />;
  });
}
