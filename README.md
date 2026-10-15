# 求职科研助手 · Chrome 插件

面向**实习/校招投递**与**科研套词（联系教授、申请 RA/研究生）**的 Chrome 扩展。以「个人结构化数据」为中枢：一次录入，处处复用。

> **接手开发者请先读 [`docs/HANDOFF.md`](docs/HANDOFF.md)** —— 5 分钟跑起来 + 代码地图 + 待办。
> 背景与演进：[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)（需求）· [`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md)（开发历程）。

## 三大功能

1. **简历解析 / 数据录入**：上传 PDF（浏览器本地用 pdf.js 提取文本）或**粘贴个人主页链接**（插件自动抓取网页正文）→ 模型结构化成个人数据 → 可视化编辑。
2. **页面扫描 + 建议**：在岗位 JD 页给「匹配点 / 差距 / 优化建议 / 如何更 match」；在教授主页给「研究方向 / 共同点 / 切入角度 / 合作方向 / 可发送的套词邮件草稿」。
3. **自动预填 + 学习**：探测申请表单字段并预填、高亮；用户修改确认后，① 学习「本站点字段 → 我数据里哪一项」的映射，② 可把新填/改动的内容回写个人库。越填越准。

## 支持的模型服务商

用户自填 API Key，支持：**Claude (Anthropic)**、**OpenAI**、**DeepSeek**、**Kimi (月之暗面)**、以及**自定义**（中转站 / 自部署等 OpenAI 兼容端点）。

## 隐私

- 个人数据、简历原文存在浏览器本地（IndexedDB）；设置与映射存 `chrome.storage.local`。
- API Key 只在本地保存、只在 background 读取，调用直接发往你选择的服务商，不经本项目服务器。
- 使用模型解析简历或分析网页时，相关文本和个人数据会发送给你选择的模型服务商。

## 环境要求

需要 **Node.js ≥ 18**。未安装可从 [nodejs.org](https://nodejs.org) 装 LTS，或用 nvm。安装后确认：

```bash
node -v && npm -v
```

## 构建与加载

```bash
npm ci
npm test
npm run build
```

然后在 Chrome 打开 `chrome://extensions` → 开启右上角「开发者模式」→「加载已解压的扩展程序」→ 选择本项目的 `dist/` 目录。

> 若不想构建：解压 [`release/career-research-copilot-v0.1.1.zip`](release/career-research-copilot-v0.1.1.zip)，加载解压出的目录。旧版 v0.1.0 zip 不含当前页读取修复。

开发热更新（可选）：`npm run dev`，然后在扩展页点插件「刷新」。

## 使用流程

1. 点扩展图标 →「设置 / 简历」，在**模型设置**填服务商、API Key、模型，点「测试连接」。
2. 到**简历导入**上传 PDF 或粘贴主页链接，解析后到**数据编辑**核对补全。
3. 打开一个招聘 JD 或教授主页，点扩展图标，确认「已读取 N 字」并查看摘录；可点「重新读取」。选择岗位或教授分析后点「扫描当前页并给建议」，侧边栏显示分析进度和结果。旧标签页会自动尝试注入页面脚本。
4. 打开申请表单页，点「自动预填表单」→ 探测匹配 → 填入高亮 → 手动调整 →「确认并学习」。

浏览器内置页、扩展页和本地文件页无法读取。若个人主页链接需要登录或依赖动态渲染，请先在浏览器标签页打开同一网址，再到「简历导入」读取；插件会优先使用已打开页面的正文。

## 目录结构

详见 [`docs/HANDOFF.md`](docs/HANDOFF.md) 的代码地图。概览：

```
src/
├── popup/        主入口（数据完整度、扫描、预填 FillPanel）
├── options/      设置 / 简历导入 / 数据编辑 / 预填映射
├── sidepanel/    建议与套词草稿展示
├── background/   service worker：消息路由 + LLM 代理 + 网页抓取
├── content/      页面抓取、表单探测、填入高亮
├── lib/          llm / storage / resume / forms / prompts
├── types/        ProfileData / LlmSettings / FieldMapping / Suggestion
└── shared/       类型化消息协议、UI hook
docs/             需求、开发历程、交接指南
```
