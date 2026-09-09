# 嵌入式软件系统化学习平台设计文档

> 工作名：嵌入式复习站（可替换）  
> 文档版本：v1.0  
> 目标用户：2027 届、就业方向为嵌入式软件的个人学习者  
> 文档用途：作为产品、内容、交互、技术实现和验收的唯一开发基线  
> 研究依据：同目录下的 `embedded-learning-platform-research.md`

## 1. 决策摘要

本项目是一个面向个人求职复习的、内容可信且可持续维护的嵌入式软件学习网站。第一目标不是做社区、课程商城或 AI 聊天产品，而是把零散知识整理成可学习、可练习、可复习、可追踪的体系。

已确定的核心决策：

1. 覆盖 C 语言、计算机基础、Cortex-M3/M4、STM32、GD32、ESP32、RT-Thread、Linux BSP、Linux 应用和项目面试。
2. RTOS 以 RT-Thread 为主，既讲 API，也讲调度、上下文切换、线程状态、IPC、时钟与内存管理等内部机制。
3. Linux BSP 以正点原子阿尔法开发板和 NXP i.MX6ULL 为主线，完整讲解从上电、Boot ROM、U-Boot、Linux 内核、设备树、根文件系统、PID 1 到用户程序运行的链路。
4. 内容使用 Markdown/MDX 进入 Git，学习数据使用浏览器本地数据库，登录后可同步到 Supabase。
5. 网站采用静态优先和 PWA，本地数据始终可用；云同步不可用时不得阻塞学习。
6. 推荐技术栈为 Next.js App Router、TypeScript、Tailwind CSS、MDX、IndexedDB/Dexie、Supabase。
7. UI 是克制、清晰、信息密度适中的技术学习工具，不采用强装饰、营销式首页或花哨动效。
8. 网站可以公开部署，但个人笔记、实习经历、项目经历和学习数据不得进入公开 Git 仓库。
9. 无运行时付费 AI 依赖。学习计划、复习调度、评分和薄弱项分析使用确定性算法。
10. 产品目标可以完整设计，但实施必须分阶段验收；未经权威来源核验的 AI 内容不能标记为“已核验”。

### 1.1 关键约束

- “永久免费、跨设备同步、长期稳定、保证中国大陆访问”无法由单一海外免费服务同时保证。
- 解决方案必须采用多层降级：静态站点负责内容访问，PWA/IndexedDB 负责离线学习，Supabase 只负责可选同步，JSON 导入导出负责最终数据可迁移性。
- ESP32 系列不等同于 Cortex-M。经典 ESP32/ESP32-S 系列主要是 Xtensa，部分新型号使用 RISC-V；内容中必须将其作为独立平台分支，不能套用 Cortex-M3/M4 异常和上下文切换结论。
- STM32 与 GD32 的外设和时序并非完全兼容。通用 Cortex-M 原理、芯片厂商实现和具体型号差异必须分层描述。
- 正点原子教程所使用的 U-Boot、Linux 内核和根文件系统版本可能较旧。内容必须区分“开发板复现实验版本”和“当前上游机制”，不能把旧版本行为描述为所有 Linux 的现状。

## 2. 产品目标与边界

### 2.1 用户问题

当前学习资料存在四个主要问题：

- 知识分散，没有从前置知识到综合应用的依赖关系。
- 面试短答案、底层原理和工程实践混在一起，难以按场景复习。
- 内容缺少版本、平台和权威来源，准确性难以判断。
- 阅读以后缺少主动回忆、测验、错题和间隔复习，难以形成长期记忆。

### 2.2 产品目标

- 建立一张完整、可导航的嵌入式软件知识地图。
- 让每个主题同时支持“快速面试回答”和“深入理解”。
- 用每日任务、主动回忆、测验和间隔重复形成闭环。
- 为每项关键结论提供平台、版本和来源信息。
- 在电脑和手机上保持一致学习进度，并在弱网或断网时继续工作。
- 允许未来加入个人项目经历，自动映射到可被追问的知识点，但不泄露私人内容。

### 2.3 非目标

- 第一版不做公开注册社区、评论区、排行榜或用户投稿。
- 不做付费课程、直播、招聘或简历投递平台。
- 不依赖远程大模型生成答案或评价模拟面试。
- 不在浏览器中模拟真实 MCU、RTOS 或完整 Linux 板卡环境。
- 不将“浏览器内 C 代码执行”包装成嵌入式交叉编译和硬件验证。

### 2.4 成功指标

个人产品优先使用学习指标，不使用 PV 作为主要指标：

| 指标 | 目标 |
|---|---|
| 每日到期复习完成率 | 连续 4 周不低于 80% |
| 核心知识覆盖率 | 每个求职主线至少完成 80% 必修主题 |
| 近 30 天测验正确率 | 稳定达到 80% 以上 |
| 错题回收率 | 进入错题本的题目 14 天内至少复习 2 次 |
| 搜索成功率 | 90% 的目标关键词在前 5 条结果中找到对应内容 |
| 离线可用性 | 首次完整访问后，核心学习流程断网可用 |
| 同步可靠性 | 离线变更在恢复网络后最终同步，且不静默丢失笔记 |

## 3. 用户模型与核心场景

### 3.1 用户画像

- 主要用户：有一定 STM32、ESP32、GD32 和 Linux 基础，准备嵌入式软件校招的学生。
- 当前能力：做过项目，但知识点分散，部分结论只会使用、不理解内部机制。
- 使用设备：电脑用于系统学习和代码练习，手机用于通勤刷题和到期复习。
- 使用频率：每天 30、60 或 90 分钟，可在设置中选择。
- 主要目标：建立知识体系、提高面试表达、发现薄弱项、补齐项目追问。

### 3.2 核心任务

1. 打开首页后，立即看到今天到期的复习和下一项学习任务。
2. 按路线学习一个主题，完成主动回忆、阅读、测验和自评。
3. 在面试前按方向、平台、难度和频率快速刷题。
4. 搜索一个概念，同时找到短答案、深入解释、关联主题和权威来源。
5. 离线记录笔记，网络恢复后在另一台设备继续学习。
6. 进行限时模拟面试，查看回答提纲并按评分点复盘。
7. 后续录入实习和项目经历，生成项目专属追问清单。

## 4. 功能范围与优先级

“完整产品”包含下列全部功能。开发阶段用于控制风险，不代表删除后续功能。

### 4.1 P0：学习闭环

- 内容分类、知识地图、前置依赖和学习路线。
- 全文搜索、筛选、标签、缩写和中英文别名。
- 知识文章、面试问题、代码片段、对比表和启动流程图。
- 阅读进度、完成状态、收藏、个人笔记。
- 章节测验、随机刷题、错题本。
- 基于 FSRS 的间隔重复和每日复习队列。
- 每日计划、连续学习记录、覆盖率和薄弱项统计。
- 游客本地使用、账号登录和跨设备同步。
- PWA 安装、离线阅读、离线作答和恢复网络后的同步。
- JSON 数据导出、导入和版本迁移。

### 4.2 P1：面试与代码训练

- 按方向、难度、题数和时长生成模拟面试。
- 问题逐题展示、计时、隐藏答案、自我评分和复盘。
- 可选本地录音，仅保存在设备端，默认不上传。
- Monaco 代码编辑器、草稿保存、测试用例和答案对比。
- 浏览器内 WebAssembly C 编译器适配层；支持时执行，失败时降级为编辑、保存和参考答案对比。
- 代码运行必须在 Web Worker 内执行，并限制运行时间、输出长度和可用内存。

### 4.3 P2：个人项目面试

- 项目、职责、技术栈、难点、故障、优化和结果的结构化录入。
- 将项目条目关联到知识主题和面试问题。
- 自动生成“项目介绍、技术追问、故障追问、权衡追问”清单。
- 该模块默认私有，只存 IndexedDB/Supabase，不进入公开内容仓库。
- 在用户提供实习和项目材料前，只实现数据结构、空状态和示例模板，不虚构经历。

## 5. 内容战略与知识体系

### 5.1 内容原则

- 先建立主干，再扩充分支；先覆盖求职高频核心，再覆盖平台细节。
- 同一知识点只维护一个规范解释，通过关联关系服务不同路线，避免复制后产生冲突。
- 每项内容必须明确是“RTOS 通用机制”“RT-Thread 实现”“Cortex-M 实现”还是“特定芯片实现”。
- 面试短答案用于表达，深入解释用于理解，两者必须在同一内容实体中保持一致。
- 文章要可搜索、可引用、可拆成复习卡片，并与测验和代码练习相连。

### 5.2 五个内容支柱

#### 支柱 A：C 语言与计算机基础

1. C 数据模型、整数提升、类型转换、表达式求值。
2. 指针、数组、字符串、多级指针和函数指针。
3. 作用域、链接、存储期、`static`、`const`、`volatile`、`restrict`。
4. 栈、堆、内存布局、对齐、大小端、未定义行为。
5. 预处理、编译、汇编、链接、ELF、符号和链接脚本。
6. 链表、队列、环形缓冲区、哈希、树和常用复杂度。
7. 进程、线程、同步、虚拟内存和网络基础。
8. 可重入、线程安全、状态机、错误处理和防御式编程。

