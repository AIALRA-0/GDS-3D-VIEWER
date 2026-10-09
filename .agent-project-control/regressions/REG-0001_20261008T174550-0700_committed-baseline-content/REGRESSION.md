<!-- APCF-META {"schema":1,"visibility":"public"} -->
# 1. REG-0001 提交后的初始内容误判

- **Status**：ACTIVE
- **Created**：20261008T174550-0700
- **对象**：`scripts/routing_activity.py` 的提交活动采集

## 1.1. Trigger

执行轮次开始时工作树已有文件，随后仅提交这些相同内容，实际正文没有发生变化

## 1.2. Original Failure

提交路径被无条件并入当前改动路径，导致已保护的原始规范也被当成本轮可编辑正文，正式内容验收产生无关拒绝

## 1.3. Impact

框架接入后的真实动作可以完成提交，但收口和发布会因错误的正文归属受阻，容易诱发对原始规范的无关改写

## 1.4. Root Cause

提交路径采集只看 Git 历史差异，没有继续比较执行轮次不可变基线中已有文件的当前状态

## 1.5. Fix Mechanism

提交路径仅在基线没有该对象或当前状态与基线不同时计入正文改动，HEAD 移动仍独立触发交付义务，发布检查继续覆盖全部实际传输提交

## 1.6. Scope / Non-Scope

适用于已创建不可变活动基线的现有 Git 项目，不适用于没有基线的新对象排除；后来修改、新增和删除的对象仍按实际变化处理，本机制不豁免中间提交的秘密审查

## 1.7. Long-term Regression / Objective Pass Criterion

运行 `python -B .agent-project-control/scripts/selfcheck.py`，其中 `Step1D/51` 创建独立 Git 夹具

通过必须同时满足四项断言：初始相同内容提交后不列为正文修改，初始文件后来修改并提交仍被列出，基线后新增并提交的文件仍被列出，HEAD 移动仍要求交付路由

## 1.8. Related Tests / Turn / REG

长期测试为 `scripts/selfcheck.py` 的 `Step1D/51`，本轮对应 `IT-0001/TR-0001` 的 `TEST-03`，本轮完整 792 条机制执行通过，当前无替代 REG
