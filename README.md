# 求职科研助手 · Chrome 插件

面向**实习/校招投递**与**科研套词（联系教授、申请 RA/研究生）**的 Chrome 扩展。以「个人结构化数据」为中枢：一次录入，处处复用。

## 安装

### 方法一：下载安装包（推荐，无需命令行）

1. 点击 **[下载最新版 v0.1.2 安装包（ZIP）](https://raw.githubusercontent.com/Sherlockwz/career-research-copilot/main/release/career-research-copilot-v0.1.2.zip)**。也可以从仓库的 [`release/` 目录](release/)找到安装包；如果进入了 GitHub 的文件预览页，点击「下载原始文件」。
2. 解压 ZIP，并把解压出的文件夹放在一个不会随意移动或删除的位置。确认所选文件夹里能直接看到 `manifest.json`；**不要直接选择 ZIP 文件，也不要选择多套了一层的上级文件夹**。
3. 在 Chrome 地址栏输入 `chrome://extensions` 并回车，开启页面右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择第 2 步中包含 `manifest.json` 的文件夹。出现「求职科研助手」卡片即安装完成。
5. 点击浏览器工具栏的拼图图标，可将插件固定到工具栏；点击插件图标，再进入「设置 / 简历」配置模型和 API Key。

### 方法二：通过命令行构建，再加载到 Chrome

需要 Git、**Node.js ≥ 18** 和 npm。安装 Node.js 可参考 [nodejs.org](https://nodejs.org)。在终端执行：

```bash
git clone https://github.com/Sherlockwz/career-research-copilot.git
cd career-research-copilot
npm ci
npm run build
```

构建后，按方法一的第 3～5 步操作，但在「加载已解压的扩展程序」时选择项目的 **`dist/` 文件夹**（其中直接包含 `manifest.json`）。命令行负责生成插件文件，Chrome 中仍需完成这一步加载。开发时可选运行 `npm test`；使用 `npm run dev` 后，可在扩展管理页点击插件卡片上的刷新图标。

**更新已有的解压版：**将新版解压文件复制到原来加载插件的文件夹并替换旧文件，保持文件夹路径不变；然后在 `chrome://extensions` 点击该插件的刷新图标，并刷新正在使用的网页。若改从另一个文件夹重新加载，Chrome 可能分配新的扩展 ID，原来的本地个人数据不会自动迁移。

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

## 使用流程

1. 点扩展图标 →「设置 / 简历」，在**模型设置**填服务商、API Key、模型，点「测试连接」。
2. 到**简历导入**上传 PDF、粘贴主页链接或正文。每次导入都会生成一份新资料；已有资料时会先提示确认，确认后整体替换。解析失败或取消时保留原资料。随后到**数据编辑**核对。
3. 打开一个招聘 JD 或教授主页，点扩展图标，确认「已读取 N 字」并查看摘录；可点「重新读取」。选择岗位或教授分析后点「扫描当前页并给建议」，侧边栏显示分析进度和结果。旧标签页会自动尝试注入页面脚本。
4. 打开申请表单页，点「自动预填表单」→ 探测匹配 → 填入高亮 → 手动调整 →「确认并学习」。

更换使用者时，在「设置 / 简历」页点击「更换求职人 / 清空之前所有信息」。确认后会清除个人资料、已保存的简历原文、预填映射和分析结果；模型设置及 API Key 保留。请勿把两位求职人的资料分别作为主页和 PDF 连续导入后期待自动合并。

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