#### 支柱 B：Cortex-M 与 MCU

1. Cortex-M3/M4 内核、寄存器、特权级、MSP/PSP 和内存映射。
2. 启动文件、向量表、复位流程、异常模型、NVIC、SysTick 和 PendSV。
3. 时钟树、GPIO、EXTI、定时器、PWM、看门狗和低功耗。
4. UART、I2C、SPI、CAN 的电气基础、协议时序和驱动设计。
5. ADC、DMA、双缓冲、缓存一致性边界和高吞吐数据链路。
6. Flash、RAM、栈、堆、内存池、Map 文件和资源优化。
7. Bootloader、固件升级、故障恢复、日志和调试工具。
8. STM32 与 GD32 的共同基础和差异；ESP32 的 Xtensa/RISC-V 独立分支。

#### 支柱 C：RT-Thread 与 RTOS 内核

1. 实时系统基本概念、确定性、延迟、抖动和优先级设计。
2. RT-Thread 对象模型、自动初始化、线程控制块和内核链表。
3. 线程状态、优先级就绪队列、优先级位图、时间片和调度点。
4. Cortex-M 上的 SysTick、PendSV、上下文保存恢复和中断嵌套。
5. 信号量、互斥量、事件、邮箱、消息队列和等待队列。
6. 优先级反转、优先级继承、死锁、临界区和中断上下文限制。
7. 软件定时器、内存堆、内存池、设备模型、FinSH 和组件初始化。
8. 线程划分、栈评估、故障定位、性能测量和工程案例。

#### 支柱 D：i.MX6ULL 嵌入式 Linux BSP

1. i.MX6ULL SoC、正点原子阿尔法开发板、存储和启动介质。
2. 上电、复位、Boot Mode、Boot ROM、IVT/DCD、SPL（若使用）和 DDR 初始化。
3. U-Boot 初始化、环境变量、网络/存储启动、内核与 DTB 加载。
4. `bootz`、内核解压、体系结构初始化、`start_kernel()` 和核心子系统初始化。
5. 设备树、platform 总线、设备/驱动匹配、probe、pinctrl、clock 和 regulator。
6. 根文件系统挂载、PID 1、BusyBox init/systemd、启动脚本和用户程序。
7. U-Boot、Linux、设备树、Buildroot/Yocto 和根文件系统构建。
8. GPIO、I2C、SPI、UART、LCD、网络、块设备/MTD 的 BSP 与调试。

#### 支柱 E：Linux 应用与工程面试

1. 文件 I/O、标准 I/O、目录、权限、阻塞与非阻塞。
2. 进程、线程、`fork/exec/wait`、pthread 和同步原语。
3. 信号、管道、消息队列、共享内存、`mmap` 和 Unix Domain Socket。
4. TCP/UDP、Socket、`select/poll/epoll` 和网络状态机。
5. 串口、设备节点、`ioctl`、事件循环和数据协议。
6. Make/CMake、交叉编译、动态库、GDB、strace、perf 和日志。
7. 守护进程、启动服务、配置、升级、可靠性和故障恢复。
8. 项目架构、性能、并发、内存、通信和故障类面试追问。

### 5.3 学习依赖主线

```text
C 数据与内存模型
  -> 编译链接、启动文件与链接脚本
  -> Cortex-M 异常、中断与上下文
  -> MCU 外设、DMA 与并发
  -> RTOS 线程、调度与 IPC

C + 操作系统基础
  -> Linux 用户态系统编程
  -> U-Boot 与 Linux 启动
  -> 设备树与 Linux 驱动模型
  -> BSP 构建、调试与项目问题
```

### 5.4 初始内容规模

内容质量优先于一次批量生成。产品功能完整上线和内容库扩充应分开验收。

| 阶段 | 课程页 | 面试题 | 测验题 | 代码/分析实验 | 要求 |
|---|---:|---:|---:|---:|---|
| 黄金样本 | 每模块 1 篇 | 每模块 2 题 | 每模块 3 题 | 每支柱 1 个 | 人工逐条核验结构和来源 |
| 可用内容库 | 至少 40 篇 | 至少 200 题 | 至少 250 题 | 至少 20 个 | 五个支柱均有完整主线 |
| 持续扩充 | 不设上限 | 每模块 8 至 15 题 | 与错题反馈联动 | 项目驱动 | 每次增量必须通过内容 CI |

### 5.5 内容可信度分级

| 等级 | 来源 | 用法 |
|---|---|---|
| A | 芯片参考手册、架构手册、标准、官方源码和上游项目文档 | 关键机制和寄存器事实的首选依据 |
| B | 厂商应用笔记、官方教程、官方开发板资料 | 平台操作和示例的主要依据 |
| C | 公认教材、维护良好的专业书籍 | 帮助解释和组织知识，不替代版本事实 |
| D | 博客、论坛、视频和问答社区 | 仅用于发现问题，不作为唯一事实来源 |

所有已发布内容必须满足：

- 至少包含一个 A/B 级来源；关键底层结论优先引用 A 级来源。
- 记录适用平台、文档或源码版本、访问日期、最后核验日期。
- 代码说明编译器、目标平台和是否实际运行；未运行代码必须标记。
- 厂商寄存器地址和位定义使用官方头文件符号，不凭记忆硬编码。
- AI 可以生成草稿，但只有人工完成来源核对后才能把状态改为 `verified`。
- 引用第三方内容时只做必要短引，解释和图示必须原创，避免复制教程正文。

### 5.6 内容实体和标准模板

内容不是一组互不相关的文章，而是一张由稳定 ID 连接的知识图谱。基础实体包括：

| 实体 | 说明 |
|---|---|
| `lesson` | 系统讲解一个主题，包含目标、前置知识、原理和实践 |
| `interview-question` | 主动回忆和面试表达单位 |
| `quiz-question` | 单选、多选、判断、排序、填空或简答评分点 |
| `review-card` | 从课程或问题派生的最小记忆单位 |
| `code-lab` | 可编辑 C 代码、测试用例、分析题或调试题 |
| `boot-stage` | Linux 启动链中特定阶段、输入、输出和诊断信息 |
| `project-case` | 私有的项目背景、决策、故障和追问 |
| `source` | 权威来源登记项，供其他内容按 ID 引用 |

每个面试问题按以下顺序呈现：

1. **问题与适用范围**：明确平台、版本和上下文。
2. **先自己回答**：默认隐藏答案，提供 30 至 90 秒计时。
3. **30 秒回答**：能直接用于面试的结论和结构。
4. **展开回答**：3 至 7 个有逻辑顺序的要点。
5. **底层机制**：数据结构、调用链、状态变化、时序或源码路径。
6. **代码/图示**：最小可验证示例、流程图或时序图。
7. **常见误区**：错误说法、边界条件和平台差异。
8. **追问**：至少 2 个递进问题，并关联到其他内容 ID。
9. **自评**：忘记、困难、掌握、简单，对应 FSRS 评分。
10. **来源**：来源名称、版本、链接、访问日期和核验状态。

课程页按以下顺序呈现：

- 学习目标与前置知识。
- 核心结论摘要。
- 概念模型或启动/执行流程。
- 深入机制与源码入口。
- 平台差异。
- 最小实验和预期结果。
- 面试题、复习卡片和章节测验。
- 权威来源和变更记录。

### 5.7 MDX 元数据规范

所有内容的 frontmatter 必须通过 Zod 构建校验。示例：

```yaml
id: rtt-scheduler-ready-queue
type: interview-question
title: RT-Thread 如何选择下一个运行线程？
slug: rt-thread-scheduler-ready-queue
pillar: rt-thread
module: scheduler
difficulty: advanced
priority: core
estimatedMinutes: 12
platforms: [rt-thread, cortex-m3, cortex-m4]
versions:
  rtThread: "<固定 tag 或 commit>"
prerequisites:
  - cortexm-exception-model
  - rtt-thread-state
related:
  - rtt-priority-bitmap
  - rtt-context-switch-pendsv
sourceIds:
  - rtthread-kernel-source-scheduler
verifiedAt: null
status: draft
keywords: [调度器, 就绪队列, 优先级位图, scheduler]
```

字段规则：

- `id` 一经发布不得复用或随标题变化。
- `slug` 使用小写 ASCII 和连字符，保证 URL 稳定。
- `status` 只允许 `draft | reviewed | verified | deprecated`。
- `verifiedAt` 为空时 UI 必须显示“待核验”，不能显示可信徽标。
- `prerequisites` 和 `related` 必须指向存在的 ID；构建时检测循环前置依赖。
- 平台差异不得只写在正文中，必须通过 `platforms` 和 `versions` 可检索。

### 5.8 内容仓库工作流

```text
选题 -> 登记来源 -> AI/人工起草 -> 结构审查 -> 对照原文核验
    -> 代码/图示验证 -> 内容 CI -> 标记 verified -> 合并发布
```

构建必须在下列情况失败：

