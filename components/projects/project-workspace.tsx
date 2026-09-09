"use client";

import { useEffect, useMemo, useState } from "react";
import { contentCatalog } from "@/lib/content/catalog";
import { db, nowIso } from "@/lib/db/database";
import type { ProjectCase } from "@/lib/domain/types";
import { buildProjectFollowUps, emptyProjectCase } from "@/lib/projects/follow-ups";
import { saveProjectCase } from "@/lib/sync/repository";

const editableFields = [
  ["context", "项目背景与问题", "它解决什么问题？使用场景和边界是什么？"],
  ["role", "我的职责", "只写自己实际负责的工作，不用职位名称代替证据。"],
  ["goals", "目标与成功标准", "写可观察、可验证的目标；没有数据时明确记录待补证据。"],
  ["constraints", "约束与取舍", "记录资源、实时性、可靠性、兼容性或交付约束。"],
  ["actions", "关键行动与决策", "按时间顺序写方案比较、实现动作和关键决策。"],
  ["results", "结果与验证证据", "写测试、日志、指标、失败案例或尚未完成的验证。"],
  ["lessons", "复盘与下一步", "记录真实教训、遗留风险和如果重做会改变的地方。"],
] as const;
const knowledgeCandidates = contentCatalog.filter((item) => item.type === "lesson");

type TextField = (typeof editableFields)[number][0];

function csvToList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function listToCsv(value: string[]) {
  return value.join(", ");
}

export function ProjectWorkspace() {
  const [projects, setProjects] = useState<ProjectCase[]>([]);
  const [draft, setDraft] = useState<ProjectCase>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void db.projectCases.orderBy("updatedAt").reverse().toArray().then((values) => {
      if (!active) return;
      const visible = values.filter((value) => !value.deletedAt);
      setProjects(visible);
      setDraft(visible[0] ?? emptyProjectCase(nowIso()));
    });
    return () => { active = false; };
  }, []);

  const followUps = useMemo(() => draft ? buildProjectFollowUps(draft, contentCatalog) : [], [draft]);

  function updateDraft(patch: Partial<ProjectCase>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function newProject() {
    setMessage("");
    setDraft(emptyProjectCase(nowIso()));
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      setMessage("请先填写项目名称；平台不会替你生成项目经历。");
      return;
    }
    const value = { ...draft, title: draft.title.trim(), updatedAt: nowIso() };
    await saveProjectCase(value);
    setProjects((current) => [value, ...current.filter((item) => item.id !== value.id)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    setDraft(value);
    setMessage(value.syncEnabled ? "项目经历已保存到本机，并加入可选同步队列。" : draft.syncEnabled ? "项目经历已保存到本机；已加入云端删除标记队列以撤销此前的同步授权。" : "项目经历已保存到本机 IndexedDB，未加入同步队列。");
  }

  async function archive() {
    if (!draft?.title.trim()) return;
    const value = { ...draft, deletedAt: nowIso(), updatedAt: nowIso() };
    await saveProjectCase(value);
    setProjects((current) => current.filter((item) => item.id !== value.id));
    setDraft(emptyProjectCase(nowIso()));
    setMessage("项目经历已从本机列表归档；录音等数据不会因此上传。");
  }

  if (!draft) return <p className="muted">正在恢复本机项目经历…</p>;

  return <>
    <section className="panel project-notice">
      <strong>私人数据边界</strong>
      <p className="muted">这里没有预置个人经历。所有字段由你自己填写，默认只保存到 IndexedDB，不进入 `content/`、静态产物或公开仓库。只有明确勾选后才加入 Supabase 可选同步。</p>
    </section>
    <div className="project-layout">
      <aside className="panel project-list-panel">
        <div className="project-list-header"><h2>我的项目</h2><button className="button" onClick={newProject}>新建模板</button></div>
        {projects.length ? <div className="list">{projects.map((project) => <button className={`project-list-item${project.id === draft.id ? " selected" : ""}`} key={project.id} onClick={() => setDraft(project)}><strong>{project.title || "未命名项目"}</strong><span>{project.syncEnabled ? "可选同步" : "仅本机"} · {new Date(project.updatedAt).toLocaleDateString()}</span></button>)}</div> : <p className="muted">还没有已保存的项目经历。</p>}
      </aside>
      <section className="panel project-editor">
        <div className="project-editor-header"><div><h2>结构化项目模板</h2><p className="muted">只记录真实发生过的内容；不确定的数字、板卡参数和个人经历请标为待补证据。</p></div>{draft.title && <span className="status">{draft.syncEnabled ? "允许同步" : "仅本机"}</span>}</div>
        <div className="field"><label htmlFor="project-title">项目名称</label><input id="project-title" value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="例如：填写你真实做过的项目" /></div>
        {editableFields.map(([field, label, hint]) => <div className="field" key={field}><label htmlFor={`project-${field}`}>{label}</label><span className="muted field-hint">{hint}</span><textarea id={`project-${field}`} value={draft[field as TextField]} onChange={(event) => updateDraft({ [field]: event.target.value })} /></div>)}
        <div className="field"><label htmlFor="project-technologies">技术关键词</label><span className="muted field-hint">使用逗号分隔；只填写实际用过或实际分析过的技术。</span><input id="project-technologies" value={listToCsv(draft.technologies)} onChange={(event) => updateDraft({ technologies: csvToList(event.target.value) })} /></div>
        <fieldset className="field project-links"><legend>关联公开知识点</legend><p className="muted field-hint">关联只保存公开课程 ID，不会把私人项目内容写入公开内容仓库。</p>{knowledgeCandidates.map((item) => <label key={item.id}><input type="checkbox" checked={draft.knowledgeLinks.includes(item.id)} onChange={(event) => updateDraft({ knowledgeLinks: event.target.checked ? [...draft.knowledgeLinks, item.id] : draft.knowledgeLinks.filter((id) => id !== item.id) })} />{item.title} <span className="muted">· {item.scope}</span></label>)}</fieldset>
        <label className="sync-choice"><input type="checkbox" checked={draft.syncEnabled} onChange={(event) => updateDraft({ syncEnabled: event.target.checked })} />允许将这条项目经历加入我的 Supabase 同步队列</label>
        {draft.syncEnabled && <p className="muted privacy-warning">同步不是端到端加密；请不要填写公司机密、密钥、客户数据或不应离开设备的内容。</p>}
        <div className="button-row"><button className="button primary" onClick={() => void save()}>保存项目经历</button>{draft.title && <button className="button" onClick={() => void archive()}>归档</button>}</div>
        {message && <p className="muted" role="status">{message}</p>}
      </section>
      <section className="panel project-followups"><h2>确定性追问模板</h2><p className="muted">问题由固定模板、已填写字段和关联公开知识点生成，不代表平台知道你的项目事实。</p><div className="list">{followUps.map((followUp) => <article className="follow-up" key={followUp.id}><strong>{followUp.prompt}</strong><span className="muted">{followUp.reason}</span></article>)}</div></section>
    </div>
  </>;
}
