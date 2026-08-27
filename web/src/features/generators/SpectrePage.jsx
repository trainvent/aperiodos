import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField } from "../../components/forms/FormFields";
import { apiUrl } from "../../lib/api";
import { SPECTRE_DEFAULTS } from "./defaults";
import GeneratorLayout from "./GeneratorLayout";
import GeneratorSettingsScaffold, { SettingsRow } from "./GeneratorSettingsScaffold";
import { getSpectreStudioPatterns, STUDIO_LIBRARY_EVENT, studioPatternId, studioPatternValue } from "../studio/patternLibrary";

export default function SpectrePage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(SPECTRE_DEFAULTS);
  const [studioPatterns, setStudioPatterns] = useState([]);

  useEffect(() => {
    async function refreshPatterns() {
      try {
        setStudioPatterns(await getSpectreStudioPatterns());
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

  const patternOptions = useMemo(() => studioPatterns.map((pattern) => ({
    value: studioPatternValue(pattern.id),
    label: `${pattern.name} · ${t("generator.material.studio")}`,
  })), [studioPatterns, t]);
  const selectedStudioPattern = studioPatterns.find((pattern) => pattern.id === studioPatternId(values.pattern_design))
    || (values.material_mode === "pattern" ? studioPatterns[0] : null);
  const selectedShape = selectedStudioPattern
    ? (selectedStudioPattern.tileShape?.roundness > 0 ? "curved" : "straight")
    : values.shape;
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
    <GeneratorLayout
      title={t("generator.spectre.title")}
      generator="spectre"
      controls={
        <GeneratorSettingsScaffold
          values={values}
          setValues={setValues}
          allowMaterial
          patternOptions={patternOptions}
          materialCompanion={<SelectField
            values={values}
            setValues={setValues}
            name="shape"
            label={t("generator.spectre.shape")}
            options={[
              { value: "straight", label: t("generator.spectre.shapeStraight") },
              { value: "curved", label: t("generator.spectre.shapeCurved") }
            ]}
          />}
          parameters={
            <SettingsRow>
              <NumberField
                values={values}
                setValues={setValues}
                name="iterations"
                label={t("generator.common.iterations")}
                min={1}
                max={8}
              />
              <NumberField values={values} setValues={setValues} name="scale" label={t("generator.common.scale")} min={1} max={1000} />
            </SettingsRow>
          }
          centerStep="0.1"
          modes={
            <>
              <SettingsRow>
                <SelectField
                  values={values}
                  setValues={setValues}
                  name="color_mode"
                  label={t("generator.einstein.coloring")}
                  options={[
                    { value: "simple", label: t("generator.einstein.coloringSimple") },
                    { value: "generated", label: t("generator.spectre.drawModeBuild") },
                    { value: "translation", label: t("generator.spectre.drawModeTranslation") }
                  ]}
                />
              </SettingsRow>
            </>
          }
          palette={
            values.color_mode === "simple" ? <ColorField values={values} setValues={setValues} name="simple_color" label={t("generator.material.tileColor")} full /> : <>
              <ColorField values={values} setValues={setValues} name="palette_1" label={t("generator.common.color1")} />
              <ColorField values={values} setValues={setValues} name="palette_2" label={t("generator.common.color2")} />
              <ColorField values={values} setValues={setValues} name="palette_3" label={t("generator.common.color3")} />
              <ColorField values={values} setValues={setValues} name="palette_4" label={t("generator.common.color4")} />
            </>
          }
        />
      }
      payload={() => {
        const payload = {
          width: Number(values.width),
          height: Number(values.height),
          iterations: Number(values.iterations) || SPECTRE_DEFAULTS.iterations,
          auto_iterations: false,
          scale: Number(values.scale),
          center_x: Number(values.center_x),
          center_y: Number(values.center_y),
          format: values.format,
          material_mode: values.material_mode,
          color_mode: values.color_mode === "simple" ? "simple" : "families",
          draw_mode: values.color_mode === "generated" ? "generated" : "translation",
          shape: selectedShape,
          background: values.background,
          outline: values.outline,
          stroke_width: Number(values.stroke_width),
          simple_color: values.simple_color,
          palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
            .map((value) => String(value).trim())
            .filter(Boolean)
        };
        if (selectedStudioPattern) {
          payload.studio_pattern = {
            ...selectedStudioPattern,
            colors: { ...selectedStudioPattern.colors, base: values.simple_color },
          };
        }
        return payload;
      }}
      endpoint={apiUrl("/api/spectre/render")}
      downloadName={(payload) => `spectre.${payload.format}`}
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
      defaults={SPECTRE_DEFAULTS}
    />
  );
}
