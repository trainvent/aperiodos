import { useMemo, useState } from "react";
import StudioFamilySwitch from "./StudioFamilySwitch";
import { SPECTRE_POINTS, spectrePath } from "./spectreGeometry";

export default function SpectreStudioPage({ onFamilyChange }) {
  const [name, setName] = useState("Untitled Spectre pattern");
  const [base, setBase] = useState("#ffffff");
  const [ink, setInk] = useState("#00a77b");
  const [roundness, setRoundness] = useState(0.18);
  const [lean, setLean] = useState(1);
  const path = useMemo(() => spectrePath(SPECTRE_POINTS, roundness, lean), [roundness, lean]);
  return (
    <section className="studio-page">
      <div className="panel studio-layout studio-builder-shell spectre-studio-shell">
        <div className="studio-top-toolbar" role="toolbar" aria-label="Spectre Studio tools">
          <div className="studio-toolbar-row studio-toolbar-main">
            <div className="studio-toolbar-identity">
              <span className="studio-product-mark">A</span>
              <div><strong>APERIODOS STUDIO</strong><small>SPECTRE-MATERIAL-ARBEITSBEREICH</small></div>
            </div>
            <StudioFamilySwitch family="spectre" onChange={onFamilyChange} />
            <label className="studio-toolbar-name"><span>Name des Entwurfs</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          </div>
        </div>
        <main className="studio-workbench">
          <div className="studio-canvas-surface">
            <svg className="studio-canvas spectre-editor-canvas" viewBox="-1.2 -1.1 6.2 5.4" aria-label="Spectre tile editor">
              <rect x="-1.2" y="-1.1" width="6.2" height="5.4" className="studio-canvas-bg" />
              <path d={path} fill={base} stroke={ink} strokeWidth="0.045" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="studio-canvas-legend"><span><i className="legend-anchor" />Spectre tile</span><span>Curvature updates live</span></div>
        </main>
        <aside className="studio-context-bar" aria-label="Spectre tile settings">
          <span className="studio-context-type">⌁</span><strong>SPECTRE TILE</strong>
          <label className="studio-context-color"><span>Tile color</span><input type="color" value={base} onChange={(event) => setBase(event.target.value)} /></label>
          <label className="studio-context-color"><span>Outline color</span><input type="color" value={ink} onChange={(event) => setInk(event.target.value)} /></label>
          <label className="studio-context-range"><span>Roundness {roundness.toFixed(2)}</span><input type="range" min="0" max="0.45" step="0.01" value={roundness} onChange={(event) => setRoundness(Number(event.target.value))} /></label>
          <label className="studio-context-range"><span>Bend direction {lean.toFixed(2)}</span><input type="range" min="-1" max="1" step="0.05" value={lean} onChange={(event) => setLean(Number(event.target.value))} /></label>
          <span className="studio-context-help">Roundness controls the curve amount; bend direction flips the parabola’s lean.</span>
        </aside>
      </div>
    </section>
  );
}