- 缺少必填 frontmatter、ID 重复或 slug 冲突。
- 关联 ID、来源 ID 或题目答案不存在。
- `verified` 内容没有来源或 `verifiedAt`。
- Markdown 内链失效、代码围栏未闭合或危险 HTML 未被禁止。
- 启动流程节点没有输入、输出、关键日志和失败定位信息。

## 6. 学习系统设计

### 6.1 首次设置

首次打开只收集影响计划的必要信息：

- 每日学习时长：30、60、90 分钟或自定义。
- 目标日期：可选；不填则按长期复习模式。
- 当前重点：MCU/RT-Thread、Linux BSP、Linux 应用或均衡。
- 自评基础：陌生、了解、做过项目、准备面试。
- 是否启用本机通知：可选，默认关闭。

这些设置先写入 IndexedDB；用户登录后再同步。首次使用不得强制注册。

### 6.2 每日学习闭环

```text
到期复习
  -> 计划中的新主题
  -> 关联章节测验
  -> 1 至 3 道混合面试题
  -> 今日薄弱项与明日到期量
```

首页只突出一个主行动：继续今日学习。其他信息降级为辅助内容，避免仪表盘堆满卡片。

每日任务生成顺序：

1. 先安排已到期的 FSRS 卡片。
2. 再安排未完成且前置条件已满足的核心主题。
3. 然后安排该主题的章节测验。
4. 有剩余时间时加入薄弱模块的混合题。
5. 面试冲刺模式下，提高随机题和限时回答比例，但不跳过到期复习。

### 6.3 间隔重复

- 使用经过验证的 `ts-fsrs` 库，不自行实现记忆调度公式。
- 四个评分显示为：忘记（Again）、困难（Hard）、掌握（Good）、简单（Easy）。
- 阅读完成不等于掌握；只有主动回忆或测验结果才能影响复习状态。
- 复习卡片可以由问题、概念、对比项和启动链阶段产生。
- 调度数据包含状态、难度、稳定性、到期时间、复习次数和遗忘次数。
- 调度参数必须可导出，并记录算法版本，升级时提供迁移测试。

### 6.4 测验与错题

- 客观题即时评分，并解释每个选项为什么正确或错误。
- 简答题按评分点自评，不使用付费 AI 判分。
- 每次错误记录概念标签、错误选项、用时和当时信心。
- 错题不是永久列表：连续达到复习标准后进入“已回收”，历史仍可查看。
- 测验中断后可从本地恢复；提交后保存不可变 attempt 记录。

### 6.5 薄弱项分析

不要输出一个缺少解释的“能力分”。分别展示：

- 内容覆盖率：完成核心主题数 / 核心主题总数。
- 近 30 天正确率：按支柱和模块分组。
- 到期积压：逾期卡片数量与最长逾期天数。
- 易错概念：最近错误次数、置信度和恢复趋势。
- 面试表达：自评低于 3 分的评分点分布。

薄弱项排序可以使用可解释的分数：

```text
weakness = 0.45 * (1 - recentAccuracy)
         + 0.30 * reviewFailureRate
         + 0.15 * overdueRatio
         + 0.10 * (1 - coverage)
```

UI 必须展示构成原因，例如“最近 8 题错 5 题、3 张卡片逾期”，而不是只显示分数。

### 6.6 模拟面试

创建会话时可选择：

- 方向、平台、模块、难度、题数和总时长。
- 是否允许追问、是否混合项目题、是否录音。
- 新题优先、薄弱题优先或完全随机。

单题流程：显示题目 -> 思考/作答 -> 展示评分点 -> 自评每个评分点 -> 查看参考答案 -> 进入追问。会话结束后生成：遗漏评分点、犹豫时间较长的问题、推荐复习内容和可重新开始的题单。

录音采用浏览器 `MediaRecorder`，默认只存本地，不参与同步。浏览器不支持或用户拒绝权限时正常降级为计时和文本笔记。

### 6.7 代码练习

代码练习分为三类：

1. **标准 C 可执行题**：数据结构、指针、字符串和算法，可在浏览器编译运行。
2. **结果分析题**：判断编译、未定义行为、内存布局或输出，不直接运行危险代码。
3. **平台代码审查题**：寄存器、ISR、DMA、RT-Thread 或 Linux 驱动片段，按检查点作答，不伪装成硬件仿真。

浏览器执行要求：

- 编译器和运行时通过动态导入，仅进入代码实验时加载。
- 在独立 Web Worker 中运行，设置超时并可强制终止 Worker。
- 禁止网络访问、DOM 访问和宿主文件系统访问。
- 限制 stdout/stderr、源文件大小和测试用例数量。
- 编译器资源较大时允许用户单独下载离线包；移动端内存不足时显示明确降级状态。
- 编译命令默认启用 `-std=c11 -Wall -Wextra -Werror`，题目可声明额外选项。
- 嵌入式目标代码只做静态检查、编译产物分析或答案对照，实际时序和硬件行为必须在板卡上验证。

### 6.8 默认学习路线

没有目标日期时，首次设置默认生成 18 周、每天 60 分钟的路线；用户可压缩或暂停，但前置依赖不被悄悄跳过。

| 周次 | 主线 | 同步训练 |
|---|---|---|
| 第 1 周 | 诊断测验、C 基础查漏、工具链准备 | 每天 3 道基础面试题 |
| 第 2 至 4 周 | C 内存模型、指针、编译链接、数据结构 | 标准 C 代码题与未定义行为分析 |
| 第 5 至 7 周 | Cortex-M3/M4、异常、中断、STM32/GD32 外设与 DMA | 寄存器/时序推演、调试题 |
| 第 8 至 10 周 | RTOS 通用原理与 RT-Thread 调度、IPC、时钟、内存 | 源码调用链、PendSV 和并发故障题 |
| 第 11 至 13 周 | Linux 应用：进程线程、IPC、I/O、网络和调试 | 小程序、系统调用与故障定位 |
| 第 14 至 17 周 | i.MX6ULL 启动链、U-Boot、内核/设备树、驱动、Buildroot/Yocto | ALPHA 真板实验和启动日志分析 |
| 第 18 周 | 五条主线串联、薄弱项回收、模拟面试 | 项目追问模板；等待真实经历补充 |

每日 60 分钟建议分配为：15 分钟到期复习、30 分钟新主题、10 分钟测验/面试题、5 分钟总结。30 分钟模式保留到期复习并减少新内容；90 分钟模式增加实验和源码阅读，不能简单增加题量。

诊断测验只用于调整起点，不产生“失败”状态。系统可跳过已稳定掌握的基础条目，但必须保留抽样复查；面试冲刺模式可提高题目比例，仍不取消间隔复习。

## 7. 信息架构

### 7.1 路由

| 路由 | 页面 | 是否可索引 |
|---|---|---|
| `/` | 今日学习首页 | 否，产品界面 |
| `/roadmap` | 知识地图与学习路线 | 是 |
| `/learn/[pillar]` | 支柱页 | 是 |
| `/learn/[pillar]/[module]` | 模块页 | 是 |
| `/learn/[pillar]/[module]/[slug]` | 课程页 | 是 |
| `/questions` | 面试题库与筛选 | 是，提供可抓取分页 |
| `/questions/[slug]` | 单题详情 | 是 |
| `/quiz?session=[id]` | 本地生成的测验会话 | 否 |
| `/review` | 到期复习 | 否 |
| `/interview` | 模拟面试配置/历史 | 否 |
| `/interview/session?sid=[id]` | 本地生成的模拟面试会话 | 否 |
| `/labs` | 代码和分析实验目录 | 是 |
| `/labs/[slug]` | 实验详情 | 视内容决定 |
| `/notes` | 私人笔记 | 否 |
| `/stats` | 学习统计 | 否 |
| `/projects` | 私人项目经历 | 否 |
| `/settings` | 账号、同步、外观和数据 | 否 |
| `/auth/callback` | Supabase 登录回调 | 否 |
| `/offline` | 离线状态页 | 否 |

静态导出要求所有公开动态路径在构建时生成，slug 必须稳定。部署到子路径时，路由、资源、Service Worker scope 和 canonical 必须统一处理 `basePath`。

测验和面试会话 ID 在运行时生成，因此使用已静态导出的固定页面加查询参数，不能使用无法预生成的动态路径。内容详情的动态路径只接收构建清单中已知的 slug。

### 7.2 导航

- 桌面端：固定左侧导航，宽度约 232px；主内容区和可选右侧目录区。
- 手机端：底部五项导航为“今日、路线、题库、复习、更多”。
- 全局搜索在桌面顶栏和移动端明显位置；搜索弹层支持键盘和触摸。
- 内容页提供面包屑、前置知识、上一篇/下一篇和关联内容。
- 任意核心内容应在首页三次交互内到达。

### 7.3 关键页面

#### 今日学习首页

- 第一视觉：今日到期数、预计时长和“继续学习”。
- 第二层：今天的任务序列和上次学习位置。
- 第三层：五个支柱覆盖率、连续学习、同步状态和最近笔记。
- 不使用营销 Hero，不介绍网站功能，不堆叠重复统计卡片。

