<!-- APCF-META {"schema":1,"visibility":"public"} -->
# 1. REG-0002 GDS 完整解析被容量门槛错误阻断

- **Status**：ACTIVE
- **对象**：公开浏览器 GDS / GDS2 / GDSII 导入、层级展开与实例化显示

## 1.1. Trigger

合法版图超过旧文件大小、记录、层级、实例、几何或批次门槛

## 1.2. Original Failure

解析器把容量门槛当作文件错误，并退回没有几何的单元目录；用户无法看到完整顶层

## 1.3. Impact

较小文件也可能含大量重复实例，按文件大小或批次判断会拒绝实际可显示的输入

## 1.4. Root Cause

固定容量断言与 PreviewLimitError 的空目录回退共同阻断完整路径；解析任务还共享了 glTF 的大小与超时限制

## 1.5. Fix Mechanism

取消 GDS 人为容量拒绝，按几何规模选择平铺或复用存储，显式遍历层级，发送阶段进度并保留用户取消；损坏记录、循环引用、非法数值仍拒绝；实例包围范围使用源几何的凸包求精确范围，画布复用材质与矩阵并先筛选拾取范围

## 1.6. Scope / Non-Scope

适用于完整且有效的 GDS 层级及重复几何；不承诺无限硬件容量，不自动补齐源文件缺失的定义，不改变 glTF / GLB 限制

## 1.7. Long-term Regression / Objective Pass Criterion

合成输入跨越旧容量门槛，完整计数与展开范围一致；损坏输入仍报错；长任务可取消并保留已有文件；完整实例显示及拾取可用；不得恢复空目录容量回退

## 1.8. Related Tests / Turn / REG

- 自动测试：`apps/web/tests/public/gds-performance.spec.ts`、`instancing.spec.ts`、`import-performance.spec.ts`、`renderer-performance.spec.ts`、`parsers.spec.ts`、`workbench.spec.ts`
- 关联轮次：`TR-0003_20261009T022233-0700_full-gds-performance`
