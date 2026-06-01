import { useQuery } from "@tanstack/react-query";

import { useApis } from "@/app/runtime";

import type { SourceBindingListParams } from "../api/source-bindings.contracts";
import { sourceBindingKeys } from "./source-bindings.keys";

export function useSourceBindingsQuery(params: SourceBindingListParams, enabled = true) {
  const { sourceBindings } = useApis();

  return useQuery({
    enabled,
    queryFn: () => sourceBindings.listBindings(params),
    queryKey: sourceBindingKeys.list(params),
  });
}
