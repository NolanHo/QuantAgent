import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface AgentChainStep {
  body?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  id: string;
  status?: "completed" | "error" | "pending" | "running";
  title: ReactNode;
}
