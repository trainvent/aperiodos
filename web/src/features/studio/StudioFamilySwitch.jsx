export default function StudioFamilySwitch({ family, onChange }) {
  const isPenrose = family.startsWith("penrose-");
  const editorFamily = isPenrose ? "penrose" : family;

  return (
    <div className="studio-family-switch">
      <select
        value={editorFamily}
        onChange={(event) => onChange(event.target.value === "penrose" ? (isPenrose ? family : "penrose-kite-dart") : event.target.value)}
        aria-label="Tile editor"
      >
        <option value="einstein">Einstein</option>
        <option value="spectre">Spectre</option>
        <option value="penrose">Penrose</option>
      </select>
      {isPenrose ? (
        <select value={family} onChange={(event) => onChange(event.target.value)} aria-label="Penrose pattern">
          <option value="penrose-kite-dart">P2 · Kite & Dart</option>
          <option value="penrose-rhombs">P3 · Rhombs</option>
          <option value="penrose-p1">P1 · Stars</option>
        </select>
      ) : null}
    </div>
  );
}
