import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField } from "../../components/forms/FormFields";
import { apiUrl } from "../../lib/api";
import { SPECTRE_DEFAULTS } from "./defaults";
import GeneratorLayout from "./GeneratorLayout";
import GeneratorSettingsScaffold, { SettingsRow } from "./GeneratorSettingsScaffold";

export default function SpectrePage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(SPECTRE_DEFAULTS);
  return (
    <GeneratorLayout
      title={t("generator.spectre.title")}
      controls={
        <GeneratorSettingsScaffold
          values={values}
          setValues={setValues}
          parameters={
            <SettingsRow>
              <NumberField
                values={values}
                setValues={setValues}
                name="iterations"
                label={t("generator.common.iterations")}
                min={1}
                max={8}
                placeholder={t("generator.spectre.autoIterationsValue")}
              />
              <NumberField values={values} setValues={setValues} name="scale" label={t("generator.common.scale")} min={1} max={120} />
            </SettingsRow>
          }
          centerStep="0.1"
          modes={
            <SettingsRow>
              <SelectField
                values={values}
                setValues={setValues}
                name="draw_mode"
                label={t("generator.spectre.drawMode")}
                options={[
                  { value: "generated", label: t("generator.spectre.drawModeBuild") },
                  { value: "translation", label: t("generator.spectre.drawModeTranslation") }
                ]}
              />
              <SelectField
                values={values}
                setValues={setValues}
                name="shape"
                label={t("generator.spectre.shape")}
                options={[
                  { value: "straight", label: t("generator.spectre.shapeStraight") },
                  { value: "curved", label: t("generator.spectre.shapeCurved") }
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
      payload={() => {
        const iterationValue = String(values.iterations).trim();
        return {
          width: Number(values.width),
          height: Number(values.height),
          iterations: iterationValue ? Number(iterationValue) : 1,
          auto_iterations: !iterationValue,
          scale: Number(values.scale),
          center_x: Number(values.center_x),
          center_y: Number(values.center_y),
          format: values.format,
          draw_mode: values.draw_mode,
          shape: values.shape,
          background: values.background,
          outline: values.outline,
          stroke_width: Number(values.stroke_width),
          palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
            .map((value) => String(value).trim())
            .filter(Boolean)
        };
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
