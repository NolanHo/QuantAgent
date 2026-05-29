import {
  PluginConfigForm,
  type PluginConfigSchemaSnapshot,
  type PluginConfigValueMap,
} from "@/features/plugins/config-form";
import { Surface, Tabs } from "@heroui/react";

type PluginConfigDebugDrawerFormPanelProps = {
  issueLookup: Map<string, string>;
  saveMessage: string | null;
  schema: PluginConfigSchemaSnapshot | null;
  updateDraft: (path: string, nextValue: string) => void;
  values: PluginConfigValueMap;
};

export function PluginConfigDebugDrawerFormPanel({
  issueLookup,
  saveMessage,
  schema,
  updateDraft,
  values,
}: PluginConfigDebugDrawerFormPanelProps) {
  return (
    <Tabs.Panel id="form" className="min-h-0 overflow-y-auto">
      <div className="grid gap-3.5 px-3.5 py-4 pb-6">
        {saveMessage ? (
          <Surface className="rounded-[22px]" variant="secondary">
            <div className="p-4">
              <p className="m-0 text-sm leading-6 text-slate-600">
                {saveMessage}
              </p>
            </div>
          </Surface>
        ) : null}

        {schema ? (
          <PluginConfigForm
            issueLookup={issueLookup}
            onValueChange={updateDraft}
            schema={schema}
            showSupportMatrix={false}
            values={values}
          />
        ) : null}
      </div>
    </Tabs.Panel>
  );
}
