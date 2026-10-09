<!-- APCF-META {"schema":1,"visibility":"public"} -->
# 1. 项目架构

## 1.1. 公共浏览器入口

`apps/web/src/public/` 负责工作台和图形显示，解析在可替换的浏览器 Worker 中进行，图形资源和单元复用由浏览器持有，源码文件不上传网站服务器

构建和测试入口以根 `package.json`、`apps/web/package.json` 和 `.github/workflows/ci.yml` 为工具链权威，公共 `dist` 与原项目 `dist-local` 分开构建

## 1.2. 原项目接口

`apps/api/` 和 `packages/shared/` 保留原项目本地 API 工作流，见 [本地工作流](../docs/LOCAL-WORKFLOW.md)，不通过公开静态域名部署

## 1.3. 状态和信任边界

公开版版图、选择、注释和临时 AI 密钥由页面持有，允许保存的偏好与审阅文件以 [公开预览说明](../docs/PUBLIC-PREVIEW.md) 和 [讲解合同](../docs/AI-HARNESS.md) 为权威

第三方模型仅接收用户确认发送的有界摘要；网络拒绝发生于页面加载前时，应调查客户端连接路径，不能归因 GDS 解析性能

## 1.4. 部署

[公开预览说明](../docs/PUBLIC-PREVIEW.md) 定义静态构建、原子切换和回滚方式，Cloudflare 代理域名使用独立静态入口，网站不运行 Python API

## 1.5. 控制壳和运行边界

`AGENTS.md` 路由至 `.agent-project-control/`，项目源码和原生测试不迁移，`CURRENT.md` 由当前 TR 冻结报告派生

新临时脚本和诊断输出进入 `runtime/`，原生 `node_modules`、`dist`、`dist-local`、Playwright 输出和已有 `.verification/` 保持工具规定位置并继续忽略，旧输出仅作为已存在证据引用，不再作为新临时工作区

`.codex/skills/` 是锁定技能的可重建安装缓存，不提交技能仓库的嵌套 Git 历史
