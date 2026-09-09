# 嵌入式学习平台：一手资料核验与技术约束

> 核验日期：2026-09-08。本文只记录可供产品设计引用的研究结论，不是产品设计文档。托管平台额度和条款会变化，开发与上线前须重新检查链接页面。

## 1. RT-Thread 内核学习范围

### 应覆盖的知识主线

1. **线程与调度**：线程状态和生命周期、优先级、同优先级时间片、就绪队列/位图、抢占时机、调度锁、tick 与超时、空闲线程；再沿 Cortex-M 的 PendSV 路径学习寄存器保存、栈切换和恢复。RT-Thread 官方手册给出线程模型，当前上游实现已拆分为公共调度、UP 和 SMP 文件，因此内容不能只照旧文章讲单一 `scheduler.c`。[线程手册](https://github.com/RT-Thread/rtthread-manual-doc/blob/master/thread/thread.md)；[scheduler_comm.c](https://github.com/RT-Thread/rt-thread/blob/master/src/scheduler_comm.c)；[scheduler_up.c](https://github.com/RT-Thread/rt-thread/blob/master/src/scheduler_up.c)；[thread.c](https://github.com/RT-Thread/rt-thread/blob/master/src/thread.c)；[clock.c](https://github.com/RT-Thread/rt-thread/blob/master/src/clock.c)；[Cortex-M3 context_gcc.S](https://github.com/RT-Thread/rt-thread/blob/master/libcpu/arm/cortex-m3/context_gcc.S)；[Cortex-M4 context_gcc.S](https://github.com/RT-Thread/rt-thread/blob/master/libcpu/arm/cortex-m4/context_gcc.S)
2. **同步与 IPC**：临界区、信号量、互斥量及优先级继承、事件集、邮箱、消息队列；题目应比较“同步”和“传数据”、阻塞/超时、FIFO/按优先级唤醒、ISR 可调用限制。官方手册分别覆盖同步与通信，核心对象实现集中在 `src/ipc.c`。[同步手册](https://github.com/RT-Thread/rtthread-manual-doc/blob/master/thread-sync/thread-sync.md)；[通信手册](https://github.com/RT-Thread/rtthread-manual-doc/blob/master/thread-comm/thread-comm.md)；[ipc.c](https://github.com/RT-Thread/rt-thread/blob/master/src/ipc.c)
3. **定时器与时钟**：tick、线程延时、硬定时器和软定时器、周期/单次模式、回调上下文、超时队列；源码同时含硬定时器列表和可选软定时器线程，适合做调用链题。[定时器手册](https://github.com/RT-Thread/rtthread-manual-doc/blob/master/timer/timer.md)；[timer.c](https://github.com/RT-Thread/rt-thread/blob/master/src/timer.c)；[clock.c](https://github.com/RT-Thread/rt-thread/blob/master/src/clock.c)
4. **内存**：静态/动态对象、线程栈、small-memory heap、memheap、mempool、slab 的目标、碎片、确定性和适用场景。当前源码保留多种分配器，内容必须注明编译配置，不能笼统描述为“RT-Thread 的唯一 malloc 算法”。[内存手册](https://github.com/RT-Thread/rtthread-manual-doc/blob/master/memory/memory.md)；[mem.c](https://github.com/RT-Thread/rt-thread/blob/master/src/mem.c)；[memheap.c](https://github.com/RT-Thread/rt-thread/blob/master/src/memheap.c)；[mempool.c](https://github.com/RT-Thread/rt-thread/blob/master/src/mempool.c)；[slab.c](https://github.com/RT-Thread/rt-thread/blob/master/src/slab.c)
5. **中断与移植**：中断入口/退出、嵌套、ISR 与线程上下文的边界、临界区、PendSV/SysTick、首次线程启动、栈帧和 FPU 上下文。通用规则读中断手册，具体上下文切换必须跟对应 `libcpu` 端口，而不是只读 API。[中断手册](https://github.com/RT-Thread/rtthread-manual-doc/blob/master/interrupt/interrupt.md)；[irq.c](https://github.com/RT-Thread/rt-thread/blob/master/src/irq.c)；[Cortex-M4 cpuport.c](https://github.com/RT-Thread/rt-thread/blob/master/libcpu/arm/cortex-m4/cpuport.c)

**对内容设计的约束**：每篇“内部机制”文章固定绑定 RT-Thread tag/commit、配置宏和目标架构；采用“概念 -> 关键结构体 -> API -> 调用链 -> Cortex-M 汇编 -> 实验/追问”的顺序。手册仓库适合概念层，上游当前源码才是实现事实来源。

## 2. i.MX6ULL 从上电到用户程序

### 可由芯片、U-Boot 和 Linux 官方资料确认的通用链路

1. **上电/复位 -> 芯片 Boot ROM**：i.MX6ULL 是 Cortex-A7 应用处理器；内部 ROM 根据 boot mode/fuse/strap 选择串行下载或内部启动，并解析启动镜像中的 IVT、Boot Data、DCD 与入口等信息。寄存器、启动设备顺序和镜像字段必须以 NXP `IMX6ULLRM` 的 System Boot 章为准。[NXP i.MX6ULL 产品与文档入口](https://www.nxp.com/products/i.MX6ULL)；[IMX6ULLRM 官方下载入口（可能要求登录）](https://www.nxp.com/webapp/Download?colCode=IMX6ULLRM)
2. **Boot ROM -> U-Boot（或可选 SPL -> U-Boot proper）**：是否存在 SPL、镜像容器形式和介质偏移是板级构建选择，不能把某一开发板流程写成 SoC 固有流程。NXP 维护的 i.MX U-Boot fork 和上游 U-Boot 是实现依据。[NXP uboot-imx](https://github.com/nxp-imx/uboot-imx)；[上游 U-Boot SPL 文档](https://docs.u-boot.org/en/latest/develop/spl.html)
3. **U-Boot -> Linux**：对 i.MX6ULL 的 32 位 ARM `zImage`，U-Boot `bootz` 接收内核地址，以及可选 initrd 和 FDT 地址；实际 `bootcmd` 负责从 SD/eMMC/NAND/网络加载内核、DTB 和可能的 initramfs，并由 `bootargs` 提供控制台与 root 参数。[U-Boot bootz](https://docs.u-boot.org/en/latest/usage/cmd/bootz.html)；[U-Boot environment](https://docs.u-boot.org/en/latest/usage/environment.html)
4. **Linux 早期启动 -> 驱动 -> 根文件系统**：ARM 启动协议规定 bootloader 传递机器信息/设备树并跳入内核；内核解压、建立内存管理和调度等子系统，按设备树匹配/探测驱动，再挂载 `root=` 指定的根文件系统。[Linux ARM booting](https://docs.kernel.org/arch/arm/booting.html)；[Linux devicetree usage](https://docs.kernel.org/devicetree/usage-model.html)；[init/do_mounts.c](https://github.com/torvalds/linux/blob/master/init/do_mounts.c)
5. **PID 1 -> 服务/用户应用**：内核 `kernel_init` 最终尝试执行指定的 init，或依次尝试 `/sbin/init`、`/etc/init`、`/bin/init`、`/bin/sh`；之后究竟由 BusyBox init 脚本、systemd unit、shell 还是用户手工启动应用，属于根文件系统策略。[Linux init/main.c](https://github.com/torvalds/linux/blob/master/init/main.c)
6. NXP 的 BSP、内核、Yocto layer 分别有官方仓库；网站应把“主线 Linux 原理”“NXP BSP 差异”“正点原子板级改动”分栏，避免版本混写。[NXP Linux BSP 入口](https://www.nxp.com/design/design-center/software/embedded-software/i-mx-software/embedded-linux-for-i-mx-applications-processors:IMXLINUX)；[linux-imx](https://github.com/nxp-imx/linux-imx)；[meta-imx](https://github.com/nxp-imx/meta-imx)

### 必须标为“正点原子 ALPHA 板专属，待厂商资料核验”

- 启动拨码/BOOT_CFG 的实际接法与上电电源时序。
- SD、eMMC 或 NAND 中 U-Boot 的确切写入偏移、分区表、文件名和升级工具。
- 正点原子 U-Boot 分支、defconfig、`bootcmd`/`bootargs` 默认值。
- ALPHA 的 DTS/DTSI 文件名、LCD/触摸/网卡等板载器件节点和驱动补丁。
- 根文件系统采用 BusyBox init 还是其他 init、启动脚本路径，以及演示程序如何自启动。

这些值应从“与手中板卡版本和教程版本完全一致”的 ALIENTEK 官方手册、配套源码和出厂镜像提取；没有拿到这些材料前，设计文档只能列核验任务，不能填入网络教程中的常见偏移或命令。正点原子官方文档入口可作为检索起点：[ALPHA 开发板资料入口](https://www.openedv.com/docs/boards/arm-linux/zdyz-i.mx6ull.html)。

## 3. 免费托管与跨设备同步

### 官方条款/额度（截至核验日期）

| 候选 | 官方可确认事实 | 对本项目的判断 |
| --- | --- | --- |
| GitHub Pages | GitHub Free 个人账户在**公开仓库**可用 Pages；它只托管静态 HTML/CSS/JS。发布站点上限 1 GB，软带宽上限 100 GB/月，普通 Pages 构建软上限 10 次/小时；Pages 不允许被当作商业交易或 SaaS 的免费主机。[GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans#github-free-for-personal-accounts)；[What is Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)；[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | 最贴合“个人学习 + 开源 + 零费用”，但必须静态导出；登录和同步直接调用外部 BaaS。 |
| Cloudflare Pages | Free 当前为每月 500 次构建、每次 20 分钟、单项目 20,000 文件、单文件 25 MiB、每项目 100 个自定义域名；Pages Functions 消耗 Workers 配额。[Pages limits](https://developers.cloudflare.com/pages/platform/limits/) | 静态站可用，额度足够个人项目。不要因“global network”文案推导出中国大陆可用性保证。 |
| Vercel Hobby | Hobby 为免费层且限**个人、非商业**使用；当前表列 200 项目、100 deployments/day、最多 1,000,000 Edge Requests 等，超出 Hobby 用量时通常暂停相应能力直至滚动期恢复。[Hobby plan](https://vercel.com/docs/plans/hobby) | Next.js 集成最省事，个人项目符合用途；若未来商业化必须重新核对/升级。 |
| Supabase Free | 当前为最多 2 个 active projects；每项目 500 MB 数据库、1 GB 文件、5 GB egress，含 50,000 MAU；**连续一周无活动会暂停**，Free 无自动备份且只有社区支持。[Supabase pricing](https://supabase.com/pricing) | 足够单人账号、收藏、笔记、进度、错题和复习调度，但不是“永不休眠/有 SLA”的免费保证；需要数据导出与本地降级。 |

### 中国大陆约束与选择结论

- Cloudflare 官方明确说其**境内** China Network 是 Enterprise 客户的独立订阅，且接入 apex domain 需要有效 ICP 备案/许可证；因此 Free Pages 不应被表述为包含境内节点。[Cloudflare China Network](https://developers.cloudflare.com/china-network/)
- Vercel 官方当前 compute region 列表含香港、东京、新加坡等，但没有中国大陆 region；Supabase可选 AWS 区域含东京、首尔、新加坡，也没有中国大陆 region。[Vercel regions](https://vercel.com/docs/regions)；[Supabase regions](https://supabase.com/docs/guides/platform/regions)
- GitHub Pages 的官方功能/限额页没有承诺中国大陆节点、特定运营商可达性或免费层 SLA。由此只能得出：**上述四个免费方案都不能仅凭官方材料保证中国大陆“稳定且快速”**，不能在设计文档中写未经测试的速度或可用率。
- 建议采用“静态优先 + 本地优先同步”：内容构建为纯静态文件；学习状态先写 IndexedDB，再异步写 Supabase，失败时保留队列；提供 JSON 导入/导出。这样 Supabase 暂停或跨境链路暂时失败时仍可复习。
- 浏览器直连 Supabase 时，公开 schema 中的个人学习表必须启用 Row Level Security，并用 `auth.uid()` 限定用户只能访问自己的行；前端只能持有 publishable/anon key，不能暴露 service role key。[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)；[Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
- 上线前将同一静态产物同时放到 GitHub Pages、Cloudflare Pages、Vercel Hobby 做 7--14 天实测，至少覆盖中国移动/联通/电信和手机网络，再择一为主站。当前默认建议是 **GitHub Pages（公开、开源、最少平台耦合）+ Supabase Free（仅状态同步）**；若 Next.js 必须使用服务器功能再选 Vercel。此为工程建议，不是平台可用性承诺。

## 4. 各知识域应绑定的一手资料

| 知识域 | 首选一手资料 | 内容边界 |
| --- | --- | --- |
| C 语言 | ISO/IEC JTC1/SC22/WG14 的公开 C11 最终草案 [N1570](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf) 与 [WG14 文档索引](https://www.open-std.org/jtc1/sc22/wg14/www/docs/)；工具链行为查 [GCC manuals](https://gcc.gnu.org/onlinedocs/) | 将“标准 C”“实现定义/未指定/未定义行为”“GCC 扩展”分开；代码题注明 `-std`、编译器版本和警告参数。 |
| Cortex-M3/M4 | Arm [Cortex-M3 Generic User Guide](https://developer.arm.com/documentation/dui0552/latest/)；[Cortex-M4 Generic User Guide](https://developer.arm.com/documentation/dui0553/latest/)；[CMSIS-Core](https://arm-software.github.io/CMSIS_6/latest/Core/index.html) | 架构/异常/NVIC/栈帧读 Arm；芯片寄存器值仍回到具体 MCU reference manual。 |
| STM32 | STM32F1 [RM0008](https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)、STM32F4 [RM0090](https://www.st.com/resource/en/reference_manual/rm0090-stm32f405415-stm32f407417-stm32f427437-and-stm32f429439-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)、具体料号 datasheet/errata、[STM32Cube MCU packages](https://github.com/STMicroelectronics) | 题目必须带系列/料号；不要把 F1 与 F4 的时钟树、DMA、总线和寄存器混写。 |
| ESP32 | [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/)、[ESP32 Technical Reference Manual](https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf)、[esp-idf source](https://github.com/espressif/esp-idf) | 经典 ESP32 使用 Xtensa LX6，并非 Cortex-M3/M4；内容单列 ESP-IDF/FreeRTOS 生态，不把 STM32/RT-Thread 结论套用过去。芯片架构见 [ESP32 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf)。 |
| GD32 | GigaDevice 具体系列产品页及其 datasheet、user manual、firmware library，例如 [GD32F103](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32f10x-series/gd32f103) | 虽与部分 STM32 型号相似，也必须依据 GD32 官方手册写时钟、Flash、外设和勘误，禁止把“兼容”当作完全相同。 |
| Linux 用户态 | Linux [man-pages](https://www.kernel.org/doc/man-pages/)；The Open Group [POSIX.1-2024](https://pubs.opengroup.org/onlinepubs/9799919799/)；[glibc manual](https://www.gnu.org/software/libc/manual/) | 区分 POSIX 接口、Linux 特有 syscall 和 glibc 封装；网络、进程、线程、IPC、文件 I/O 均标注层级。 |
| Linux BSP/驱动 | [Linux kernel docs](https://docs.kernel.org/)、[Linux source](https://github.com/torvalds/linux)、[U-Boot docs](https://docs.u-boot.org/en/latest/)、[Yocto docs](https://docs.yoctoproject.org/)、[Buildroot manual](https://buildroot.org/downloads/manual/manual.html)、NXP `linux-imx`/`meta-imx` | 主线与 NXP vendor tree 分开；每篇记录 kernel/U-Boot/BSP release、defconfig、DTS 和 commit。 |

**内容可信度机制**：每个知识条目至少保存 `sourceUrls[]`、`sourceType`、`target/platform`、`versionOrCommit`、`verifiedAt`、`reviewStatus`；AI 生成只能进入 `draft`，涉及寄存器值、ISR 限制、启动偏移、ABI 或命令参数时，没有一手来源不得发布为“已核验”。

## 5. 浏览器内 C 代码执行

### 可行方案

1. **预编译练习：Emscripten -> WebAssembly（首选用于固定实验）**。Emscripten 官方工具链把 C/C++ 编译为 WebAssembly，并生成浏览器运行所需支持代码；适合预先准备的算法、内存和标准库示例，纯静态托管即可。[Emscripten introduction](https://emscripten.org/docs/introducing_emscripten/about_emscripten.html)；[WebAssembly security model](https://webassembly.org/docs/security/)
2. **任意源码、纯浏览器：Runno/浏览器内 WASI 工具链（需原型验证）**。Runno 的上游项目声明通过 WebAssembly 在浏览器运行包括 C/C++ 在内的语言，并提供 Web Component/API；优点是无需执行服务器，代价是运行时/编译器资源较大，移动端首载、内存、兼容性和项目维护活跃度必须实际验收。[Runno source/README](https://github.com/taybenlor/runno)
3. **完整浏览器 Linux：WebVM（重型备选）**。WebVM 在浏览器运行客户端 Linux 环境，适合演示 shell/GCC，但资源体积和运行成本显著高于单题 runner；其部署还要求 Cross-Origin Isolation 等条件，应只作为独立实验室按需加载。[WebVM source/README](https://github.com/leaningtech/webvm)
4. **服务端判题：自托管 Judge0（能力强但不符合“零运维”）**。Judge0 提供沙箱编译/执行 HTTP API 和资源限制，适合隐藏测试、超时、内存限制及多语言；但自托管需要容器、持续计算、隔离加固、限流和监控，稳定免费托管很难保证，不应依赖公共实例作为生产 SLA。[Judge0 documentation](https://ce.judge0.com/)；[Judge0 source](https://github.com/judge0/judge0)

### 必须写入产品设计的边界

- WebAssembly/WASI 练习环境不是 Cortex-M 或 i.MX6ULL：指针宽度、ABI、链接脚本、启动代码、内存映射寄存器、中断、DMA、缓存和硬实时行为都不同。在线运行结果只能用于 C 语法、算法、标准库子集和部分 Linux/POSIX 模拟，不作为板端结论。
- 第一版建议：Monaco/CodeMirror 编辑器 + Web Worker 中的浏览器 runner + stdout/stderr + 超时终止 + 预定义测试；运行器按需下载并缓存。MCU/BSP 题采用代码阅读、编译诊断、寄存器推演或“下载到真板实验”步骤。
- 若纯浏览器 C 编译器在目标 Android/iOS 设备上达不到加载与内存验收线，功能应降级为预编译 Emscripten 实验；Judge0 留到有可维护服务器预算后再启用。

## 可直接交给主设计文档的结论

1. 内容架构用“通用原理 -> RT-Thread/芯片实现 -> 正点原子板级实例”，且所有底层条目版本化、可追溯。
2. i.MX6ULL 启动链先写 NXP/U-Boot/Linux 可证实的通用链；ALPHA 的拨码、偏移、分区、环境变量、DTS 和 init 脚本设为厂商资料核验清单。
3. 零费用方案采用纯静态站 + local-first 学习状态 + Supabase 异步同步/导出备份；不宣称任何海外免费平台在中国大陆有稳定性保证，以多运营商实测选主站。
4. 在线 C 执行默认定位为语法/算法练习；优先纯浏览器隔离并按需加载，真实嵌入式行为由真板实验验证。
