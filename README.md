<div align="center">

<h1>ICViewer</h1>

<p><strong>在浏览器里打开芯片版图，看清图层、单元和每一处几何</strong></p>

<p>无需登录 · 文件留在浏览器 · 悬停与点击详情 · 可选对象讲解</p>

<p>
  <a href="https://icviewer.aialra.online">打开在线预览</a> ·
  <a href="https://github.com/AIALRA-0/IC-Viewer">查看源码</a> ·
  <a href="https://github.com/AIALRA-0/IC-Viewer/archive/refs/heads/main.zip">下载源码</a> ·
  <a href="README.en.md">English</a>
</p>

![深色工作台的合成示例、图层导航和几何统计](docs/assets/readme/public-dark.png)

图 1 合成示例的完整工作台，图层、几何与统计来自实际浏览器运行

</div>

## 1 第一次打开

- 第一步，访问 [在线预览](https://icviewer.aialra.online)，点击“加载示例”查看合成版图
- 第二步，点击“打开文件”或拖入本地文件，支持 `.gds`、`.gds2`、`.gdsii`、`.gltf` 和 `.glb`，后缀不区分大小写
- 第三步，切换图层或选择单元，把鼠标停在几何上查看提示，点击后在检查器中固定详细信息
- 第四步，调整三维、俯视和层间距，把观察写入审阅记录，导出记录供以后恢复

文件在当前浏览器内解析，打开和查看不需要账号或密钥
刷新后需重新打开源文件；导出的审阅记录保存观察和视角，不包含源版图

## 2 产品展示

全部图片使用仓库自制的合成示例，不包含用户版图或访问密钥
界面参考 AIALRA-TEMPLATE 的设计参数重新实现，模板本体保持不变
图片来源、尺寸和复现方式见 [素材说明](docs/assets/readme/PROVENANCE.md)

<div align="center">

![浅色主题保留相同的工作区结构，适合明亮环境](docs/assets/readme/public-light.png)

图 2 浅色主题保留相同的工作区结构，适合明亮环境

</div>

<div align="center">

![悬停提示对应鼠标命中的图形，显示单元、图层和坐标](docs/assets/readme/geometry-hover.png)

图 3 悬停提示对应鼠标命中的图形，显示单元、图层和坐标

</div>

<div align="center">

![点击固定并高亮命中的图形，右侧显示来源、尺寸和实例路径；路径对象还提供宽度与长度](docs/assets/readme/geometry-inspection.png)

图 4 点击固定并高亮命中的图形，右侧显示来源、尺寸和实例路径；路径对象还提供宽度与长度

</div>

<div align="center">

![选择较小单元单独观察，大设计达到展开预算时仍可浏览单元目录](docs/assets/readme/cell-browser.png)

图 5 选择较小单元单独观察，大设计达到展开预算时仍可浏览单元目录

</div>

<div align="center">

![分层展示帮助观察遮挡关系，显示高度不代表真实工艺厚度](docs/assets/readme/exploded-layers.png)

图 6 分层展示帮助观察遮挡关系，显示高度不代表真实工艺厚度

</div>

<div align="center">

![记录观察、保存视角书签，并导出可恢复的审阅文件](docs/assets/readme/review-records.png)

图 7 记录观察、保存视角书签，并导出可恢复的审阅文件

</div>

<div align="center">

![先核对服务地址与对象摘要，再明确同意发送；截图密钥为空，没有调用真实模型](docs/assets/readme/ai-harness.png)

图 8 先核对服务地址与对象摘要，再明确同意发送；截图密钥为空，没有调用真实模型

</div>

<div align="center">

<img src="docs/assets/readme/mobile-preview.png" width="390" alt="390 像素窄屏采用可收起侧栏，保留中央预览和常用操作">

图 9 390 像素窄屏采用可收起侧栏，保留中央预览和常用操作

</div>

## 3 对象讲解与密钥

- AI 人工智能（Artificial Intelligence）：这里用于把所选对象的结构化事实转成文字说明；浏览器把用户确认的摘要交给其指定的模型服务，再显示返回的文字；只有主动配置并确认发送才会请求服务，几何查看本身不需要模型；讲解中的推测需要独立核对，不能作为电气连接或工艺规则的证明

“AI 讲解”支持当前单元以及点击选中的几何，使用固定框架 `icviewer-explain-v1`
框架依次说明已知事实、几何与层级、可能用途、无法确认和建议观察
它明确区分路径形状与有连接资料的电气网络，缺少资料时要求说明未知

- 密钥仅保存在当前页面内存，输入框掩码显示，刷新、离开页面或点击“清除密钥”即丢弃
- 密钥不进入本地存储、审阅导出或网站服务器；浏览器直接使用密钥向用户选定的模型服务认证
- 确认后只发送可预览的单元或几何摘要，可能包含名称、实例路径和尺寸，不发送源文件或完整顶点数据
- 模型服务需要允许浏览器跨域请求；网络或服务失败会显示错误，网站不会转发密钥代为请求

模型协议、摘要字段、取消行为和固定提示词见 [讲解接口说明](docs/AI-HARNESS.md)

## 4 支持范围与实际限制

<div align="center">

表 1 公开预览能力与边界

| 项目 | 当前行为 | 需要注意 |
| --- | --- | --- |
| 版图文件 | 边界、框、路径、单元引用、阵列和常见变换 | 未提供工艺资料时图层按编号展示 |
| 缺失单元 | 保留已存在的几何，显示“不完整预览”和缺失目标清单 | 完整显示需要包含依赖单元的重新导出文件 |
| 三维模型 | 自包含、未压缩的静态三角形模型 | 拒绝外部资源地址与图片，动画不播放 |
| 悬停与选择 | 单元、实例、图形类型、图层、坐标和几何尺寸 | 这些事实不能推导真实网络名称或电气连通性 |
| 图层操作 | 显示、隐藏、隔离、层间距及常用视角 | 展示高度不是实际厚度 |
| 审阅 | 记录、书签、视角和图层状态导出与恢复 | 原始文件需要另行保留 |
| 比较 | 图层数量及三角形数量变化 | 不执行几何差异或制造规则检查 |
| 解析预算 | 单文件 32 MB，解析最多 45 秒 | 超预算设计进入单元目录，不假装已显示全部几何 |

</div>

缺失引用不等于文件后缀有误：文件可能引用外部标准单元库而没有包含其定义
检查器会列出目标名称与引用来源，预览器不会编造缺失单元的形状
详细解析限制见 [公开版说明](docs/PUBLIC-PREVIEW.md)

## 5 本地运行

公开版只需要 Node.js，持续集成使用版本 22
在仓库根目录执行以下命令：

```sh
# 按锁文件安装依赖
npm ci
# 启动浏览器解析工作台，终端会显示本机访问地址
npm run dev:web
# 检查类型并生成可发布的静态站点
npm run build:web
```

源码主入口是 [`Workbench.tsx`](apps/web/src/public/Workbench.tsx)，公开部署只使用 `apps/web/dist`
原有 Python 后端工作流另见 [本地开发说明](docs/LOCAL-WORKFLOW.md)，其服务不接入公开站点

## 6 验证与协作

当前公开版的 15 项回归覆盖缺失单元、变换与阵列、悬停和点击信息、密钥生命周期、摘要直连、取消、外部资源拒绝、超限文件、审阅恢复及移动布局
生产构建与原有界面构建均已通过；测试范围及最新发布验证见 [验证记录](docs/VERIFICATION-PUBLIC.md)

```sh
# 安装真实浏览器测试所需的浏览器
npx playwright install chromium --with-deps
# 执行公开版解析与交互回归
npm run test:public
# 单独检查原有本地工作流的生产构建
npm run build:legacy
```

<div align="center">

表 2 源码与文档入口

| 入口 | 内容 |
| --- | --- |
| [`apps/web/src/public/`](apps/web/src/public/) | 浏览器解析、几何选择、讲解框架与新界面 |
| [`apps/web/tests/public/`](apps/web/tests/public/) | 公开版解析和真实浏览器回归 |
| [`scripts/nginx/icviewer-public.conf`](scripts/nginx/icviewer-public.conf) | 独立静态站点与请求隔离配置 |
| [公开版说明](docs/PUBLIC-PREVIEW.md) | 文件支持、安全边界与部署恢复 |
| [讲解接口说明](docs/AI-HARNESS.md) | 固定框架和页面密钥约定 |
| [兼容规范](docs/COMPATIBILITY_SPEC.md) | 原有本地后端工作流的工程上下文 |
| [问题反馈](https://github.com/AIALRA-0/IC-Viewer/issues) | 缺陷复现与功能建议，请使用有权公开的合成数据 |

</div>

本仓库维护工作台与公开预览；[GDS-GLTF-3D-Viewer](https://github.com/AIALRA-0/GDS-GLTF-3D-Viewer) 是关联的原有查看器项目
修改共享契约前遵循 [`AGENTS.md`](AGENTS.md) 的协作规则

## 7 发布与权利

公开入口由 Cloudflare 代理，源站仅提供静态文件，不暴露上传接口、原有后端或共享会话
主页正常访问仍会请求站点服务；可选讲解会向用户确认的模型服务发送摘要
入口也已加入 [AIALRA 工具首页](https://aialra.online)，工作台顶部的独立源码图标链接到本仓库

仓库尚未声明项目开源许可证，公开可见不等于获得任意再分发授权
随公开构建提供的第三方声明见 [`NOTICE.txt`](apps/web/public-static/NOTICE.txt)
