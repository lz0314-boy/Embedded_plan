import Link from "@/components/static-link";
import type { Metadata } from "next";
import { contentCatalog } from "@/lib/content/catalog";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "知识地图与学习路线",
  description: "围绕 C99、嵌入式协议、Cortex-M3、RT-Thread、Linux 和 AI 辅助编程组织的学习地图。",
  alternates: { canonical: siteUrl("/roadmap/") },
  robots: { index: true, follow: true },
  openGraph: { title: "知识地图与学习路线", description: "嵌入式软件面试与调试知识地图。", type: "website" },
};

const modules = [
  { id: "c99", pillars: ["c"], modules: ["language-and-memory", "debugging"], title: "C99 与嵌入式 C", summary: "先把类型、对象、指针、内存和编译链接讲清楚，再进入并发与调试。", topics: ["指针与对象生命周期", "存储期限与链接属性", "预处理与编译链接", "内存布局与对齐", "未定义行为与告警"] },
  { id: "embedded", pillars: ["c"], modules: ["embedded-foundations"], title: "嵌入式基础与通信协议", summary: "从电气边界和时序开始，理解协议选型、故障现象与 MCU Bootloader。", topics: ["UART / RS232 / RS485", "I2C、SPI、CAN、LIN", "协议对比与调试", "低功耗基本方法", "MCU Bootloader 与升级"] },
  { id: "cortex-m", pillars: ["cortex-m"], modules: ["exceptions-and-context", "debugging", "startup-and-vector-table", "stm32f103-peripherals"], title: "Cortex-M3 / STM32F103C8T6", summary: "以 STM32F103C8T6 为代表，把 Cortex-M3 架构映射到启动、中断和外设。", topics: ["复位、向量表与启动文件", "异常栈帧与 NVIC", "SysTick、SVC、PendSV", "GPIO、UART、定时器", "ADC、DMA、看门狗"] },
  { id: "rt-thread", pillars: ["rt-thread"], modules: ["scheduler", "ipc", "debugging", "memory"], title: "RTOS / RT-Thread", summary: "沿线程状态、就绪队列、IPC 和上下文切换建立可解释的内核模型。", topics: ["线程生命周期与调度", "Tick、定时器与超时", "信号量、互斥量、事件", "邮箱与消息队列", "死锁、优先级反转与内存"] },
  { id: "linux", pillars: ["linux-user", "linux-bsp"], modules: ["processes-and-io", "debugging", "boot-chain", "driver-model", "ipc-and-commands"], title: "Linux 用户态、驱动与 BSP", summary: "从进程和 IPC 走到字符驱动、设备树，再沿 ALPHA eMMC 启动链定位问题。", topics: ["进程、线程、IPC 与 Socket", "ps、top、GDB、strace", "字符驱动与 platform driver", "设备树匹配与 probe", "U-Boot、Linux、rootfs、eMMC"] },
  { id: "ai", pillars: ["c"], modules: ["ai-assisted-programming"], title: "AI 辅助编程", summary: "把 AI 放在工程验证闭环中，用清晰上下文、工具和反馈提高编程效率。", topics: ["Prompt 与 Context", "Harness 与 Loop", "Skill 与 MCP", "AI 代码审查", "测试、来源核对与回归"] },
] as const;

function itemsFor(pillars: readonly string[], modules: readonly string[]) {
  return contentCatalog.filter((item) => pillars.includes(item.pillar) && modules.includes(item.module) && item.contentRole !== "placeholder" && item.status !== "deprecated");
}

export default function RoadmapPage() {
  return <>
    <div className="eyebrow">学习地图</div>
    <h1>从 C99 到 Linux BSP 的六条主线</h1>
    <p className="muted roadmap-intro">路线按依赖关系组织，题库、课程和随机复习共用同一套知识标签。这里展示学习范围与已经可以打开的内容，不把空壳占位条目伪装成课程。</p>
    <div className="roadmap-grid roadmap-grid-six">
      {modules.map((module, index) => {
        const items = itemsFor(module.pillars, module.modules);
        const lessons = items.filter((item) => item.type === "lesson");
        const questions = items.filter((item) => item.type === "interview-question" || item.type === "quiz-question");
        return <section className="panel roadmap-card" id={module.id} key={module.id}>
          <div className="roadmap-card-header"><span className="roadmap-step">{index + 1}</span><div className="roadmap-counts"><strong>{lessons.length}</strong> 篇课程 · <strong>{questions.length}</strong> 道题</div></div>
          <h2>{module.title}</h2>
          <p className="roadmap-card-summary">{module.summary}</p>
          <div className="topic-list" aria-label={`${module.title}主题范围`}>{module.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
          {lessons.length ? <div className="roadmap-card-list">{lessons.slice(0, 6).map((item) => <Link href={`/learn/${item.slug}/`} key={item.id}><span>{item.title}</span><small>{item.estimatedMinutes} 分钟</small></Link>)}{lessons.length > 6 ? <Link className="roadmap-more" href={`/questions/?q=${encodeURIComponent(module.title)}`}>查看该方向题库 →</Link> : null}</div> : <p className="roadmap-empty">该方向按上面的主题范围建设，课程会在完成资料核对后直接进入这里。</p>}
        </section>;
      })}
    </div>
  </>;
}
