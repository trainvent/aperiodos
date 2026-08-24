import { useTranslation } from "react-i18next";

import { ColorField, NumberField, SelectField } from "../../components/forms/FormFields";

export function SettingsRow({ children }) {
  return <div className="field-pair full">{children}</div>;
}

export default function GeneratorSettingsScaffold({
  values,
  setValues,
  parameters,
  centerStep,
  allowSvg = true,
  allowMaterial = false,
  patternOptions,
  modes,
  palette
}) {
  const { t } = useTranslation("common");
  const formatOptions = [
    ...(allowSvg ? [{ value: "svg", label: "SVG" }] : []),
    { value: "png", label: "PNG" },
    { value: "jpg", label: "JPG" }
  ];

  return (
    <>
      <SettingsRow>
        <NumberField values={values} setValues={setValues} name="width" label={t("generator.common.width")} min={64} max={6000} />
        <NumberField values={values} setValues={setValues} name="height" label={t("generator.common.height")} min={64} max={6000} />
      </SettingsRow>
      {parameters}
      {centerStep ? (
        <SettingsRow>
          <NumberField values={values} setValues={setValues} name="center_x" label={t("generator.common.centerX")} step={centerStep} />
          <NumberField values={values} setValues={setValues} name="center_y" label={t("generator.common.centerY")} step={centerStep} />
        </SettingsRow>
      ) : null}
      <SettingsRow>
        <SelectField
          values={values}
          setValues={setValues}
          name="format"
          label={t("generator.common.format")}
          options={formatOptions}
        />
        <NumberField
          values={values}
          setValues={setValues}
          name="stroke_width"
          label={t("generator.common.strokeWidth")}
          min={0}
          max={20}
          step="0.1"
        />
      </SettingsRow>
      {allowMaterial ? (
        <SettingsRow>
          <SelectField
            values={values}
            setValues={setValues}
            name="material_mode"
            label={t("generator.material.label")}
            options={[
              { value: "solid", label: t("generator.material.solid") },
              { value: "pattern", label: t("generator.material.pattern") }
            ]}
          />
          {values.material_mode === "pattern" ? (
            <SelectField
              values={values}
              setValues={setValues}
              name="pattern_design"
              label={t("generator.material.patternLabel")}
              options={patternOptions || [{ value: "builtin:curves", label: t("generator.material.curves") }]}
            />
          ) : null}
        </SettingsRow>
      ) : null}
      {modes}
      <SettingsRow>
        <ColorField
          values={values}
          setValues={setValues}
          name="background"
          label={t("generator.common.background")}
        />
        <ColorField
          values={values}
          setValues={setValues}
          name="outline"
          label={t("generator.common.outline")}
        />
      </SettingsRow>
      <div className="swatches full">
        {allowMaterial && values.material_mode === "pattern" ? (
          <>
            <ColorField
              values={values}
              setValues={setValues}
              name="pattern_base"
              label={t("generator.material.tileColor")}
            />
            <ColorField
              values={values}
              setValues={setValues}
              name="pattern_color"
              label={t("generator.material.curveColor")}
            />
          </>
        ) : palette}
      </div>
    </>
  );
}
