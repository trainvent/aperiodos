import { useTranslation } from "react-i18next";

export default function StudioFamilySwitch({ family, onChange }) {
  const { t } = useTranslation("common");
  const isPenrose = family.startsWith("penrose-");
  const editorFamily = isPenrose ? "penrose" : family;

  return (
    <div className="studio-family-switch">
      <select
        value={editorFamily}
        onChange={(event) => onChange(event.target.value === "penrose" ? (isPenrose ? family : "penrose-kite-dart") : event.target.value)}
        aria-label={t("studio.family.editor")}
      >
        <option value="einstein">Einstein</option>
        <option value="spectre">Spectre</option>
        <option value="penrose">{t("studio.family.penroseExperimental")}</option>
      </select>
      {isPenrose ? (
        <select value={family} onChange={(event) => onChange(event.target.value)} aria-label={t("studio.family.penrosePattern")}>
          <option value="penrose-kite-dart">{t("generator.penrose.tilesP2")}</option>
          <option value="penrose-rhombs">{t("generator.penrose.tilesP3")}</option>
          <option value="penrose-p1">{t("generator.penrose.tilesP1")}</option>
        </select>
      ) : null}
    </div>
  );
}
