import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField, TextField } from "../../components/forms/FormFields";
import { apiUrl } from "../../lib/api";
import { EINSTEIN_DEFAULTS } from "./defaults";
import GeneratorLayout from "./GeneratorLayout";
import GeneratorSettingsScaffold, { SettingsRow } from "./GeneratorSettingsScaffold";
import { getEinsteinStudioPatterns, STUDIO_LIBRARY_EVENT, studioPatternId, studioPatternValue } from "../studio/patternLibrary";

export default function EinsteinPage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(EINSTEIN_DEFAULTS);
  const [studioPatterns, setStudioPatterns] = useState([]);

  useEffect(() => {
    async function refreshPatterns() {
      try {
        setStudioPatterns(await getEinsteinStudioPatterns());
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

  const patternOptions = useMemo(() => [
    { value: "builtin:curves", label: t("generator.material.curves") },
    ...studioPatterns.map((pattern) => ({ value: studioPatternValue(pattern.id), label: `${pattern.name} · ${t("generator.material.studio")}` })),
  ], [studioPatterns, t]);
  const selectedStudioPattern = studioPatterns.find((pattern) => pattern.id === studioPatternId(values.pattern_design));
  const patternStrokeWidth = selectedStudioPattern?.strokeWidth;
  const patternTileColor = selectedStudioPattern?.colors?.base;
  const patternOutline = selectedStudioPattern?.outline;

  useEffect(() => {
    if (!selectedStudioPattern) return;
    setValues((current) => ({
      ...current,
      color_mode: "simple",
      simple_color: patternTileColor || current.simple_color,
      stroke_width: patternStrokeWidth ?? current.stroke_width,
      outline: patternOutline || current.outline,
    }));
  }, [selectedStudioPattern?.id, patternStrokeWidth, patternTileColor, patternOutline]);

  return (
    <>
      <GeneratorLayout
      title={t("generator.einstein.title")}
      generator="einstein"
      controls={
        <GeneratorSettingsScaffold
          values={values}
          setValues={setValues}
          patternOptions={patternOptions}
          parameters={
            <SettingsRow>
              <NumberField values={values} setValues={setValues} name="iterations" label={t("generator.common.iterations")} min={1} max={6} />
              <NumberField values={values} setValues={setValues} name="scale" label={t("generator.common.scale")} min={1} max={1000} />
            </SettingsRow>
          }
          centerStep="0.1"
          allowMaterial
          modes={
            <SettingsRow>
              <SelectField
                values={values}
                setValues={setValues}
                name="color_mode"
                label={t("generator.einstein.coloring")}
                options={[
                  { value: "simple", label: t("generator.einstein.coloringSimple") },
                  { value: "families", label: t("generator.einstein.coloringFamilies") },
                  { value: "four_color", label: t("generator.einstein.coloringFourColor") }
                ]}
              />
              <TextField values={values} setValues={setValues} name="seed" label={t("generator.common.seed")} placeholder={t("generator.common.optional")} />
            </SettingsRow>
          }
          palette={
            values.color_mode === "simple" ? (
              <ColorField
                values={values}
                setValues={setValues}
                name="simple_color"
                label={t("generator.material.tileColor")}
                full
              />
            ) : values.color_mode === "families" ? (
              <>
                <ColorField values={values} setValues={setValues} name="color_h1" label="H1" />
                <ColorField values={values} setValues={setValues} name="color_h" label="H" />
                <ColorField values={values} setValues={setValues} name="color_t" label="T" />
                <ColorField values={values} setValues={setValues} name="color_p" label="P" />
                <ColorField values={values} setValues={setValues} name="color_f" label="F" full />
              </>
            ) : (
              <>
                <ColorField values={values} setValues={setValues} name="four_color_1" label={t("generator.common.color1")} />
                <ColorField values={values} setValues={setValues} name="four_color_2" label={t("generator.common.color2")} />
                <ColorField values={values} setValues={setValues} name="four_color_3" label={t("generator.common.color3")} />
                <ColorField values={values} setValues={setValues} name="four_color_4" label={t("generator.common.color4")} />
              </>
            )
          }
        />
      }
      payload={() => {
        const payload = {
          iterations: Number(values.iterations),
          scale: Number(values.scale),
          width: Number(values.width),
          height: Number(values.height),
          center_x: Number(values.center_x),
          center_y: Number(values.center_y),
          format: values.format,
          color_mode: values.color_mode,
          simple_color: values.simple_color,
          material_mode: values.material_mode,
          pattern_style: values.pattern_style,
          pattern_base: values.pattern_base,
          pattern_color: values.pattern_color,
          colors: [values.color_h1, values.color_h, values.color_t, values.color_p, values.color_f],
          four_colors: [values.four_color_1, values.four_color_2, values.four_color_3, values.four_color_4],
          background: values.background,
          outline: values.outline,
          stroke_width: Number(values.stroke_width)
        };
        if (String(values.seed).trim()) {
          payload.seed = Number(values.seed);
        }
        if (selectedStudioPattern) {
          payload.studio_pattern = {
            ...selectedStudioPattern,
            colors: { ...selectedStudioPattern.colors, base: values.simple_color },
          };
        }
        return payload;
      }}
      endpoint={apiUrl("/api/einstein/render")}
      downloadName={(payload) => `aperiodic-pattern.${payload.format}`}
      previewType={(payload) => {
        if (payload.format === "jpg") {
          return "image/jpeg";
        }
        if (payload.format === "svg") {
          return "image/svg+xml";
        }
        return "image/png";
      }}
      values={values}
      setValues={setValues}
      defaults={EINSTEIN_DEFAULTS}
      />
    </>
  );
}