#### 知识地图

- 以五条主线和依赖关系展示，不做无限画布。
- 支持“路线视图”和“紧凑列表视图”；手机默认列表。
- 节点状态：未解锁、可学习、进行中、已完成、需复习。
- 点击节点直接进入主题，状态颜色之外还必须使用图标/文本表达。

#### 内容/问题页

- 正文宽度控制在适合长时间阅读的范围，代码区可横向滚动。
- 桌面右侧显示本页目录和学习状态；移动端使用抽屉。
- 面试问题默认隐藏答案，先提供回答计时。
- 来源、版本、核验日期始终可见，不放到难以发现的弹窗中。

#### 题库

- 支持关键词、支柱、模块、平台、难度、状态、收藏、错题筛选。
- 筛选条件写入 URL，刷新和分享后可恢复。
- 大量结果分页或虚拟化；不能让筛选项变化导致布局跳动。

## 8. 视觉与交互规范

### 8.1 设计方向

关键词：安静、清楚、可信、工程化、适合长时间阅读。

- 默认跟随系统明暗主题，首次可手动覆盖。
- 不使用渐变、装饰性大图、玻璃模糊、悬浮大阴影或大面积品牌色。
- 页面分区主要依靠间距和排版；边框只用于工具、表格和重复条目。
- 卡片圆角不超过 8px，不把页面的每个区域都包装成卡片。
- 主操作使用克制的蓝色；绿色、黄色、红色只表达成功、警告和错误。
- 动效只用于状态变化，时长 120 至 200ms，支持 `prefers-reduced-motion`。

建议颜色：

| 语义 | 浅色 | 深色 |
|---|---|---|
| 页面背景 | `#F7F8FA` | `#101214` |
| 主表面 | `#FFFFFF` | `#171A1D` |
| 主文字 | `#17191C` | `#F4F5F6` |
| 次文字 | `#5D646D` | `#AAB0B7` |
| 边框 | `#DDE1E5` | `#30353A` |
| 主操作 | `#2563EB` | `#6EA8FE` |
| 成功 | `#16803A` | `#4ADE80` |
| 警告 | `#A15C00` | `#FBBF24` |
| 错误 | `#C62828` | `#F87171` |

字体优先使用本机字体，避免中国大陆网络环境下依赖 Google Fonts：

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
  "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
--font-mono: "JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas,
  "Liberation Mono", monospace;
```

如自托管 JetBrains Mono，只提供必要字重和 WOFF2 子集；字体加载失败时不得影响布局和代码可读性。

### 8.2 组件规范

- 图标统一使用 `lucide-react`，纯图标按钮必须有 tooltip 和无障碍名称。
- 二元配置使用开关或复选框，模式切换使用分段控件。
- 数量和时长使用步进器或数字输入，不用带文字的伪按钮代替。
- 复习评分四个按钮保持稳定宽度，最长中文文本也不能溢出。
- 表格在手机端改为定义列表或允许受控横向滚动，不能压缩到不可读。
- 加载状态使用稳定尺寸的行占位或简短文本，不能引起主布局跳动。
- 错误和同步状态使用页面内状态条，不用短暂消失且不可追溯的 toast 作为唯一反馈。

### 8.3 可访问性

- 语义化标题只有一个 H1，层级不跳跃。
- 所有交互可通过键盘完成，焦点样式清晰可见。
- 触摸目标最小 44 x 44 CSS px。
- 正文、按钮、图表和状态达到 WCAG 2.2 AA 对比度。
- 不能只用颜色表达进度、正确/错误或节点状态。
- 提供跳到主内容链接；弹层必须正确管理焦点和 Escape 关闭。
- 代码编辑器之外不劫持浏览器快捷键；编辑器必须提供退出焦点的方法。

### 8.4 响应式与内容图示

- 以 `360px` 宽的手机为最低设计基线，同时验证 `390px`、`768px`、`1280px` 和 `1440px`。
- 正文容器建议最大宽度 `760px`；带右侧目录时页面总内容宽度不超过 `1280px`。
- 桌面三栏在小于 `1100px` 时隐藏右侧目录，小于 `768px` 时切换到底部导航；不通过缩小正文到难以阅读来保留侧栏。
- 知识地图、启动链和调度时序优先使用原创技术图示。Mermaid 可在构建时转为静态 SVG，并保留等价文本说明；运行时不加载 Mermaid。
- 板卡照片、芯片框图和手册截图只在确有教学价值且许可允许时使用，必须标注来源；不使用纯装饰图片。
- 图表在窄屏下允许受控横向滚动，首屏必须出现滚动提示；复杂图同时提供分阶段列表视图。

## 9. 技术架构

### 9.1 技术栈

| 层 | 选择 | 约束 |
|---|---|---|
| 应用框架 | Next.js App Router + TypeScript | 使用 `output: "export"`；公开内容构建为静态 HTML |
| 样式 | Tailwind CSS + CSS variables | 不引入大型组件库；通用无障碍原语可选 Radix UI |
| 内容 | MDX + Zod + unified/remark/rehype | 构建时解析、校验和生成索引，禁止运行时读取文件系统 |
| 搜索 | Pagefind，自定义轻量 UI 适配层 | 构建后索引静态 HTML，搜索代码和索引均按需加载 |
| 本地数据 | IndexedDB + Dexie | 本地数据是即时事实来源，任何写入不等待网络 |
| 复习算法 | `ts-fsrs` | 固定版本并保存算法参数/版本，不自行实现 FSRS |
| 远端同步 | Supabase Auth + Postgres Data API | 仅同步个人数据；公开内容不从数据库读取 |
| PWA | Serwist 自定义 Service Worker | 明确预缓存、运行时缓存、离线包和更新策略 |
| 测试 | Vitest + Testing Library + Playwright + axe-core + pgTAP | 覆盖内容、学习算法、同步、RLS、离线和响应式 |
| 工具链 | Node.js 22+、pnpm、ESLint、Prettier | 锁定依赖并提交 lockfile；TypeScript 使用 5+ |

初始化项目时选择当时仍受维护的稳定版本，在 `package.json`、lockfile 和 `docs/versions.md` 中记录实际版本。不得仅因本文件列出技术名称就使用已停止维护的包。

### 9.2 运行时边界

```text
Git 仓库中的 MDX/来源登记
        |
        v  构建时：校验 -> 编译 -> 生成知识图谱/清单
静态 HTML/CSS/JS + Pagefind 索引 + PWA 资源
        |
        v
浏览器 UI <-> 领域服务 <-> Dexie/IndexedDB（即时写入）
                              |
                              v  后台、可失败、可重试
                     Supabase Auth/Postgres
```

必须保持以下边界：

- Server Components 只用于构建时内容渲染；部署后不依赖 Next.js 服务器、Server Actions 或 Edge Functions。
- UI 不直接散落调用 Dexie 或 Supabase；通过 `repositories` 和 `sync` 层访问，以便测试和替换服务。
- 公开内容和私人数据使用不同的数据通路。公开 MDX 进入 Git，私人数据只能进入 IndexedDB、用户主动导出的文件和启用后的 Supabase。
- 未登录、Supabase 休眠、请求超时或网络断开时，阅读、记录、刷题和复习仍可使用；同步状态单独展示。
- Monaco、Pagefind、图表和 C/WASM 运行器均按功能动态导入，不进入普通内容页首屏包。
- 浏览器不执行来自 MDX 的任意脚本。允许的 MDX 组件使用显式白名单映射。

### 9.3 推荐目录

```text
app/
  (public)/roadmap/ learn/ questions/ labs/
  (private)/review/ quiz/ interview/ notes/ stats/ projects/ settings/
  auth/callback/ offline/
components/
  ui/ content/ learning/ search/ sync/
content/
  lessons/ questions/ quizzes/ cards/ labs/ boot-stages/
  sources.yml
generated/
  content-manifest.json
  knowledge-graph.json
  search-aliases.json
lib/
  content/ db/ domain/ fsrs/ sync/ supabase/ pwa/
workers/
  c-runner.worker.ts
public/
  diagrams/ board-assets/ icons/
scripts/
  build-content.mjs validate-content.mjs check-links.mjs
supabase/
  migrations/ tests/
tests/
  unit/ integration/ e2e/ fixtures/
docs/
  decisions/ versions.md content-authoring.md release-checklist.md
