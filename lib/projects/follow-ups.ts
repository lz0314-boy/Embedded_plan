import type { ContentRecord } from "@/lib/content/schema";
import type { ProjectCase } from "@/lib/domain/types";

export type ProjectFollowUp = {
  id: string;
  prompt: string;
  reason: string;
  linkedContentIds: string[];
};

const fieldTemplates = [
  { id: "context", field: "context", prompt: "请说明这个项目解决了什么问题，使用场景和边界是什么？", reason: "项目背景" },
  { id: "role", field: "role", prompt: "你在这个项目中承担了哪些职责？哪些决策由你负责？", reason: "职责边界" },
  { id: "goals", field: "goals", prompt: "项目的目标和可观察的成功标准是什么？", reason: "目标与标准" },
  { id: "constraints", field: "constraints", prompt: "项目有哪些资源、实时性、可靠性或交付约束？你如何取舍？", reason: "约束与取舍" },
  { id: "actions", field: "actions", prompt: "请按时间顺序讲一个关键技术决策：你比较了哪些方案，最后为什么这样实现？", reason: "关键行动" },
  { id: "results", field: "results", prompt: "你如何验证结果？有哪些可复现的指标、日志、测试或失败案例？", reason: "结果与证据" },
  { id: "lessons", field: "lessons", prompt: "如果重新做一次，你会改变什么？这个改变依据什么证据？", reason: "复盘与改进" },
] as const;

export function buildProjectFollowUps(project: ProjectCase, catalog: Pick<ContentRecord, "id" | "title">[]): ProjectFollowUp[] {
  const followUps = fieldTemplates.map((template) => ({
    id: `field:${template.id}`,
    prompt: template.prompt,
    reason: project[template.field].trim() ? template.reason : `${template.reason}（尚未填写）`,
    linkedContentIds: [],
  }));
  const linked = project.knowledgeLinks
    .map((id) => catalog.find((item) => item.id === id))
    .filter((item): item is ContentRecord => Boolean(item));
  return [
    ...followUps,
    ...linked.map((item) => ({
      id: `knowledge:${item.id}`,
      prompt: `结合“${item.title}”，说明它在这个项目中的适用边界、验证方法和一个可能的反例。`,
      reason: `关联知识点：${item.title}`,
      linkedContentIds: [item.id],
    })),
  ];
}

export function emptyProjectCase(now: string, id = crypto.randomUUID()): ProjectCase {
  return {
    id,
    title: "",
    context: "",
    role: "",
    goals: "",
    constraints: "",
    actions: "",
    results: "",
    lessons: "",
    technologies: [],
    knowledgeLinks: [],
    syncEnabled: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}
