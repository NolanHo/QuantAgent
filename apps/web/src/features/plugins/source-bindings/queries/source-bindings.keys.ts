import type { SourceBindingListParams } from "../api/source-bindings.contracts";

export const sourceBindingKeys = {
  all: ["plugins", "source-bindings"] as const,
  list: (params: SourceBindingListParams) =>
    [
      ...sourceBindingKeys.all,
      "list",
      params.ownerType ?? null,
      params.ownerId ?? null,
      params.sourcePluginId ?? null,
      params.status ?? null,
      params.limit ?? 50,
    ] as const,
};