```

`generated/` 只能由脚本生成，CI 必须验证重新生成后没有未提交差异。私人笔记、项目经历、数据库导出、录音和 `.env*` 不得放入 `content/` 或 Git；在 `.gitignore` 中显式列出。

## 10. 内容构建与搜索

### 10.1 构建流水线

1. 扫描 `content/` 和 `sources.yml`，用 Zod 校验 frontmatter 和来源结构。
2. 规范化 slug、平台、标签和中英文别名，拒绝重复 ID/slug。
3. 建立前置依赖和关联图，拒绝悬空引用、自依赖和前置依赖环。
4. 用受限 MDX 组件表编译正文，清理或拒绝原始 HTML、内联脚本和事件属性。
5. 生成内容清单、路线拓扑、题库筛选维度和构建版本号。
6. Next.js 通过 `generateStaticParams` 输出全部公开内容页。
7. 静态导出完成后运行 Pagefind；再检查站内链接、canonical、sitemap 和离线资源清单。

内容版本使用 `contentVersion = <git commit SHA>`。用户进度引用稳定内容 ID，而不是 URL；内容被废弃时保留 ID 映射和迁移表，不能让历史数据成为孤儿。

### 10.2 搜索行为

- 搜索覆盖标题、30 秒回答、正文标题、关键词、缩写、中英文别名、平台和源码符号。
- 默认排序综合全文相关度、`priority: core`、当前学习路线和核验状态；“已核验”可以加权但不能掩盖更精确匹配。
- 结果必须显示类型、所属模块、平台、核验状态和命中片段。
- 筛选维度固定为内容类型、支柱、模块、平台、难度、优先级和核验状态；筛选状态写入 URL。
- 输入少于 2 个字符时展示最近搜索和常用入口，不扫描整个索引。
- 单独维护别名，例如 `互斥锁 -> mutex`、`设备树 -> device tree/DT/DTS`、`上下文切换 -> context switch`。
- CI 使用不少于 30 个中文、英文、缩写和源码符号查询做相关性回归；目标词必须在前 5 条出现。

Pagefind 的中文分词、子路径资源地址和离线缓存必须先做原型验收。若达不到搜索回归标准，保留同一 `SearchProvider` 接口，替换为构建时生成索引的 MiniSearch，不改页面调用方。

## 11. 本地数据模型

### 11.1 Dexie 数据库

数据库名建议为 `embedded-learning-db`。第一版包含下列表：

| 表 | 主键/索引 | 主要数据 | 是否同步 |
|---|---|---|---|
| `appMeta` | `key` | schema、内容版本、迁移结果 | 否 |
| `settings` | `id` | 每日时长、重点、主题、通知设置 | 是 |
| `contentProgress` | `contentId`; `status, updatedAt` | 阅读位置、状态、完成事件投影 | 由事件重建 |
| `notes` | `id`; `contentId, updatedAt` | Markdown 纯文本笔记 | 是 |
| `bookmarks` | `contentId` | 当前收藏状态投影 | 由事件重建 |
| `reviewCards` | `cardId`; `due, state` | FSRS 当前卡片状态 | 可由复习事件重建 |
| `learningEvents` | `id`; `type, entityId, occurredAt` | 完成、收藏、复习等不可变事件 | 是 |
| `quizAttempts` | `id`; `quizId, submittedAt` | 不可变答题记录和评分 | 是 |
| `wrongQuestions` | `questionId`; `status, updatedAt` | 错题状态投影 | 由 attempts 重建 |
| `interviewSessions` | `id`; `startedAt, status` | 会话配置、逐题自评和复盘 | 是 |
| `codeDrafts` | `id`; `labId, updatedAt` | 代码草稿和本地运行摘要 | 默认是 |
| `projectCases` | `id`; `updatedAt` | 私有项目结构化内容 | 是 |
| `recordings` | `id`; `sessionId` | 本机录音 Blob | **永不自动同步** |
| `syncQueue` | `mutationId`; `state, nextAttemptAt` | 待上传变更和重试信息 | 否 |
| `syncMeta` | `key` | 设备 ID、拉取游标、最近成功时间 | 否 |
| `conflicts` | `id`; `recordType, createdAt` | 冲突的本地/远端版本 | 否 |

所有可变记录使用 `crypto.randomUUID()` 生成 ID，并包含 `createdAt`、`updatedAt`、`deletedAt`、`deviceId` 和 `baseVersion`。时间统一保存为 UTC ISO 8601；展示时转换为设置中的 IANA 时区。P0 不自动清理软删除 tombstone；未来若压缩历史，必须设置服务端同步 epoch，并让旧游标设备先做全量同步，避免长期离线设备把已删除数据重新上传。

### 11.2 领域规则

- 学习事件、复习日志和已提交答题记录不可原地修改；纠正通过新增事件完成。
- `contentProgress`、`bookmarks`、`reviewCards` 和 `wrongQuestions` 是投影，可从不可变事件/答题记录重建。
- 笔记、代码草稿和项目经历是可变文档，发生版本冲突时不能用最后写入静默覆盖。
- FSRS 状态由按 `(occurredAt, id)` 排序的复习事件确定；同一事件 ID 重放必须幂等。
- 本地写入和加入 `syncQueue` 必须在同一 Dexie transaction 内完成。
- IndexedDB 不等于备份。设置页始终提供带 schema 版本、导出时间和校验和的 JSON 导出。
- 首次产生重要数据后，在用户手势下尝试 `navigator.storage.persist()`，并用 Storage API 展示已用空间和是否获得持久存储；浏览器可以拒绝，私密模式或清除站点数据也会导致丢失，因此仍需提醒定期导出。

### 11.3 导入导出

导出包至少包含：

```json
{
  "format": "embedded-learning-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-09-08T12:00:00.000Z",
  "contentVersion": "<git-sha>",
  "checksum": "sha256:<hex>",
  "data": {}
}
```

`checksum` 对规范化后的 `data` 字段计算，不包含 `checksum` 自身。导入前完成 schema 校验、版本迁移、记录数量/体积上限和预览；默认“合并”，另提供需要二次确认的“替换本机数据”。校验失败不能部分写入。录音默认不进入 JSON，可由用户单独导出。

## 12. Supabase 与跨设备同步

### 12.1 认证方案

- P0 允许完全不登录。需要跨设备时，用户主动启用 Supabase。
- 个人使用阶段采用邮箱和密码登录：先在 Supabase Dashboard 创建唯一用户，再关闭公开注册。这样日常登录不依赖邮件送达。
- 密码重置可先由项目所有者在 Dashboard 完成；启用邮件重置前必须配置并验证可用 SMTP，不能把 Supabase 默认邮件服务当作生产保证。
- 前端只配置 Project URL 和 publishable/anon key。它们可以公开，但所有安全边界必须由 RLS 实现。
- `service_role`/secret key 只允许人工迁移或受控 CI 环境使用，绝不能出现在浏览器、公开仓库、构建产物或日志中。

### 12.2 远端表

Supabase 只作为同步日志和私有文档副本，推荐两张核心表：

```sql
create table public.user_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'content_completed', 'content_reopened', 'bookmark_set',
    'review_rated', 'quiz_submitted', 'activity_recorded'
  )),
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  device_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.user_documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in (
    'settings', 'note', 'code_draft', 'interview_session', 'project_case'
  )),
  entity_id text not null,
  payload jsonb not null,
  version bigint not null default 1 check (version > 0),
  device_id uuid not null,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, document_type, entity_id)
);

create index user_events_pull_idx
  on public.user_events (user_id, created_at, id);
create index user_documents_pull_idx
  on public.user_documents (user_id, server_updated_at, id);

create function public.touch_user_document_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version <> old.version + 1 then
    raise exception 'document version must increase by exactly one';
  end if;
  new.server_updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger touch_user_document_updated_at
before update on public.user_documents
for each row execute function public.touch_user_document_updated_at();
```

数据库 migration 需要用 trigger 在每次 `user_documents` 更新时覆盖 `server_updated_at = now()`；不能信任客户端传入服务器更新时间。`payload` 在客户端按 document type 使用 Zod 校验，并设置合理体积上限；笔记和项目文档单条建议不超过 256 KiB。

### 12.3 权限与 RLS

每张暴露给 Data API 的表都必须显式启用 RLS、显式授权、按所有权写策略。只写 `TO authenticated` 不构成行级隔离。

```sql
alter table public.user_events enable row level security;
alter table public.user_documents enable row level security;

revoke all on public.user_events from anon, authenticated;
revoke all on public.user_documents from anon, authenticated;
grant select on public.user_events to authenticated;
grant insert (id, user_id, event_type, entity_id, payload, occurred_at, device_id)
on public.user_events to authenticated;
grant select on public.user_documents to authenticated;
grant insert (id, user_id, document_type, entity_id, payload, version,
  device_id, client_updated_at, deleted_at)
on public.user_documents to authenticated;
grant update (payload, version, device_id, client_updated_at, deleted_at)
on public.user_documents to authenticated;

create policy "events_select_own" on public.user_events
for select to authenticated using ((select auth.uid()) = user_id);
create policy "events_insert_own" on public.user_events
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "documents_select_own" on public.user_documents
for select to authenticated using ((select auth.uid()) = user_id);
create policy "documents_insert_own" on public.user_documents
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "documents_update_own" on public.user_documents
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

不使用已弃用的 `auth.role()`。Migration 后必须用两个真实测试用户运行 pgTAP/集成测试，证明 A 用户无法读取、插入、修改 B 用户记录；还要证明 `anon` 无权读取任何私人表。新建表不能假设会自动暴露或自动授权，migration 必须包含明确 grant。

### 12.4 同步协议

