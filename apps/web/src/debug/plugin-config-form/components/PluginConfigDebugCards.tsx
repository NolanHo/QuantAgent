import { memo } from "react";
import { Button, Card, Chip } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { FiCheckCircle, FiSettings } from "react-icons/fi";

import type { PluginRecord } from "../model";

const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

type PluginConfigDebugCardsProps = {
  currentStatusTitle: string;
  highlightedPluginId: string | null;
  onOpenPlugin: (pluginId: string) => void;
  onSelectPlugin: (pluginId: string) => void;
  plugins: PluginRecord[];
  statusTone: "accent" | "danger" | "success";
};

function PluginConfigDebugCardsComponent({
  currentStatusTitle,
  highlightedPluginId,
  onOpenPlugin,
  onSelectPlugin,
  plugins,
  statusTone,
}: PluginConfigDebugCardsProps) {
  const prefersReducedMotion = useReducedMotion();
  const staggeredTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: MOTION_EASE };

  return (
    <section className="grid gap-5">
      <div className="grid gap-2">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          全局插件
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="m-0 text-2xl font-black tracking-tight text-slate-950">
              插件管理
            </h1>
            <p className="m-0 max-w-3xl text-sm leading-6 text-slate-500">
              第一层只展示全局插件卡片。点击“设置”后打开一个右侧抽屉，左侧编辑配置，右侧固定查看
              JSON 结果。
            </p>
          </div>
          <Chip color={statusTone} size="sm" variant="soft">
            {currentStatusTitle}
          </Chip>
        </div>
      </div>

      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        aria-label="全局插件列表"
      >
        {plugins.map((plugin, index) => {
          const isSelected = plugin.id === highlightedPluginId;

          return (
            <motion.div
              key={plugin.id}
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
              layout
              transition={{
                ...staggeredTransition,
                delay: prefersReducedMotion ? 0 : index * 0.04,
              }}
            >
              <Card>
                <Card.Header>
                  <div className="grid w-full gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <Card.Title>{plugin.name}</Card.Title>
                        <Card.Description>
                          {plugin.source === "official"
                            ? "官方插件样例"
                            : "本地运行时插件"}
                        </Card.Description>
                      </div>
                      {isSelected ? (
                        <Chip color="accent" size="sm" variant="soft">
                          当前样例
                        </Chip>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip color="default" size="sm" variant="soft">
                        {plugin.status}
                      </Chip>
                      <Chip color="accent" size="sm" variant="secondary">
                        插件设置
                      </Chip>
                    </div>
                  </div>
                </Card.Header>
                <Card.Content>
                  <div className="grid gap-4">
                    <p className="m-0 text-sm leading-6 text-slate-500">
                      用于验证 schema-driven form、敏感字段掩码和 JSON
                      结果预览，不进入正式
                      <code> /plugins </code>流程。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        aria-label={`设置 ${plugin.name}`}
                        isIconOnly
                        onPress={() => {
                          onOpenPlugin(plugin.id);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <FiSettings
                          aria-hidden="true"
                          className="text-[14px]"
                        />
                      </Button>
                      <Button
                        aria-label={`设为当前样例 ${plugin.name}`}
                        isIconOnly
                        onPress={() => {
                          onSelectPlugin(plugin.id);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <FiCheckCircle
                          aria-hidden="true"
                          className="text-[14px]"
                        />
                      </Button>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            </motion.div>
          );
        })}
      </section>
    </section>
  );
}

export const PluginConfigDebugCards = memo(
  PluginConfigDebugCardsComponent,
  (previous, next) =>
    previous.currentStatusTitle === next.currentStatusTitle &&
    previous.highlightedPluginId === next.highlightedPluginId &&
    previous.onOpenPlugin === next.onOpenPlugin &&
    previous.onSelectPlugin === next.onSelectPlugin &&
    previous.plugins === next.plugins &&
    previous.statusTone === next.statusTone,
);
