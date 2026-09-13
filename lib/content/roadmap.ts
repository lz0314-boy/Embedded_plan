import { contentCatalog } from "./catalog";
import type { ContentRecord } from "./schema";

export type RoadmapModule = {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  pillars: readonly ContentRecord["pillar"][];
  modules: readonly string[];
  topics: readonly string[];
};

export const roadmapModules: readonly RoadmapModule[] = [
  {
    id: "c99",
    shortTitle: "C99 与嵌入式 C",
    title: "C99 与嵌入式 C 高频八股文",
    summary: "从类型、对象、指针和内存布局开始，覆盖编译链接、并发访问和未定义行为。",
    pillars: ["c"],
    modules: ["language-and-memory", "debugging"],
    topics: ["数组与指针", "函数指针与回调", "结构体、联合体与位域", "内存布局与对齐", "预处理、编译与链接", "volatile、const 与未定义行为"],
  },
  {
    id: "embedded",
    shortTitle: "嵌入式基础",
    title: "嵌入式基础与通信协议",
    summary: "用电气边界、帧格式和时序理解 UART、I2C、SPI、CAN、LIN、低功耗与 MCU Bootloader。",
    pillars: ["c"],
    modules: ["embedded-foundations"],
    topics: ["UART / RS232 / RS485", "I2C、SPI、CAN、LIN", "协议选型与抓包", "低功耗唤醒", "MCU Bootloader 与升级"],
  },
  {
    id: "cortex-m",
    shortTitle: "Cortex-M3 / STM32F103",
    title: "Cortex-M3 / STM32F103C8T6 高频八股文",
    summary: "以 STM32F103C8T6 为具体对象，把 Cortex-M3 启动、异常、中断和常见外设串成可调试链路。",
    pillars: ["cortex-m"],
    modules: ["exceptions-and-context", "debugging", "startup-and-vector-table", "stm32f103-peripherals"],
    topics: ["复位、向量表与启动文件", "异常栈帧与 NVIC", "SysTick、SVC、PendSV", "GPIO、EXTI、UART", "定时器、PWM、ADC、DMA", "看门狗与故障定位"],
  },
  {
    id: "rt-thread",
    shortTitle: "RT-Thread",
    title: "RTOS / RT-Thread 高频八股文",
    summary: "从线程状态和 Tick 调度，到 IPC、内存、优先级反转和死锁，建立可解释的内核模型。",
    pillars: ["rt-thread"],
    modules: ["scheduler", "ipc", "debugging", "memory"],
    topics: ["线程生命周期与调度", "Tick、软件定时器与超时", "信号量、互斥量、事件", "邮箱与消息队列", "内存分配、优先级反转与死锁"],
  },
  {
    id: "linux",
    shortTitle: "Linux 用户态、驱动与 BSP",
    title: "Linux 用户态、驱动与 BSP 高频八股文",
    summary: "从进程、IPC 和常用命令走到字符驱动、platform、设备树，再定位 ALPHA eMMC 启动链问题。",
    pillars: ["linux-user", "linux-bsp"],
    modules: ["processes-and-io", "debugging", "boot-chain", "driver-model", "ipc-and-commands"],
    topics: ["进程、线程、IPC 与 Socket", "ps、top、GDB、strace", "字符设备与块设备", "platform/probe 与资源回滚", "设备树、GPIO、IRQ、时钟", "U-Boot、Linux、rootfs、eMMC"],
  },
  {
    id: "ai",
    shortTitle: "AI 辅助编程",
    title: "AI 辅助编程工程方法",
    summary: "用 Prompt、Context、Harness、Loop、Skill 和 MCP 把 AI 放进可验证的编码与复盘闭环。",
    pillars: ["c"],
    modules: ["ai-assisted-programming"],
    topics: ["Prompt 与 Context", "Harness 与反馈 Loop", "Skill 与 MCP 权限", "测试生成与代码审查", "来源核对与回归验收"],
  },
] as const;

export function getRoadmapModule(id: string) {
  return roadmapModules.find((module) => module.id === id);
}

export function itemsForRoadmapModule(module: RoadmapModule) {
  return contentCatalog.filter(
    (item) => module.pillars.includes(item.pillar) && module.modules.includes(item.module) && item.contentRole !== "placeholder" && item.status !== "deprecated",
  );
}