同步触发条件：登录完成、页面重新获得网络、应用回到前台、用户点击“立即同步”，以及有待处理变更时的低频后台重试。同步绝不能阻塞当前本地操作。

```text
本地事务提交 -> syncQueue(pending)
  -> 推送不可变事件（按 UUID 幂等插入）
  -> 推送可变文档（带 baseVersion 条件更新）
  -> 分页拉取远端事件/文档
  -> 校验 -> 合并/记录冲突 -> 重建投影
  -> 更新复合游标 -> 标记本轮成功
```

规则：

- 不可变事件重复插入遇到相同 UUID 视为成功；相同 UUID 内容不同视为数据损坏并停止该项同步。
- 新文档从 `version = 1` 插入。更新使用 `id + user_id + version = baseVersion` 条件，并写入 `version = baseVersion + 1`；返回 0 行即发生冲突。
- 同一文档在尚未上传时发生多次本地编辑，队列合并为最新 payload，继续保留“最后一次已确认远端版本”作为 `baseVersion`；不得把每次按键都排成独立远端更新。
- 普通设置可按字段显示本地/远端值后选择；笔记、代码草稿和项目经历必须保存双方副本，并支持“保留本地、保留远端、另存为副本”。
- 拉取使用 `(server_updated_at, id)` 或 `(created_at, id)` 复合游标和固定排序，分页默认 200 条；只有一页全部处理成功才推进游标。
- 离线事件按 `(occurredAt, deviceId, id)` 确定性排序；若客户端时间与服务器接收时间偏差超过 24 小时，提示检查设备时间。多设备对同一卡片的复习事件合并后必须重放 FSRS，确保最终状态收敛。
- 队列采用指数退避并加随机抖动，建议 `5s, 30s, 2m, 10m, 1h`，最长 6 小时；401 停止重试并提示重新登录，校验错误进入 `blocked` 状态等待处理。
- 同步状态至少区分：仅本机、正在同步、已同步、离线待同步、登录失效、存在冲突、远端不可用。不能只用一个云朵图标表达。
- 首次登录合并本机和云端数据，必须先创建自动 JSON 快照；不得默认用空云端覆盖本机。
- 登出只清除会话，不自动删除本机学习数据。用户需要单独选择“移除此设备上的私人数据”。

### 12.5 客户端契约

```ts
type SyncState =
  | "local-only"
  | "syncing"
  | "synced"
  | "offline-pending"
  | "auth-expired"
  | "conflict"
  | "remote-unavailable";

interface SyncMutation {
  mutationId: string;
  kind: "event-insert" | "document-insert" | "document-update";
  recordType: string;
  recordId: string;
  baseVersion: number | null;
  payload: unknown;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
}

interface DataRepository<T> {
  get(id: string): Promise<T | undefined>;
  putLocal(value: T): Promise<void>;
  listChangedSince(cursor?: string): Promise<T[]>;
}

interface SyncEngine {
  run(reason: "login" | "online" | "foreground" | "manual" | "retry"):
    Promise<{ state: SyncState; pushed: number; pulled: number; conflicts: number }>;
}
```

视图只依赖领域 selector/hooks，不以网络请求返回值直接覆盖本地状态。对 Supabase 的超时、错误码和响应 shape 做适配层，避免将 SDK 类型传播到整个应用。

## 13. PWA、离线与更新

### 13.1 缓存分层

| 资源 | 策略 |
|---|---|
| 应用 shell、图标、离线页 | 版本化 precache |
| 已构建的内容 HTML/JSON | `stale-while-revalidate`，按内容版本失效 |
| 搜索运行时代码/基础索引 | 首次搜索时缓存 |
| 用户选择的支柱离线包 | 显式下载，显示大小、版本和删除操作 |
| Monaco/C/WASM | 进入实验室或用户下载实验包时缓存 |
| Supabase Auth/Data API | `network-only`，绝不进入 Cache Storage |
| 私人数据 | IndexedDB，不写入 Service Worker Cache |

Service Worker 不尝试后台上传包含访问令牌的队列；同步由受控页面会话执行。普通移动浏览器会限制后台运行，因此产品只承诺“下次打开且联网时最终同步”，不承诺关闭浏览器后立即同步。

### 13.2 更新策略

- 构建产物包含 `appVersion` 和 `contentVersion`。
- 检测到新 Service Worker 后显示持久更新条；正在答题、编辑笔记或运行代码时不得自动刷新。
- 用户确认更新前先完成本地事务和草稿保存，再激活新 worker 并刷新。
- 数据库 migration 必须可回滚到备份或保持前向兼容；migration 失败时进入只读恢复页，提供导出而不是清空数据库。
- 已下载离线包显示是否过期。新内容版本可增量更新；删除内容时保留历史 ID 映射。

### 13.3 PWA 安装体验

- 提供合法 manifest、192/512 图标、maskable 图标、主题色和独立显示模式。
- 不在首次访问立即弹安装提示；用户完成一次学习或主动进入设置后再给非阻塞入口。
- iOS、Android 和桌面端分别显示符合平台事实的安装状态；不声称所有浏览器都支持相同通知/后台能力。

## 14. SEO 与公开范围

- 只有路线、课程、已公开面试题和公开实验可索引。首页仪表盘、登录回调、复习、测验会话、笔记、统计、设置、项目经历和所有用户标识 URL 均设置 `noindex, nofollow`。
- 每个公开页在构建时生成唯一 `title`、中文 `description`、canonical、Open Graph 基础信息和最后核验日期。
- 自动生成 `sitemap.xml` 和 `robots.txt`；草稿、待审内容和私有路由不进入 sitemap。
- 题库非默认筛选 URL 使用基础题库 canonical；组合筛选默认 `noindex, follow`，避免产生大量重复抓取页面。
- 内容页使用 `TechArticle`/`LearningResource` 与 `BreadcrumbList` JSON-LD。单人维护的题目页不冒充社区 `QAPage`，普通列表不滥用 `FAQPage`。
- 标题围绕用户真实问题，例如“RT-Thread 线程调度与 PendSV 上下文切换”，不堆砌关键词。
- 页面明确展示适用平台、版本、来源和更新时间；变更较大的条目保留更新记录。
- 静态站部署在 GitHub Pages 项目子路径时，canonical、sitemap、Pagefind、manifest 和资源 URL 必须共享同一个 `basePath`。切换自定义域名后重新生成，禁止同时索引两套 canonical。

SEO 不凌驾于学习体验。隐藏答案功能必须仍让静态 HTML 包含可抓取的公开参考内容，并通过可访问的折叠结构展示；不要依赖点击后才从客户端请求正文。

## 15. 安全与隐私

### 15.1 威胁边界

- 最大风险是 XSS 后读取 Supabase 会话和私人 IndexedDB 数据，因此禁止不受控 HTML/脚本，MDX 组件采用白名单，并为外链添加安全属性。
- 私人文本渲染为 Markdown 时必须清理 HTML；默认直接禁用原始 HTML。
- Supabase RLS 是数据隔离边界，隐藏 UI、难猜 ID 和客户端过滤都不是权限控制。
- 公共仓库中的 publishable/anon key 不是密码；`service_role`、数据库密码、SMTP 密钥才是机密，必须使用平台 secret 并定期检查泄漏。
- 不收集不必要的姓名、学校、手机号、位置或简历。项目经历字段由用户主动填写，并在同步前明确标注会上传哪些内容。
- IndexedDB 和 JSON 备份不是端到端加密保险箱；能访问当前系统账户或导出文件的人可能读到数据。备份页必须提示妥善保管，应用内不得保存密码、密钥或公司机密。
- Supabase 同步默认保护“其他普通用户无法访问”，但不是端到端加密。项目经历默认设为“仅本机”，用户逐条改为“同步到我的账户”后才加入队列；录音始终仅本机。

### 15.2 浏览器代码执行

- C 编译器和程序只在专用 Web Worker 中运行；Worker 不暴露网络、DOM、持久文件系统或任意 JS bridge。
- 每次运行创建可终止实例，默认超时 2 秒，题目可在最大 5 秒内调整；stdout/stderr 各限制 64 KiB，源码建议限制 64 KiB。
- WASM memory 设置上限并在低内存设备探测失败后降级。终止后丢弃整个 Worker，不尝试继续使用未知状态的运行时。
- 运行器只用于标准 C/算法练习。不得接受用户上传的原生二进制，不连接真实设备，不把结果描述为 MCU 或 i.MX6ULL 验证。
- WebVM/Judge0 不进入首版。若未来启用，需要单独威胁建模、资源隔离和部署评审。

### 15.3 发布安全

- 部署平台支持时设置 CSP、`X-Content-Type-Options: nosniff`、`Referrer-Policy` 和合理的 `Permissions-Policy`。GitHub Pages 无法完整自定义响应头时，至少使用兼容的 meta CSP，并将该限制记入发布报告。
- CSP 仅开放本站资源、指定 Supabase 域名、所需 Worker 和 WASM 能力；目标是不用 `unsafe-inline`/`unsafe-eval`。Next.js 静态产物若含必要内联脚本，应在构建后生成并验证 CSP hash；做不到时必须记录 GitHub Pages 的受控例外和残余风险，不能配置一个会让页面失效的“严格 CSP”。WASM 只开放更窄的 `wasm-unsafe-eval`（浏览器支持时），不等同于放开通用 `unsafe-eval`。
- 依赖更新通过自动 PR 和 CI 验证，lockfile 必须提交；高危漏洞不得带病发布。
- 日志不得记录 access token、密码、完整笔记、项目经历或源代码；前端错误报告默认只保存在本机，上传前先预览并脱敏。

