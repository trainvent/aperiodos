import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField } from "../../components/forms/FormFields";
import { apiUrl } from "../../lib/api";
import { PENROSE_DEFAULTS } from "./defaults";
import GeneratorLayout from "./GeneratorLayout";
import GeneratorSettingsScaffold, { SettingsRow } from "./GeneratorSettingsScaffold";
import { getPenroseStudioPatterns, STUDIO_LIBRARY_EVENT, studioPatternId, studioPatternValue } from "../studio/patternLibrary";

export default function PenrosePage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(PENROSE_DEFAULTS);
  const [studioPatterns, setStudioPatterns] = useState([]);
  const previousTileModeRef = useRef(PENROSE_DEFAULTS.tile_mode);
  const modeScaleDefaults = { "kite-dart": 100, rhombs: 100, p1: 100 };
  const modeLegacyScales = { "kite-dart": [320], rhombs: [320], p1: [7, 10, 14, 285, 320] };
  const p1PaletteDefaults = ["seagreen", "midnightblue", "sandybrown", "goldenrod"];
  const legacyPaletteDefaults = ["wheat", "midnightblue", "sandybrown", "seagreen"];
  const cartwheelPaletteDefaults = ["lightyellow", "lightcoral", "gainsboro", "dodgerblue"];
  const cartwheelLegacyHexDefaults = ["#ffffb3", "#ff6666", "#e6e6e6", "#0080ff"];

  useEffect(() => {
    async function refreshPatterns() {
      try {
        setStudioPatterns(await getPenroseStudioPatterns());
      } catch {
        setStudioPatterns([]);
      }
    }
    refreshPatterns();
    window.addEventListener(STUDIO_LIBRARY_EVENT, refreshPatterns);
    window.addEventListener("storage", refreshPatterns);
    return () => {
      window.removeEventListener(STUDIO_LIBRARY_EVENT, refreshPatterns);
      window.removeEventListener("storage", refreshPatterns);
    };
  }, []);

  const compatibleStudioPatterns = studioPatterns.filter((pattern) => !pattern.tileMode || pattern.tileMode === values.tile_mode);
  const patternOptions = useMemo(() => [
    { value: "builtin:crosshatch", label: t("generator.material.crosshatch") },
    ...compatibleStudioPatterns.map((pattern) => ({ value: studioPatternValue(pattern.id), label: `${pattern.name} · ${t("generator.material.studio")}` })),
  ], [compatibleStudioPatterns, t]);
  const selectedStudioPattern = compatibleStudioPatterns.find((pattern) => pattern.id === studioPatternId(values.pattern_design));
  const patternStrokeWidth = selectedStudioPattern?.strokeWidth;
  const patternOutline = selectedStudioPattern?.outline;

  useEffect(() => {
    if (!selectedStudioPattern) return;
    setValues((current) => ({ ...current, stroke_width: patternStrokeWidth ?? current.stroke_width, outline: patternOutline || current.outline }));
  }, [selectedStudioPattern?.id, patternStrokeWidth, patternOutline]);

  useEffect(() => {
    const previousMode = previousTileModeRef.current;
    const nextMode = values.tile_mode;
    previousTileModeRef.current = nextMode;

    if (previousMode === nextMode) {
      return;
    }

    setValues((current) => {
      const next = { ...current };
      let changed = false;

      const knownPreviousScales = [
        modeScaleDefaults[previousMode],
        ...(modeLegacyScales[previousMode] || [])
      ];
      if (knownPreviousScales.includes(Number(next.scale))) {
        next.scale = modeScaleDefaults[nextMode];
        changed = true;
      }

      if (nextMode === "p1") {
        const currentPalette = [next.palette_1, next.palette_2, next.palette_3, next.palette_4];
        const paletteLooksDefault =
          currentPalette.every((color, index) => color === legacyPaletteDefaults[index]) ||
          currentPalette.every((color, index) => color === PENROSE_DEFAULTS[`palette_${index + 1}`]);
        if (paletteLooksDefault) {
          [next.palette_1, next.palette_2, next.palette_3, next.palette_4] = p1PaletteDefaults;
          changed = true;
        }
      }
      if (nextMode !== "kite-dart" && next.build_logic !== "default") {
        next.build_logic = "default";
        changed = true;
      }

      return changed ? next : current;
    });
  }, [values.tile_mode, setValues]);

  useEffect(() => {
    if (values.tile_mode !== "kite-dart") {
      return;
    }

    setValues((current) => {
      const currentPalette = [current.palette_1, current.palette_2, current.palette_3, current.palette_4];
      const matchesLegacyDefaults = currentPalette.every((color, index) => color === legacyPaletteDefaults[index]);
      const matchesCartwheelDefaults =
        currentPalette.every((color, index) => color === cartwheelPaletteDefaults[index]) ||
        currentPalette.every((color, index) => color === cartwheelLegacyHexDefaults[index]);

      if (current.build_logic === "cartwheel" && matchesLegacyDefaults) {
        return {
          ...current,
          palette_1: cartwheelPaletteDefaults[0],
          palette_2: cartwheelPaletteDefaults[1],
          palette_3: cartwheelPaletteDefaults[2],
          palette_4: cartwheelPaletteDefaults[3]
        };
      }

      if (current.build_logic === "default" && matchesCartwheelDefaults) {
        return {
          ...current,
          palette_1: legacyPaletteDefaults[0],
          palette_2: legacyPaletteDefaults[1],
          palette_3: legacyPaletteDefaults[2],
          palette_4: legacyPaletteDefaults[3]
        };
      }

      return current;
    });
  }, [values.build_logic, values.tile_mode, setValues]);

  return (
    <GeneratorLayout
      title={t("generator.penrose.title")}
      generator="penrose"
      controls={
        <GeneratorSettingsScaffold
          values={values}
          setValues={setValues}
          allowMaterial
          patternOptions={patternOptions}
          parameters={
            <SettingsRow>
              <NumberField values={values} setValues={setValues} name="iterations" label={t("generator.common.iterations")} min={0} max={10} />
              <NumberField values={values} setValues={setValues} name="scale" label={t("generator.common.scale")} min={1} max={1000} />
            </SettingsRow>
          }
          centerStep="0.01"
          modes={
            <SettingsRow>
              <SelectField
                values={values}
                setValues={setValues}
                name="build_logic"
                label={t("generator.penrose.drawLogic")}
                options={[
                  { value: "default", label: t("generator.penrose.drawLogicDefault") },
                  { value: "cartwheel", label: t("generator.penrose.drawLogicCartwheel") }
                ]}
                disabled={values.tile_mode !== "kite-dart"}
              />
              <SelectField
                values={values}
                setValues={setValues}
                name="tile_mode"
                label={t("generator.penrose.tiles")}
                options={[
                  { value: "kite-dart", label: t("generator.penrose.tilesP2") },
                  { value: "rhombs", label: t("generator.penrose.tilesP3") },
                  { value: "p1", label: t("generator.penrose.tilesP1") }
                ]}
              />
            </SettingsRow>
          }
          palette={
            <>
              <ColorField values={values} setValues={setValues} name="palette_1" label={t("generator.common.color1")} />
              <ColorField values={values} setValues={setValues} name="palette_2" label={t("generator.common.color2")} />
              <ColorField values={values} setValues={setValues} name="palette_3" label={t("generator.common.color3")} />
              <ColorField values={values} setValues={setValues} name="palette_4" label={t("generator.common.color4")} />
            </>
          }
        />
      }
      payload={() => ({
        width: Number(values.width),
        height: Number(values.height),
        iterations: Number(values.iterations),
        scale: Number(values.scale),
        center_x: Number(values.center_x),
        center_y: Number(values.center_y),
        format: values.format,
        material_mode: values.material_mode,
        build_logic: values.build_logic,
        tile_mode: values.tile_mode,
        background: values.background,
        outline: values.outline,
        stroke_width: Number(values.stroke_width),
        palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
          .map((value) => String(value).trim())
          .filter(Boolean),
        ...(selectedStudioPattern ? { studio_pattern: selectedStudioPattern } : {})
      })}
      endpoint={apiUrl("/api/penrose/render")}
      downloadName={(payload) => `penrose.${payload.format}`}
      previewType={(payload) => {
        if (payload.format === "png") {
          return "image/png";
        }
        if (payload.format === "jpg") {
          return "image/jpeg";
        }
        return "image/svg+xml";
      }}
      values={values}
      setValues={setValues}
      defaults={PENROSE_DEFAULTS}
    />
  );
}
