import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField, TextField } from "../../components/forms/FormFields";
import { apiUrl } from "../../lib/api";
import { EINSTEIN_DEFAULTS } from "./defaults";
import GeneratorLayout from "./GeneratorLayout";
import GeneratorSettingsScaffold, { SettingsRow } from "./GeneratorSettingsScaffold";

export default function EinsteinPage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(EINSTEIN_DEFAULTS);
  return (
    <GeneratorLayout
      title={t("generator.einstein.title")}
      controls={
        <GeneratorSettingsScaffold
          values={values}
          setValues={setValues}
          parameters={
            <SettingsRow>
              <NumberField values={values} setValues={setValues} name="iterations" label={t("generator.common.iterations")} min={1} max={6} />
              <NumberField values={values} setValues={setValues} name="scalar" label={t("generator.common.scalar")} min={1} max={80} />
            </SettingsRow>
          }
          centerStep="0.1"
          modes={
            <SettingsRow>
              <SelectField
                values={values}
                setValues={setValues}
                name="color_mode"
                label={t("generator.einstein.coloring")}
                options={[
                  { value: "families", label: t("generator.einstein.coloringFamilies") },
                  { value: "four_color", label: t("generator.einstein.coloringFourColor") }
                ]}
              />
              <TextField values={values} setValues={setValues} name="seed" label={t("generator.common.seed")} placeholder={t("generator.common.optional")} />
            </SettingsRow>
          }
          palette={
            values.color_mode === "families" ? (
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
          scalar: Number(values.scalar),
          width: Number(values.width),
          height: Number(values.height),
          center_x: Number(values.center_x),
          center_y: Number(values.center_y),
          format: values.format,
          color_mode: values.color_mode,
          colors: [values.color_h1, values.color_h, values.color_t, values.color_p, values.color_f],
          four_colors: [values.four_color_1, values.four_color_2, values.four_color_3, values.four_color_4],
          background: values.background,
          outline: values.outline,
          stroke_width: Number(values.stroke_width)
        };
        if (String(values.seed).trim()) {
          payload.seed = Number(values.seed);
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
  );
}