## 16. 性能预算

在一台中端 Android 真机或等效模拟配置、慢速 4G 下验证：

| 指标 | 普通首页/内容页目标 |
|---|---|
| 首次传输 JS（gzip，不含按需功能） | 不超过 200 KiB |
| 首次传输 CSS（gzip） | 不超过 50 KiB |
| LCP | 小于 2.5 秒 |
| CLS | 小于 0.1 |
| INP | 小于 200 ms |
| 普通内容页离线二次打开 | 小于 1 秒，且无网络错误遮挡正文 |

其他预算：

- 搜索代码和索引按需加载；初始内容库的压缩索引建议不超过 1.5 MiB，超过后按支柱分片。
- Monaco 与 C/WASM 不计入普通页面预算，但首次启用前必须显示下载大小；额外传输目标不超过 25 MiB，超出则改用预编译 Emscripten 实验或桌面限定。
- 长题库使用分页/虚拟化，长文章和非首屏列表使用 `content-visibility`；虚拟化不能破坏键盘导航和浏览器查找。
- 缓存同步读取结果，避免每次 render 重复访问 storage；统计计算放到 memoized selector 或 Worker，不能阻塞输入。
- 不加载第三方分析、广告、聊天或远程字体。图片提供确定尺寸、现代格式和延迟加载，关键技术图不因裁剪丢失信息。

## 17. 测试与验收

### 17.1 自动化测试

| 层 | 必测内容 |
|---|---|
| 内容 CI | schema、ID/slug、依赖环、来源、内链、代码围栏、核验状态、启动阶段字段 |
| 单元测试 | 学习计划、薄弱项、FSRS 适配、投影重建、schema migration、导入校验 |
| 本地集成 | Dexie transaction、刷新恢复、队列幂等、冲突副本、删除 tombstone |
| Supabase | migration、grants、RLS 双用户隔离、anon 拒绝、条件版本更新 |
| 组件 | 键盘操作、焦点、答案展开、筛选 URL、错误/空/加载状态 |
| E2E | 桌面、手机、离线、PWA 更新、登录/登出、跨设备同步、备份恢复 |
| 代码运行器 | 正常输出、编译错误、死循环超时、超量输出、Worker 终止、移动端降级 |
| SEO/质量 | metadata、canonical、sitemap、noindex、JSON-LD、axe、性能预算 |

单元测试使用固定时钟和确定随机种子。FSRS 不重测第三方公式本身，但必须测试评分映射、时区边界、事件重放和依赖升级前后的迁移样本。

### 17.2 核心验收场景

1. 新用户不注册也能选择 60 分钟计划、学习一课、答题、写笔记并刷新恢复。
2. 完整访问并下载一个支柱后断网，仍能打开已缓存内容、完成复习和产生待同步记录。
3. 网络恢复后队列重试成功；重复重试不会生成重复复习记录。
4. 两台设备同时编辑同一笔记时出现可解决冲突，双方文本都没有丢失。
5. Supabase 暂停、超时或登录失效时，页面不白屏且本地写入继续成功。
6. 从 JSON 恢复到全新浏览器后，设置、笔记、进度、错题和 FSRS 到期时间一致。
7. 用户 A 使用浏览器或 API 无法读取/修改用户 B 的任意记录；anon 无法读取私人表。
8. 在 `360px` 手机上，底部导航、筛选、复习评分和长代码无重叠、截断或不可达控件。
9. 屏幕阅读器可识别标题、题目状态和错误原因；仅键盘可完成主要学习流程。
10. C 程序死循环在期限内终止，普通页面不冻结；不支持的设备得到清晰降级选项。
11. 新版本到达时，正在编辑的笔记不被自动刷新打断；确认更新后数据仍存在。
12. 随机抽查一篇 RT-Thread、一篇 MCU 和一篇 BSP 内容，关键结论可回溯到登记的一手来源和固定版本。

### 17.3 人工内容验收

- RT-Thread 调度文章能从线程状态和就绪队列讲到公共调度代码、UP 端口和 Cortex-M PendSV 汇编，并标明 tag/commit 与配置宏。
- IPC 对比覆盖信号量、互斥量、事件、邮箱、消息队列的载荷、唤醒规则、超时、优先级继承和 ISR 限制。
- Linux 启动链可逐阶段回答“谁执行、输入是什么、输出是什么、关键日志在哪里、失败如何定位”。
- ALPHA 板专属的拨码、介质偏移、分区、默认环境、DTS 和 init 脚本在未取得匹配厂商资料前均显示“待板级核验”，不得凭网络文章补值。
- ESP32 内容明确标注具体芯片架构和 ESP-IDF 版本，不归入 Cortex-M3/M4 实现。

实际 UI 完成后必须使用 Playwright 截图检查桌面和手机视口，并检查控制台、网络失败和离线状态。该要求属于开发验收，不在本设计文档阶段伪造截图结果。

## 18. 部署与运维

### 18.1 默认零费用方案

首选：**GitHub Pages 静态站 + Supabase Free 可选同步 + IndexedDB/PWA 本地优先**。

选择理由：公开仓库、静态内容和 GitHub Pages 的使用方式与个人学习/开源目标一致；部署产物没有专有服务器运行时，未来可迁移到其他静态托管。Supabase 只存状态，即使暂停或跨境访问不稳定也不影响本机学习。

必须明确：GitHub Pages、Cloudflare Pages、Vercel Hobby 和 Supabase Free 的官方材料都没有保证中国大陆免费访问速度、可达性或 SLA；Supabase Free 也可能因不活跃暂停且不提供自动备份。因此“稳定”来自离线能力、导出和可迁移部署，不来自对免费平台的口头承诺。

### 18.2 GitHub Pages 发布

- GitHub Actions 使用 Node.js 22、`pnpm install --frozen-lockfile`，依次执行格式检查、lint、typecheck、单元测试、内容校验、静态构建、Pagefind、链接检查和 Pages artifact 上传。
- `next.config` 开启静态导出、`trailingSlash` 和图片 `unoptimized`；项目站通过环境变量统一设置 `/repository-name` base path。
- Actions 固定到受信任版本或 commit。构建中不使用 Supabase service role；Project URL 和 anon/publishable key 可作为公开构建变量。
- Supabase Auth redirect allowlist 同时配置生产 `/auth/callback/` 和本地开发地址，严格使用实际 base path。
- 每次发布保留构建 commit、内容版本、数据库 schema 版本和回滚到上一静态产物的方法。

### 18.3 大陆访问实测与镜像

正式选主站前，把同一静态产物在 GitHub Pages、Cloudflare Pages 和 Vercel Hobby 连续测试 7 至 14 天，覆盖中国移动、联通、电信、家庭宽带和手机网络。记录 DNS、首字节、LCP、失败率、PWA 安装和 Supabase 登录/同步，不以单次测速决定。

如果 GitHub Pages 表现不满足实际使用：

1. 将 Cloudflare Pages 或 Vercel 作为主站，GitHub Pages 保留为镜像。
2. 保持所有平台部署同一 artifact，避免内容分叉。
3. 在设置中提供备用站地址和 JSON 导出入口，但不做会暴露私人 URL 数据的自动跳转。
4. 未来若购买中国大陆云资源和域名，再评估 ICP 备案及境内部署；这已超出“完全免费”边界。

### 18.4 最低维护节奏

- 每月导出一次 Supabase 数据和本机 JSON；重要内容变更前额外备份。
- 每月检查依赖和安全公告，每季度验证恢复流程、外链和三网访问。
- 每次升级 Next.js、Dexie、Supabase SDK、Serwist 或 `ts-fsrs` 前先用真实备份副本跑 migration 和 E2E。
- 托管和免费额度在上线前重查，不能把本文核验日期的额度当作永久合同。

## 19. 实施阶段与完成定义

用户希望尽可能一次设计完整，但开发仍按可运行里程碑交付。每一阶段都必须能启动、测试和演示，不能等到最后才集成。

### 阶段 0：工程基线与黄金内容

- 建立项目、静态导出、样式 token、内容 schema、来源登记和 CI。
- 为五个支柱各完成 1 篇黄金课程、2 道面试题、3 道测验和 1 个代表实验/分析题。
- 完成 RT-Thread 调度和 i.MX6ULL 启动链两份深度样本。

完成定义：所有样本通过内容 CI，页面可从静态产物直接访问，来源和待核验状态显示正确。

### 阶段 1：本地学习闭环

- 完成路线、内容页、题库、搜索、首次设置、每日任务、进度、笔记、收藏、测验、错题和统计。
- 接入 Dexie、`ts-fsrs`、导入导出和 schema migration。

