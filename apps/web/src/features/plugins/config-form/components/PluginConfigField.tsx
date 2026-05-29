import { EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { basicSetup, EditorView } from "codemirror";
import { memo, useEffect, useMemo, useRef, useState, type JSX } from "react";
import {
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Popover,
  Select,
  Slider,
  Surface,
  Switch,
  TextField,
} from "@heroui/react";
import { FiEye, FiEyeOff, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  fieldConstraintCopies,
  joinArrayDraftValue,
  splitArrayDraftItems,
  splitArrayPreview,
} from "../lib/model";
import type { PluginConfigFieldDefinition } from "../types";

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

const arrayItemCardClassName =
  "grid gap-3 rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm";
const arrayEmptyToolbarClassName = "flex items-center justify-end";
const sliderWrapClassName =
  "grid gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-3";
const switchWrapClassName =
  "rounded-[16px] border border-slate-200 bg-slate-50/80 px-3 py-3";
const codeEditorWrapClassName =
  "overflow-hidden rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm";

type NumericRangeConfig = {
  max: number;
  min: number;
  step: number;
};

type ArrayPreviewPopoverProps = {
  actionLabel: string;
  addLabel: string;
  description: string;
  emptyActionLabel: string;
  onAddEmpty: () => void;
  onSelectOption: (option: string) => void;
  options: string[];
};

type JsonCodeEditorProps = Pick<
  PluginConfigFieldProps,
  "definition" | "onChange" | "value"
>;

type NumericSliderFieldProps = {
  definition: PluginConfigFieldDefinition;
  numericRange: NumericRangeConfig;
  onChange: (path: string, nextValue: string) => void;
  value: string;
};

type SupportedArrayFieldProps = {
  definition: PluginConfigFieldDefinition;
  onChange: (path: string, nextValue: string) => void;
  value: string;
};

function NumericSliderField({
  definition,
  numericRange,
  onChange,
  value,
}: NumericSliderFieldProps) {
  const [inputDraftValue, setInputDraftValue] = useState(value);
  const [sliderInstanceKey, setSliderInstanceKey] = useState(() =>
    `${definition.path}:${value}`,
  );
  const committedSliderValue = coerceSliderValue(value, numericRange);

  useEffect(() => {
    setInputDraftValue(value);
    setSliderInstanceKey(`${definition.path}:${value}`);
  }, [committedSliderValue, definition.path, value]);

  return (
    <div className={sliderWrapClassName}>
      <Slider
        aria-label={`${definition.label} 滑块`}
        defaultValue={committedSliderValue}
        key={sliderInstanceKey}
        maxValue={numericRange.max}
        minValue={numericRange.min}
        onChange={(nextValue) => {
          // 保持 Slider 非受控，让 HeroUI 内部状态处理拖拽，避免受控回流打断动画帧。
          setInputDraftValue(
            formatSliderValue(
              definition,
              Number(nextValue),
              numericRange.step,
            ),
          );
        }}
        onChangeEnd={(nextValue) => {
          const nextNumericValue = Number(nextValue);
          const nextFormattedValue = formatSliderValue(
            definition,
            nextNumericValue,
            numericRange.step,
          );
          setInputDraftValue(nextFormattedValue);
          onChange(
            definition.path,
            nextFormattedValue,
          );
        }}
        step={numericRange.step}
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
        inputMode={definition.type === "integer" ? "numeric" : "decimal"}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputDraftValue(nextValue);
          onChange(definition.path, nextValue);
        }}
        placeholder={
          definition.placeholder ??
          `${numericRange.min} - ${numericRange.max}`
        }
        type="text"
        value={inputDraftValue}
        variant="primary"
      />
    </div>
  );
}

