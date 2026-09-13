"use client";

import Link from "@/components/static-link";
import { useEffect, useMemo, useState } from "react";
import { learningCatalog } from "@/lib/content/learning-catalog";
import { contentIndex } from "@/lib/content/content-index";
import { db } from "@/lib/db/database";
import type { ContentProgress, RecallMark } from "@/lib/domain/types";

const domains = [
  { id: "c", title: "C99 与嵌入式 C", summary: "类型、指针、内存、编译链接、未定义行为和调试。", href: "/roadmap/#c99" },
  { id: "embedded", title: "嵌入式基础与协议", summary: "UART、I2C、SPI、CAN、LIN、低功耗和 MCU Bootloader。", href: "/roadmap/#embedded" },
  { id: "cortex-m", title: "Cortex-M3 / STM32F103", summary: "启动、中断、NVIC、DMA、GPIO、定时器和外设。", href: "/roadmap/#cortex-m" },
  { id: "rt-thread", title: "RTOS / RT-Thread", summary: "线程调度、Tick、IPC、内存、死锁和上下文切换。", href: "/roadmap/#rt-thread" },
  { id: "linux", title: "Linux 用户态、驱动与 BSP", summary: "进程、IPC、Socket、驱动、设备树和 eMMC 启动链。", href: "/roadmap/#linux" },
  { id: "ai", title: "AI 辅助编程", summary: "Prompt、Context、Harness、Loop、Skill、MCP 与验证闭环。", href: "/roadmap/#ai" },
] as const;

// Keep the first visit aligned with the roadmap instead of filesystem/slug order.
const learningOrder = [
  "c-memory-model", "c99-pointer-lifetime", "c-debugging-diagnostics",
  "embedded-protocols", "embedded-bootloader-low-power",
  "cortex-m-startup-flow", "cortex-m-exception-model", "stm32f103-peripherals", "cortex-m-hardfault-debugging",
  "rt-thread-scheduler", "rtt-ipc-basics", "rtt-debugging-deadlock",
  "linux-process-io", "linux-ipc-and-commands", "linux-driver-device-tree", "imx6ull-boot-chain", "linux-user-debugging-workflow", "linux-bsp-boot-debugging",
  "ai-assisted-programming",
];

export function HomePage() {
  const [progress, setProgress] = useState<ContentProgress[]>([]);
  const [marks, setMarks] = useState<RecallMark[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([db.contentProgress.toArray(), db.recallMarks.toArray()]).then(([nextProgress, nextMarks]) => {
      setProgress(nextProgress);
      setMarks(nextMarks);
      setReady(true);
    });
  }, []);

  const completed = progress.filter((item) => item.status === "completed").length;
  const orderedLessons = useMemo(() => [...learningCatalog].sort((a, b) => (learningOrder.indexOf(a.id) < 0 ? 999 : learningOrder.indexOf(a.id)) - (learningOrder.indexOf(b.id) < 0 ? 999 : learningOrder.indexOf(b.id))), []);
  const nextLesson = useMemo(() => {
    const active = progress.find((item) => item.status === "in-progress");
    return orderedLessons.find((item) => item.id === active?.contentId) ?? orderedLessons.find((item) => !progress.some((entry) => entry.contentId === item.id && entry.status === "completed"));
  }, [orderedLessons, progress]);
  const questions = contentIndex.filter((item) => (item.type === "interview-question" || item.type === "quiz-question") && item.contentRole !== "placeholder" && item.status !== "deprecated");
  const markCounts = { familiar: marks.filter((item) => item.label === "familiar").length, uncertain: marks.filter((item) => item.label === "uncertain").length, unknown: marks.filter((item) => item.label === "unknown").length };

  if (!ready) return <p className="muted">正在从本机恢复学习状态…</p>;
  return <>
    <div className="eyebrow">个人学习工作台</div>
    <h1>把嵌入式知识学成能说、能写、能定位的能力</h1>
    <p className="home-lead">不登录也能完整学习。课程、进度、笔记、收藏和答题状态优先保存在本机，按知识地图逐步建立自己的嵌入式面试与调试知识库。</p>

    <section className="home-hero" aria-label="开始学习">
      <div className="panel home-hero-main">
        <span className="home-kicker">继续学习</span>
        <h2>{nextLesson ? nextLesson.title : "从知识地图选择一个主题"}</h2>
        <p className="muted">{nextLesson ? `${nextLesson.module} · 约 ${nextLesson.estimatedMinutes} 分钟。学完后再用随机复习检验是否真正记住。` : "六大模块已经按依赖关系整理，先选择一个你准备投递的方向。"}</p>
        <div className="button-row">
          {nextLesson ? <Link className="button primary" href={`/learn/${nextLesson.slug}/`}>打开下一篇课程</Link> : <Link className="button primary" href="/roadmap/">打开知识地图</Link>}
          <Link className="button" href="/review/">开始随机复习</Link>
        </div>
      </div>
      <div className="panel home-hero-stats">
        <div><span className="muted">课程完成</span><strong>{completed}/{learningCatalog.length}</strong></div>
        <div><span className="muted">可练习问答</span><strong>{questions.length}</strong></div>
        <div><span className="muted">已标记卡片</span><strong>{marks.length}</strong></div>
      </div>
    </section>

    <section className="home-section">
      <div className="section-heading"><div><div className="eyebrow">六大主线</div><h2>从语言基础走到 Linux BSP</h2></div><Link className="button" href="/roadmap/">查看完整路线</Link></div>
      <div className="domain-grid">{domains.map((domain, index) => <Link className="domain-card" href={domain.href} key={domain.id}><span className="domain-index">{index + 1}</span><div><h3>{domain.title}</h3><p>{domain.summary}</p></div><span className="domain-arrow">→</span></Link>)}</div>
    </section>

    <section className="home-section">
      <div className="section-heading"><div><div className="eyebrow">主动回忆</div><h2>随机复习状态</h2></div><Link className="button" href="/review/">打开复习</Link></div>
      <div className="grid grid-3 recall-summary-grid"><div className="panel"><span className="recall-dot familiar" />熟悉<strong>{markCounts.familiar}</strong></div><div className="panel"><span className="recall-dot uncertain" />模糊<strong>{markCounts.uncertain}</strong></div><div className="panel"><span className="recall-dot unknown" />不会<strong>{markCounts.unknown}</strong></div></div>
    </section>
  </>;
}
