import { useMemo, useState } from "react";
import MaterialLayerShapes from "./MaterialLayerShapes";
import StudioFamilySwitch from "./StudioFamilySwitch";
import { SPECTRE_POINTS, spectrePath } from "./spectreGeometry";

export default function SpectreStudioPage({ onFamilyChange }) {
  const [name, setName] = useState("Untitled Spectre pattern");
  const [base, setBase] = useState("#ffffff");
  const [ink, setInk] = useState("#000000");
  const [outlineWidth, setOutlineWidth] = useState(1);
  const [roundness, setRoundness] = useState(0.18);
  const [lean, setLean] = useState(1);
  const [weight, setWeight] = useState(0.5);
  const [workspace, setWorkspace] = useState("shape");
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const path = useMemo(() => spectrePath(SPECTRE_POINTS, roundness, lean, weight), [roundness, lean, weight]);
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId)?.item;
  const addCircle = () => {
    const id = `spectre-circle-${Date.now()}`;
    setLayers((current) => [...current, { kind: "circle", id, item: { center: { x: 1.8, y: 1.4 }, radius: 0.38, operation: "ink", color: "#00a77b" } }]);
    setSelectedLayerId(id);
  };
  const addStroke = () => {
    const id = `spectre-stroke-${Date.now()}`;
    setLayers((current) => [...current, { kind: "path", id, item: { points: [{ x: 0.5, y: 1.1 }, { x: 2.6, y: 2.15 }], width: 12, color: "#00a77b" } }]);
    setSelectedLayerId(id);
  };
  const updateLayer = (changes) => setLayers((current) => current.map((layer) => layer.id === selectedLayerId ? { ...layer, item: { ...layer.item, ...changes } } : layer));
  return (
    <section className="studio-page">
      <div className="panel studio-layout studio-builder-shell spectre-studio-shell">
        <div className="studio-top-toolbar" role="toolbar" aria-label="Spectre Studio tools">
          <div className="studio-toolbar-row studio-toolbar-main">
            <StudioFamilySwitch family="spectre" onChange={onFamilyChange} />
            <label className="studio-toolbar-name"><span>Name des Entwurfs</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="studio-workspace-tabs"><button type="button" className={workspace === "shape" ? "active" : ""} onClick={() => setWorkspace("shape")}>Shape</button><button type="button" className={workspace === "pattern" ? "active" : ""} onClick={() => setWorkspace("pattern")}>Pattern</button></div>
          </div>
        </div>
        <main className="studio-workbench">
          <div className="studio-canvas-surface">
            <svg className="studio-canvas spectre-editor-canvas" viewBox="-1.2 -1.1 6.2 5.4" aria-label="Spectre tile editor">
              <rect x="-1.2" y="-1.1" width="6.2" height="5.4" className="studio-canvas-bg" />
              <path d={path} fill={base} stroke={ink} strokeWidth={outlineWidth} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {workspace === "pattern" ? <g clipPath="url(#spectre-material-clip)"><MaterialLayerShapes layers={layers} mapPoint={(point) => point} colorFor={(item) => item.color || ink} baseColor={base} renderPath={(_, item) => `M ${item.points.map((point) => `${point.x} ${point.y}`).join(" L ")}`} strokeScale={0.012} onSelect={(_, id) => setSelectedLayerId(id)} selectedIds={{ path: selectedLayerId }} /></g> : null}
              <defs><clipPath id="spectre-material-clip"><path d={path} /></clipPath></defs>
            </svg>
          </div>
          <div className="studio-canvas-legend"><span><i className="legend-anchor" />Spectre tile</span><span>{workspace === "shape" ? "Curvature updates live" : "Material layers are clipped to the current shape"}</span></div>
        </main>
        <aside className="studio-context-bar" aria-label="Spectre tile settings">
          <span className="studio-context-type">⌁</span><strong>{workspace === "shape" ? "SPECTRE TILE" : "SPECTRE PATTERN"}</strong>
          {workspace === "pattern" ? <>
            <div className="studio-pattern-actions"><button type="button" onClick={addCircle}>Add circle</button><button type="button" onClick={addStroke}>Add stroke</button></div>
            {layers.map((layer, index) => <button type="button" className={`studio-pattern-layer${layer.id === selectedLayerId ? " active" : ""}`} key={layer.id} onClick={() => setSelectedLayerId(layer.id)}>{layer.kind === "circle" ? "○" : "⌇"} Layer {index + 1}</button>)}
            {selectedLayer ? <><label className="studio-context-color"><span>Layer color</span><input type="color" value={selectedLayer.color} onChange={(event) => updateLayer({ color: event.target.value })} /></label>{selectedLayer.radius ? <label className="studio-context-range"><span>Radius {selectedLayer.radius.toFixed(2)}</span><input type="range" min="0.1" max="1.2" step="0.02" value={selectedLayer.radius} onChange={(event) => updateLayer({ radius: Number(event.target.value) })} /></label> : <label className="studio-context-range"><span>Width {selectedLayer.width}</span><input type="range" min="2" max="40" step="1" value={selectedLayer.width} onChange={(event) => updateLayer({ width: Number(event.target.value) })} /></label>}</> : <span className="studio-context-help">Add a circle or stroke to begin your material pattern.</span>}</> : <>
          <label className="studio-context-range"><span>Roundness {roundness.toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" value={roundness} onChange={(event) => setRoundness(Number(event.target.value))} /></label>
          <label className="studio-context-range"><span>Parabolic weight {weight.toFixed(2)}</span><input type="range" min="0.15" max="0.85" step="0.01" value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></label>
          <label className="studio-bend-switch"><span>Invert bend</span><input type="checkbox" checked={lean > 0} onChange={(event) => setLean(event.target.checked ? 1 : -1)} /><b aria-hidden="true">{lean > 0 ? "↻" : "↺"}</b></label>
          <span className="studio-context-help">Roundness controls the curve amount; parabolic weight shifts its peak along each edge.</span>
          <details className="studio-secondary-settings">
            <summary>Appearance &amp; outline</summary>
            <label className="studio-context-color"><span>Tile color</span><input type="color" value={base} onChange={(event) => setBase(event.target.value)} /></label>
            <label className="studio-context-color"><span>Outline color</span><input type="color" value={ink} onChange={(event) => setInk(event.target.value)} /></label>
            <label className="studio-context-range"><span>Outline width {outlineWidth.toFixed(1)}</span><input type="range" min="0" max="5" step="0.25" value={outlineWidth} onChange={(event) => setOutlineWidth(Number(event.target.value))} /></label>
          </details>
          </>}
        </aside>
      </div>
    </section>
  );
}