function JsonCodeEditor({
  definition,
  onChange,
  value,
}: JsonCodeEditorProps) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isApplyingExternalUpdateRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorHostRef.current) {
      return;
    }

    const view = new EditorView({
      parent: editorHostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          json(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": definition.label,
            spellcheck: "false",
          }),
          EditorView.theme({
            "&": {
              backgroundColor: "transparent",
              fontSize: "12px",
              minHeight: "168px",
            },
            ".cm-scroller": {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              lineHeight: "1.5rem",
              minHeight: "168px",
              overflow: "auto",
            },
            ".cm-content": {
              minHeight: "168px",
              padding: "1rem",
              caretColor: "#0f172a",
              color: "#0f172a",
            },
            ".cm-focused": {
              outline: "none",
            },
            ".cm-activeLine": {
              backgroundColor: "rgba(148, 163, 184, 0.10)",
            },
            ".cm-selectionBackground, ::selection": {
              backgroundColor: "rgba(59, 130, 246, 0.18)",
            },
            ".cm-gutters": {
              display: "none",
            },
            ".cm-line": {
              color: "#0f172a",
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || isApplyingExternalUpdateRef.current) {
              return;
            }

            onChangeRef.current(
              definition.path,
              update.state.doc.toString(),
            );
          }),
        ],
      }),
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [definition.label, definition.path]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();

    if (currentValue === value) {
      return;
    }

    isApplyingExternalUpdateRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
    isApplyingExternalUpdateRef.current = false;
  }, [value]);

  return (
    <div className={codeEditorWrapClassName}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          JSON
        </span>
      </div>
      <div ref={editorHostRef} className="min-h-[168px]" />
    </div>
  );
}

