# ALPHA V2.4 资料核验边界

本记录只保存可公开复查的资料范围，不保存用户本机资料路径、录音、学习数据或项目经历。

## 已确认

- 用户提供的资料目录包含 `IMX6ULL_ALPHA_V2.4(底板原理图).pdf`。
- 资料更新记录显示，2022-08-09 的资料版本增加 V2.4 底板原理图，并更新 U-Boot、Linux、出厂固件和用户快速体验资料以适配 V2.4 新底板。
- `mfgtool(study)说明.txt` 说明该工具用于驱动开发教程，不等于完整生产系统；eMMC 与 NAND 使用不同的 VBS 脚本。
- 教程镜像中可见 `imx6ull-alientek-emmc.dtb`、`imx6ull-alientek-nand.dtb`、`u-boot-emmc.imx`、`u-boot-nand.imx` 和 `zImage`；教程内核源码名为 `linux-imx-rel_imx_4.1.15_2.1.0_ga_alientek`。

## 仍待逐项核验

以下内容不能从版本对应关系推导，必须在发布板级实验前逐项对照 V2.4 官方资料和实际介质：

- 启动拨码、Boot Mode 和供电时序。
- SD、eMMC、NAND 的写入偏移、分区表和介质差异。
- U-Boot `bootcmd`、`bootargs`、环境变量默认值和脚本路径。
- DTS/DTSI 文件、外设复用、屏幕、网络和存储节点。
- 具体镜像、U-Boot、内核、根文件系统的版本组合和实际启动日志。

因此本项目不会因为资料目录存在就把 ALPHA 板级条目标成 `verified`。
