export default function StudioFamilySwitch({ family, onChange }) {
  return (
    <label className="studio-family-switch">
      <select value={family} onChange={(event) => onChange(event.target.value)} aria-label="Tile editor">
        <option value="einstein">Einstein</option>
        <option value="spectre">Spectre</option>
      </select>
    </label>
  );
}