完成定义：不登录、断开 Supabase 也能连续完成一整天学习流程；刷新、关闭浏览器和备份恢复后数据一致。

### 阶段 2：PWA 与离线

- 完成 manifest、Service Worker、离线包、更新提示和容量管理。
- 在桌面/Android/iOS 可用范围内验证安装和离线场景。

完成定义：核心离线 E2E 通过，新版本不打断正在进行的学习，缓存可查看并删除。

### 阶段 3：账号与同步

- 建立 Supabase migration、RLS、认证、队列、游标、重试、冲突解决和同步状态 UI。
- 完成双用户安全测试和两设备冲突测试。

完成定义：所有 12.4 同步规则有测试；远端故障不阻塞本地；JSON 备份和恢复演练通过。

### 阶段 4：模拟面试与代码实验

- 完成面试配置、计时、自评、复盘和本地录音。
- 动态加载 Monaco 和浏览器 C runner；实现 Worker 限制及降级。

完成定义：代码 runner 的正常、错误、死循环和低内存场景通过；录音从不自动同步。

### 阶段 5：项目经历模块与内容扩充

- 实现私有项目模板、知识点关联和确定性追问模板。
- 用户提供真实经历后再录入，不生成虚构内容。
- 内容库逐步达到至少 40 篇课程、200 道面试题、250 道测验和 20 个实验。

完成定义：私人字段不进入静态产物或仓库；每批内容通过来源核验和内容 CI。

### 阶段 6：发布选择

- 完成性能、可访问性、SEO、三网和多托管实测。
- 选择主站和镜像，完成恢复演练及发布清单。

完成定义：第 16、17、18 章的预算和验收满足，未满足项有明确降级或书面风险记录。

## 20. 交给开发 AI 的执行指令

可将本文件与 `embedded-learning-platform-research.md` 一起放入空仓库，并把下面内容作为开发任务开头：

```text
你要实现《嵌入式软件系统化学习平台设计文档》定义的完整产品。

执行要求：
1. 先完整阅读设计文档和研究文件，列出不可协商约束、未知项和阶段 0 的文件计划；不要擅自改成有服务器依赖的架构。
2. 使用 Node.js 22+、Next.js App Router、TypeScript、Tailwind、MDX、Dexie、ts-fsrs、Supabase 和静态导出。选择当前受维护稳定版本，固定依赖和 lockfile，并记录版本。
3. 按阶段 0 到阶段 6 实施。每一阶段必须运行相应 lint、typecheck、unit/integration/E2E/content 测试，报告实际命令和结果，再进入下一阶段。
4. 本地 IndexedDB 是即时事实来源；Supabase 只是可选异步同步。任何网络失败都不能阻塞学习和本地保存。
5. 公开内容写入 content/，私人笔记、学习数据、录音、实习和项目经历绝不能写入 Git 或静态构建产物。
6. 所有 Supabase 表显式 grant、启用 RLS 并验证双用户隔离；浏览器内禁止 service role/secret key。
7. 不虚构已核验内容、板卡参数或个人经历。AI 草稿保持 draft；只有一手资料逐条核对后才能设为 verified。
8. ESP32 独立于 Cortex-M3/M4；STM32/GD32、主线 Linux/NXP BSP/正点原子板级差异必须分层。
9. Monaco、Pagefind 和 C/WASM runner 按需加载。C 程序只在可终止 Worker 中运行，不能宣称模拟 MCU/RTOS/板卡。
10. UI 遵循第 8 章：克制的技术学习工具，不做营销首页、渐变、玻璃效果、装饰性卡片和无意义动效。
11. 每次修改保持范围清楚，不删除已有用户数据或用清库掩盖 migration 问题。发现设计冲突时先提供证据和最小决策项。
12. 最终交付 README、环境变量示例、Supabase migrations/tests、内容编写指南、部署流程、备份恢复流程、测试报告和已知限制。

第一步只做阶段 0 和阶段 1 的可运行实现；验收通过后继续后续阶段。产品范围不能缩水，但要用阶段检查点控制返工。
```

## 21. 已知风险与待确认项

以下项目不阻塞工程脚手架，但在相关内容或发布前必须确认：

| 项目 | 当前处理 | 最晚确认时间 |
|---|---|---|
| 网站正式名称、仓库名、域名 | 使用工作名和可配置 base path | 首次公开发布前 |
| RT-Thread 目标版本/commit | 内容必须显式占位，不写“当前版本” | RT-Thread 黄金内容核验前 |
| 正点原子 ALPHA 板硬件版本和教程版本 | 板级细节标记待核验 | BSP 板级实验发布前 |
| STM32/GD32 具体料号 | 黄金内容先选 F1/M3、F4/M4 代表料号并标注 | 对应寄存器内容发布前 |
| ESP32 具体型号 | 默认经典 ESP32 作为独立示例，禁止外推 | ESP32 内容发布前 |
| Pagefind 中文检索效果 | 以查询回归集做原型，保留 provider 替换点 | 阶段 1 搜索验收前 |
| 浏览器 C 编译器体积/移动端内存 | 原型后选择任意源码或预编译实验 | 阶段 4 开始前 |
| 主托管平台 | 默认 GitHub Pages，三网实测后可调整 | 阶段 6 |
| Supabase Free 休眠和额度变化 | 本地优先、JSON 备份，发布前重查 | 阶段 3 和每次发布 |

## 22. 一手资料登记起点

完整核验说明与更多链接见 `embedded-learning-platform-research.md`。内容库的 `sources.yml` 至少先登记以下来源：

| 建议 source ID | 一手资料 |
|---|---|
| `c-wg14-n1570` | [WG14 N1570 C11 草案](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf) |
| `arm-cortex-m3-guide` | [Arm Cortex-M3 Generic User Guide](https://developer.arm.com/documentation/dui0552/latest/) |
| `arm-cortex-m4-guide` | [Arm Cortex-M4 Generic User Guide](https://developer.arm.com/documentation/dui0553/latest/) |
| `arm-cmsis-core` | [CMSIS-Core](https://arm-software.github.io/CMSIS_6/latest/Core/index.html) |
| `stm32f1-rm0008` | [STM32F1 RM0008](https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) |
| `stm32f4-rm0090` | [STM32F4 RM0090](https://www.st.com/resource/en/reference_manual/rm0090-stm32f405415-stm32f407417-stm32f427437-and-stm32f429439-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) |
| `gd32f103-product` | [GigaDevice GD32F103 产品资料](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) |
| `esp-idf-guide` | [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/) |
| `rtt-thread-manual` | [RT-Thread 线程管理手册](https://github.com/RT-Thread/rtthread-manual-doc/blob/master/thread/thread.md) |
| `rtt-scheduler-source` | [RT-Thread scheduler_comm.c](https://github.com/RT-Thread/rt-thread/blob/master/src/scheduler_comm.c) 与 [scheduler_up.c](https://github.com/RT-Thread/rt-thread/blob/master/src/scheduler_up.c) |
| `rtt-ipc-source` | [RT-Thread ipc.c](https://github.com/RT-Thread/rt-thread/blob/master/src/ipc.c) |
| `rtt-cortexm-context` | [Cortex-M4 context_gcc.S](https://github.com/RT-Thread/rt-thread/blob/master/libcpu/arm/cortex-m4/context_gcc.S) |
| `nxp-imx6ull` | [NXP i.MX6ULL 产品与文档](https://www.nxp.com/products/i.MX6ULL) |
| `uboot-bootz` | [U-Boot bootz 文档](https://docs.u-boot.org/en/latest/usage/cmd/bootz.html) |
| `linux-arm-boot` | [Linux ARM 启动协议](https://docs.kernel.org/arch/arm/booting.html) |
| `linux-devicetree` | [Linux DeviceTree Usage](https://docs.kernel.org/devicetree/usage-model.html) |
| `linux-init-source` | [Linux init/main.c](https://github.com/torvalds/linux/blob/master/init/main.c) |
| `buildroot-manual` | [Buildroot Manual](https://buildroot.org/downloads/manual/manual.html) |
| `yocto-docs` | [Yocto Project Documentation](https://docs.yoctoproject.org/) |
| `alientek-alpha-entry` | [正点原子 ALPHA 开发板资料入口](https://www.openedv.com/docs/boards/arm-linux/zdyz-i.mx6ull.html) |
| `supabase-rls` | [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) |
| `supabase-api-keys` | [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys) |
| `github-pages-limits` | [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| `emscripten-about` | [Emscripten introduction](https://emscripten.org/docs/introducing_emscripten/about_emscripten.html) |

来源登记必须保存标题、组织、URL、文档版本或 commit、访问日期、适用平台和许可/引用备注。GitHub `master` 链接用于发现最新实现；被具体内容引用时必须替换或补充固定 tag/commit 的永久链接。

---

本设计的核心取舍是：内容可追溯、学习数据本地优先、同步可降级、嵌入式平台边界明确。开发过程中若某项实现与这四条冲突，应优先修正实现，而不是弱化这些约束。