function ArrayPreviewPopover({
  actionLabel,
  addLabel,
  description,
  emptyActionLabel,
  onAddEmpty,
  onSelectOption,
  options,
}: ArrayPreviewPopoverProps) {
  if (options.length === 0) {
    return (
      <Button
        aria-label={actionLabel}
        isIconOnly
        onPress={onAddEmpty}
        size="sm"
        type="button"
        variant="ghost"
      >
        <FiPlus aria-hidden="true" className="text-[14px]" />
      </Button>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button
          aria-label={actionLabel}
          isIconOnly
          size="sm"
          type="button"
          variant="ghost"
        >
          <FiPlus aria-hidden="true" className="text-[14px]" />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-[260px] p-0" placement="top end">
        <Popover.Dialog className="grid gap-2 p-3">
          <div className="grid gap-0.5 px-1">
            <Popover.Heading className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
              快捷添加
            </Popover.Heading>
            <p className="m-0 text-xs leading-5 text-slate-500">
              {description}
            </p>
          </div>
          <div className="grid gap-1">
            <Button
              aria-label={emptyActionLabel}
              fullWidth
              onPress={onAddEmpty}
              size="sm"
              type="button"
              variant="ghost"
            >
              <span className="flex w-full items-center justify-between">
                <span>添加空白项</span>
                <FiPlus aria-hidden="true" className="text-[13px] text-slate-400" />
              </span>
            </Button>
            {options.map((option) => (
              <Button
                key={option}
                aria-label={`${addLabel} ${option}`}
                fullWidth
                onPress={() => {
                  onSelectOption(option);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <span className="flex w-full items-center justify-between">
                  <span>{option}</span>
                  <FiPlus aria-hidden="true" className="text-[13px] text-sky-500" />
                </span>
              </Button>
            ))}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

const MemoizedArrayPreviewPopover = memo(
  ArrayPreviewPopover,
  (previous, next) =>
    previous.actionLabel === next.actionLabel &&
    previous.addLabel === next.addLabel &&
    previous.description === next.description &&
    previous.emptyActionLabel === next.emptyActionLabel &&
    previous.onAddEmpty === next.onAddEmpty &&
    previous.onSelectOption === next.onSelectOption &&
    previous.options === next.options,
);

function SupportedArrayField({
  definition,
  onChange,
  value,
}: SupportedArrayFieldProps) {
  const items = useMemo(() => splitArrayDraftItems(value), [value]);
  const selectedItems = useMemo(
    () => items.filter((item: string) => item.trim().length > 0),
    [items],
  );
  const availableChoices = definition.choiceOptions ?? [];
  const previewChoices = useMemo(
    () =>
      availableChoices.filter((option) => !selectedItems.includes(option)),
    [availableChoices, selectedItems],
  );

  return (
    <div className="grid min-w-0 gap-2.5">
      {items.map((itemValue: string, index: number) => (
        <SupportedArrayItem
          key={`${definition.path}-${index}`}
          definition={definition}
          index={index}
          itemValue={itemValue}
          items={items}
          onChange={onChange}
          previewChoices={previewChoices}
        />
      ))}
      {items.length === 0 ? (
        <div className={arrayEmptyToolbarClassName}>
          <MemoizedArrayPreviewPopover
            actionLabel={`添加 ${definition.label} 项`}
            addLabel="添加推荐项"
            description="选择推荐项后，直接作为第一项写入。"
            emptyActionLabel={`添加 ${definition.label} 空白项`}
            onAddEmpty={() => {
              onChange(definition.path, joinArrayDraftValue([""]));
            }}
            onSelectOption={(option) => {
              onChange(definition.path, joinArrayDraftValue([option]));
            }}
            options={previewChoices}
          />
        </div>
      ) : null}
    </div>
  );
}

type SupportedArrayItemProps = {
  definition: PluginConfigFieldDefinition;
  index: number;
  itemValue: string;
  items: string[];
  onChange: (path: string, nextValue: string) => void;
  previewChoices: string[];
};

const SupportedArrayItem = memo(function SupportedArrayItem({
  definition,
  index,
  itemValue,
  items,
  onChange,
  previewChoices,
}: SupportedArrayItemProps) {
  return (
    <div
      className={arrayItemCardClassName}
    >
      <Input
        aria-label={`${definition.label} 第 ${index + 1} 项`}
        autoComplete={undefined}
        className="w-full"
        fullWidth
        onChange={(event) => {
          const nextItems = [...items];
          nextItems[index] = event.target.value;
          onChange(definition.path, joinArrayDraftValue(nextItems));
        }}
        placeholder={
          definition.placeholder ??
          definition.examples?.[0] ??
          `请输入第 ${index + 1} 项`
        }
        type="text"
        value={itemValue}
        variant="primary"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
          第 {index + 1} 项
        </span>
        <div className="flex items-center gap-2">
          <MemoizedArrayPreviewPopover
            actionLabel={`在 ${definition.label} 第 ${index + 1} 项后添加`}
            addLabel={`在 ${definition.label} 第 ${index + 1} 项后添加推荐项`}
            description="选择推荐项后，直接插入到当前项后面。"
            emptyActionLabel={`在 ${definition.label} 第 ${index + 1} 项后添加空白项`}
            onAddEmpty={() => {
              const nextItems = [...items];
              nextItems.splice(index + 1, 0, "");
              onChange(definition.path, joinArrayDraftValue(nextItems));
            }}
            onSelectOption={(option) => {
              const nextItems = [...items];
              nextItems.splice(index + 1, 0, option);
              onChange(definition.path, joinArrayDraftValue(nextItems));
            }}
            options={previewChoices}
          />
          <Button
            aria-label={`移除 ${definition.label} 第 ${index + 1} 项`}
            isIconOnly
            onPress={() => {
              const nextItems = items.filter(
                (_, itemIndex) => itemIndex !== index,
              );
              onChange(definition.path, joinArrayDraftValue(nextItems));
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <FiTrash2 aria-hidden="true" className="text-[14px]" />
          </Button>
        </div>
      </div>
    </div>
  );
});

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
    return <JsonCodeEditor definition={definition} onChange={onChange} value={value} />;
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
      <NumericSliderField
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
      <SupportedArrayField
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

function formatSliderValue(
  definition: PluginConfigFieldDefinition,
  value: number,
  step: number,
): string {
  if (definition.type === "integer") {
    return String(Math.round(value));
  }

  const decimals = countDecimals(step);
  return value.toFixed(decimals);
}
