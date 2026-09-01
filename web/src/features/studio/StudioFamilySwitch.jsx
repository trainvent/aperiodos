export default function StudioFamilySwitch({ family, onChange }) {
  return (
    <label className="studio-family-switch">
      <select value={family} onChange={(event) => onChange(event.target.value)} aria-label="Tile editor">
        <option value="einstein">Einstein</option>
        <option value="spectre">Spectre</option>
        <option value="penrose-kite-dart">Penrose P2 · Kite & Dart</option>
        <option value="penrose-rhombs">Penrose P3 · Rhombs</option>
        <option value="penrose-p1">Penrose P1 · Stars</option>
      </select>
    </label>
  );
}
