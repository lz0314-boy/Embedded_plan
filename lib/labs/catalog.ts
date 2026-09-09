export type CodeLabDefinition = {
  labId: string;
  mode: "standard-c" | "analysis";
  starterCode?: string;
  stdin?: string;
  boundary: string;
};

export const codeLabDefinitions: Record<string, CodeLabDefinition> = {
  "c-memory-lab": {
    labId: "c-memory-lab",
    mode: "standard-c",
    starterCode: "#include <stdio.h>\n\nint main(void) {\n    int value = 42;\n    printf(\"value=%d\\n\", value);\n    return 0;\n}\n",
    boundary: "这是标准 C/WASI 练习，不代表 Cortex-M、RT-Thread 或 i.MX6ULL 上的 ABI、时序和硬件行为。",
  },
  "cortex-m-stack-lab": { labId: "cortex-m-stack-lab", mode: "analysis", boundary: "Cortex-M 栈帧只做架构资料推演，不能在浏览器中模拟真实异常时序。" },
  "imx6ull-boot-log-lab": { labId: "imx6ull-boot-log-lab", mode: "analysis", boundary: "ALPHA 拨码、偏移、分区、DTS 和脚本仍待对应板卡版本的官方资料核验。" },
  "linux-process-lab": { labId: "linux-process-lab", mode: "analysis", boundary: "Linux/POSIX 代码只做阅读和推演；实际 libc、内核和设备行为需在目标系统验证。" },
  "rtt-scheduler-lab": { labId: "rtt-scheduler-lab", mode: "analysis", boundary: "RT-Thread 调度源码实验必须绑定具体 tag/commit；浏览器不模拟 RTOS 内核。" },
};
