import { useQuery } from "@tanstack/react-query";

import { useApis } from "@/app/runtime";

import { pluginDetailKeys } from "./plugin-detail.keys";

export function usePluginListQuery() {
  const { plugins } = useApis();

  return useQuery({
    queryFn: () => plugins.listPlugins(),
    queryKey: pluginDetailKeys.list(),
  });
}

export function usePluginDetailQuery(pluginId: string) {
  const { pluginDetail } = useApis();

  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => pluginDetail.getDetail(pluginId),
    queryKey: pluginDetailKeys.detail(pluginId),
  });
}

export function usePluginConfigViewQuery(pluginId: string) {
  const { pluginDetail } = useApis();

  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => pluginDetail.getConfig(pluginId),
    queryKey: pluginDetailKeys.config(pluginId),
  });
}

export function usePluginDependenciesViewQuery(pluginId: string) {
  const { pluginDetail } = useApis();

  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => pluginDetail.getDependencies(pluginId),
    queryKey: pluginDetailKeys.dependencies(pluginId),
  });
}

export function usePluginHealthViewQuery(pluginId: string) {
  const { pluginDetail } = useApis();

  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => pluginDetail.getHealth(pluginId),
    queryKey: pluginDetailKeys.health(pluginId),
  });
}

export function usePluginAuditViewQuery(pluginId: string) {
  const { pluginDetail } = useApis();

  return useQuery({
    enabled: pluginId.length > 0,
    queryFn: () => pluginDetail.getAudit(pluginId),
    queryKey: pluginDetailKeys.audit(pluginId),
  });
}
