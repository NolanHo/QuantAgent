import { memo, useState, type JSX } from "react";
import {
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  Slider,
  Surface,
  Switch,
  TextField,
} from "@heroui/react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import {
  fieldConstraintCopies,
  splitArrayPreview,
} from "../lib/model";
import type { PluginConfigFieldDefinition } from "../types";
import { PluginConfigJsonCodeEditor } from "./field-controls/PluginConfigJsonCodeEditor";
import { PluginConfigNumericSliderField } from "./field-controls/PluginConfigNumericSliderField";
import { PluginConfigSupportedArrayField } from "./field-controls/PluginConfigSupportedArrayField";

type PluginConfigFieldProps = {
  definition: PluginConfigFieldDefinition;
  isCompactLayout?: boolean;
  isInlineRow?: boolean;
  isReadOnly?: boolean;
  issue?: string;
  onChange: (path: string, nextValue: string) => void;
  value: string;
};

type FieldOption = {
  id: string;
  label: string;
};

const sliderWrapClassName =
  "grid gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-3";
const switchWrapClassName =
  "rounded-[16px] border border-slate-200 bg-slate-50/80 px-3 py-3";

type NumericRangeConfig = {
  max: number;
  min: number;
  step: number;
};

function renderSelectInput({
  definition,
  onChange,
  options,
  value,
}: Pick<PluginConfigFieldProps, "definition" | "onChange" | "value"> & {
  options: FieldOption[];
}): JSX.Element {
  return (
    <Select<FieldOption>
      aria-label={definition.label}
      className="w-full"
      fullWidth
      onSelectionChange={(key) => {
        onChange(definition.path, key === null ? "" : String(key));
      }}
      selectedKey={value || null}
      variant="primary"
    >
      <Select.Trigger>
        <Select.Value>{value || "请选择"}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox<FieldOption> items={options}>
          {(option) => (
            <ListBox.Item id={option.id}>{option.label}</ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function renderFieldInput({
  definition,
  isSensitiveVisible = false,
  onToggleSensitiveVisibility,
  onChange,
  value,
}: Pick<PluginConfigFieldProps, "definition" | "onChange" | "value"> & {
  isSensitiveVisible?: boolean;
  onToggleSensitiveVisibility?: () => void;
}): JSX.Element {
  const numericRange = inferNumericRange(definition);
  const shouldStretchFieldInput = definition.path === "auth.tokenEndpoint";

  if (
    definition.type === "record" ||
    definition.type === "union" ||
    (definition.type === "array" && definition.support === "degraded")
  ) {
    return (
      <PluginConfigJsonCodeEditor
        definition={definition}
        onChange={onChange}
        value={value}
      />
    );
  }

  if (definition.type === "boolean") {
    return (
      <Switch
        aria-label={definition.label}
        isSelected={value === "true"}
        onChange={(isSelected) => {
          onChange(definition.path, isSelected ? "true" : "false");
        }}
        size="sm"
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Content>
          {value === "true" ? "已开启" : "已关闭"}
        </Switch.Content>
      </Switch>
    );
  }

  if (
    (definition.type === "integer" || definition.type === "number") &&
    numericRange
  ) {
    return (
      <PluginConfigNumericSliderField
        definition={definition}
        numericRange={numericRange}
        onChange={onChange}
        value={value}
      />
    );
  }

  if (definition.enumValues && definition.enumValues.length > 0) {
    return renderSelectInput({
      definition,
      onChange,
      value,
      options: definition.enumValues.map((option) => ({
        id: option,
        label: option,
      })),
    });
  }

  if (definition.type === "array" && definition.support === "supported") {
    return (
      <PluginConfigSupportedArrayField
        definition={definition}
        onChange={onChange}
        value={value}
      />
    );
  }

  if (definition.sensitive) {
    return (
      <InputGroup.Root className="w-full" fullWidth variant="primary">
        <InputGroup.Input
          autoComplete="new-password"
          aria-label={definition.label}
          onChange={(event) => {
            onChange(definition.path, event.target.value);
          }}
          placeholder={definition.placeholder ?? definition.examples?.[0] ?? ""}
          type={isSensitiveVisible ? "text" : "password"}
          value={value}
        />
        <InputGroup.Suffix>
          <Button
            aria-label={isSensitiveVisible ? "隐藏敏感值" : "显示敏感值"}
            isIconOnly
            onPress={() => {
              onToggleSensitiveVisibility?.();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isSensitiveVisible ? (
              <FiEyeOff aria-hidden="true" className="text-[15px]" />
            ) : (
              <FiEye aria-hidden="true" className="text-[15px]" />
            )}
          </Button>
        </InputGroup.Suffix>
      </InputGroup.Root>
    );
  }

  return (
    <Input
      autoComplete={undefined}
      aria-label={definition.label}
      className="w-full"
      fullWidth
      onChange={(event) => {
        onChange(definition.path, event.target.value);
      }}
      placeholder={definition.placeholder ?? definition.examples?.[0] ?? ""}
      style={
        shouldStretchFieldInput
          ? {
              display: "block",
              minWidth: "100%",
              width: "100%",
            }
          : undefined
      }
      type="text"
      value={value}
      variant="primary"
    />
  );
}

function PluginConfigFieldComponent({
  definition,
  isCompactLayout = false,
  isInlineRow = false,
  isReadOnly = false,
  issue,
  onChange,
  value,
}: PluginConfigFieldProps) {
  const [isSensitiveVisible, setIsSensitiveVisible] = useState(false);
  const constraintCopies = fieldConstraintCopies(definition);
  const requirementCopy =
    definition.required && value.trim().length > 0
      ? null
      : definition.required
        ? "必填"
        : "可选";
  const isActuallyReadOnly = isReadOnly || Boolean(definition.readOnly);
  const supportColor =
    definition.support === "supported"
      ? "success"
      : definition.support === "degraded"
        ? "warning"
        : "danger";
  const prefersExpandedInlineEditor = definition.path === "auth.tokenEndpoint";
  const prefersWideEditor =
    prefersExpandedInlineEditor ||
    definition.type === "record" ||
    definition.type === "union" ||
    definition.type === "array";
  const fieldRowClassName = [
    "w-full border-b border-slate-200 py-3 last:border-b-0",
    isInlineRow
      ? prefersWideEditor || isCompactLayout
        ? "grid gap-3"
        : "grid gap-3 md:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] md:items-start md:gap-6"
      : "grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm",
  ].join(" ");
  const fieldControlWrapClassName = [
    "grid w-full min-w-0 gap-2.5 overflow-visible pt-0.5",
    isInlineRow && !prefersWideEditor && !isCompactLayout
      ? "md:w-full"
      : "",
  ].join(" ");
  const shouldStretchFieldInput = prefersExpandedInlineEditor;
  const fieldMeta = (
    <div className="grid min-w-0 gap-1.5 pt-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <Label>{definition.label}</Label>
        <div className="flex flex-wrap gap-1.5">
          {requirementCopy ? (
            <Chip
              color={definition.required ? "danger" : "success"}
              size="sm"
              variant="soft"
            >
              {requirementCopy}
            </Chip>
          ) : null}
          {definition.support !== "supported" ? (
            <Chip color={supportColor} size="sm" variant="soft">
              {definition.support === "degraded" ? "降级承接" : "暂不支持"}
            </Chip>
          ) : null}
          {definition.sensitive ? (
            <Chip color="warning" size="sm" variant="soft">
              敏感字段
            </Chip>
          ) : null}
          {definition.readOnly ? (
            <Chip color="default" size="sm" variant="soft">
              系统字段
            </Chip>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        {definition.description ? (
          <Description>{definition.description}</Description>
        ) : null}
        {constraintCopies.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {constraintCopies.map((copy) => (
              <Chip key={copy} color="accent" size="sm" variant="secondary">
                {copy}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
  const fieldNotes = (
    <div className="grid gap-1.5">
      {issue ? (
        <FieldError>{issue}</FieldError>
      ) : null}
    </div>
  );

  if (isActuallyReadOnly) {
    const readOnlyNumericRange = inferNumericRange(definition);

    return (
      <div className={fieldRowClassName}>
        {fieldMeta}
        <div className={fieldControlWrapClassName}>
          {definition.type === "boolean" ? (
            <div className={switchWrapClassName}>
              <Switch
                aria-label={definition.label}
                isDisabled
                isSelected={value === "true"}
                size="sm"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  {value === "true" ? "已开启" : "已关闭"}
                </Switch.Content>
              </Switch>
            </div>
          ) : readOnlyNumericRange ? (
            <div className={sliderWrapClassName}>
              <Slider
                aria-label={`${definition.label} 滑块`}
                isDisabled
                maxValue={readOnlyNumericRange.max}
                minValue={readOnlyNumericRange.min}
                step={readOnlyNumericRange.step}
                value={coerceSliderValue(value, readOnlyNumericRange)}
              >
                <Slider.Output />
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
              <Input
                aria-label={definition.label}
                className="w-full"
                fullWidth
                readOnly
                type="text"
                value={value}
                variant="primary"
              />
            </div>
          ) : definition.sensitive ? (
            <div className="flex min-w-0 items-center justify-between gap-2.5 rounded-full border border-slate-200 bg-slate-50/95 px-3 py-2.5">
              <span
                className={[
                  "min-w-0 truncate text-[13px] text-slate-900 transition-[filter] duration-150",
                  isSensitiveVisible ? "blur-0" : "blur-[4px]",
                ].join(" ")}
              >
                {readOnlyValueCopy(definition, value, isSensitiveVisible)}
              </span>
              <Button
                aria-label={isSensitiveVisible ? "隐藏敏感值" : "显示敏感值"}
                isIconOnly
                onPress={() => {
                  setIsSensitiveVisible((current) => !current);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {isSensitiveVisible ? (
                  <FiEyeOff aria-hidden="true" className="text-[15px]" />
                ) : (
                  <FiEye aria-hidden="true" className="text-[15px]" />
                )}
              </Button>
            </div>
          ) : (
            <Surface className="rounded-[18px]" variant="secondary">
              <div className="p-3">
                <p className="m-0 overflow-hidden text-xs leading-6 text-slate-500 [overflow-wrap:anywhere]">
                  {readOnlyValueCopy(definition, value, isSensitiveVisible)}
                </p>
              </div>
            </Surface>
          )}
          {fieldNotes}
        </div>
      </div>
    );
  }

  if (definition.type === "array" && definition.support === "supported") {
    return (
      <div className={fieldRowClassName}>
        {fieldMeta}
        <div className={fieldControlWrapClassName}>
          {renderFieldInput({
            definition,
            value,
            onChange,
            isSensitiveVisible,
            onToggleSensitiveVisibility: () => {
              setIsSensitiveVisible((current) => !current);
            },
          })}
          {fieldNotes}
        </div>
      </div>
    );
  }

  return (
    <div className={fieldRowClassName}>
      <TextField
        className="grid w-full min-w-0 gap-2.5"
        fullWidth={shouldStretchFieldInput}
        isInvalid={Boolean(issue)}
        isRequired={definition.required}
      >
        {fieldMeta}
        <div className={fieldControlWrapClassName}>
          {renderFieldInput({
            definition,
            value,
            onChange,
            isSensitiveVisible,
            onToggleSensitiveVisibility: () => {
              setIsSensitiveVisible((current) => !current);
            },
          })}
        </div>
        {fieldNotes}
      </TextField>
    </div>
  );
}

export const PluginConfigField = memo(
  PluginConfigFieldComponent,
  (previous, next) =>
    previous.definition === next.definition &&
    previous.isCompactLayout === next.isCompactLayout &&
    previous.isInlineRow === next.isInlineRow &&
    previous.isReadOnly === next.isReadOnly &&
    previous.issue === next.issue &&
    previous.value === next.value &&
    previous.onChange === next.onChange,
);

function readOnlyValueCopy(
  definition: PluginConfigFieldDefinition,
  value: string,
  isSensitiveVisible: boolean,
) {
  if (value.trim().length === 0) {
    return "未配置";
  }

  if (definition.sensitive) {
    return isSensitiveVisible ? value : "••••••••";
  }

  if (definition.type === "array" && definition.support === "supported") {
    return splitArrayPreview(value).join(" / ");
  }

  return value;
}

function inferNumericRange(
  definition: PluginConfigFieldDefinition,
): NumericRangeConfig | null {
  if (definition.type !== "integer" && definition.type !== "number") {
    return null;
  }

  const minimum = definition.constraints?.minimum;
  const maximum = definition.constraints?.maximum;

  if (minimum === undefined || maximum === undefined) {
    return null;
  }

  return {
    min: minimum,
    max: maximum,
    step: inferNumericStep(definition, minimum, maximum),
  };
}

function inferNumericStep(
  definition: PluginConfigFieldDefinition,
  minimum: number,
  maximum: number,
): number {
  if (definition.type === "integer") {
    return 1;
  }

  const decimals = Math.max(
    countDecimals(minimum),
    countDecimals(maximum),
    countDecimals(Number(definition.defaultValue ?? 0)),
  );

  if (decimals <= 0) {
    return 0.1;
  }

  return 10 ** -Math.min(decimals, 4);
}

function countDecimals(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value.toString().toLowerCase();

  if (normalized.includes("e-")) {
    const [, exponent] = normalized.split("e-");
    return Number(exponent);
  }

  const [, fraction = ""] = normalized.split(".");
  return fraction.length;
}
function coerceSliderValue(value: string, range: NumericRangeConfig): number {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return range.min;
  }

  if (numericValue < range.min) {
    return range.min;
  }

  if (numericValue > range.max) {
    return range.max;
  }

  return numericValue;
}
