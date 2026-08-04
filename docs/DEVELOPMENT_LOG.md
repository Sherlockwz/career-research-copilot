# 开发历程 · 求职科研助手 Chrome 插件

> 本文件按时间顺序记录**做了什么、为什么这么做、踩过哪些坑**。
> 目的：让接手者快速了解演进过程，不必逐行读代码去推断意图。

---

## 第 1 轮：从零搭建三大功能（初版）

### 架构决策
以「个人结构化数据（ProfileData）」为中枢，五个运行端：

- **Popup**（React）：主入口 —— 数据完整度、扫描当前页、进入预填。
- **Options页**（React）：模型设置 / 简历导入 / 数据编辑 / 预填映射管理。
- **Side Panel**（React）：展示匹配建议与套词草稿（比 popup 空间大）。
- **Background（Service Worker）**：LLM 调用代理 + 消息路由 + 存储协调。**API Key 只在这里读**。
- **Content Script**：注入页面，负责抓正文、探测表单、填入+高亮。

数据流：`PDF/网页文本 → background调 LLM → 结构化 JSON → 本地存储 → UI 展示编辑 → content 预填`。

### 各功能实现要点
- **简历解析**：`lib/resume/pdf.ts` 用 pdf.js 在浏览器本地提取文本 → `lib/prompts` 的结构化 prompt（强制 JSON）→ 合并进ProfileData。
- **页面扫描**：`content/index.ts` 抓正文 + `lib/forms/signature.ts` 启发式识别页面类型（jd / professor / form）→ background 按类型走不同 prompt → side panel 展示。
- **自动预填 + 学习**：`lib/forms/match.ts` 三级匹配（已学映射 > autocomplete 属性 > 中英关键词启发式）→ content 填入并高亮（低置信橙色虚线）→ 用户确认后更新站点映射 + 可回写个人库。

### 关键复用点
- 所有 AI 调用统一走 `lib/llm` + background，避免各处重复实现、避免 Key 泄漏。
- 简历 PDF 与个人主页正文**共用同一条「文本 → 结构化 JSON」管线**。

### 构建阶段踩的坑（都已修复）
1. 机器没装 Node → 下载 Node v22.14.0 arm64 到 `~/.local/node`（免管理员）。
2. `React.ReactNode` 用了React 命名空间但没import（TS2686）→ 改用 `import type { ReactNode }`。
3. `?url` 资源导入缺类型声明（TS2307）→ 新增 `src/vite-env.d.ts`。
4. 缺 `@types/node` → 装上。
5. `FillPanel` 有未使用变量（noUnusedLocals）→ 删除。
6. `manifest.json` 的 `web_accessible_resources` 引用了不存在的 pdf worker 路径 → 去掉手写项，worker 由 vite 自动打包。
7. `default_locale: zh_CN` 但没有 `_locales/` 文件（会导致 Chrome 加载失败）→ 移除该字段。

### 验证方式
- `npm run build`（= `tsc --noEmit && vite build`）通过。
- 用 Node 对纯逻辑单测：`extractJson`（容错解析 4/4）、`matchFields`（中英字段匹配 6/6，含映射优先、无关字段忽略）。

---

## 第 2 轮：按试用反馈改进

试用后提出两点，均已完成并验证：

### 改进 1：模型设置增加国内厂商 + 自定义
- 服务商从 2 家（Claude、OpenAI）扩展到 **5 家**：Claude、OpenAI、**DeepSeek**、**Kimi（月之暗面）**、**自定义（中转站 / 自部署）**。
-架构上抽象出「**请求格式**」概念（`types/index.ts` 的 `PROVIDER_PRESETS` + `ApiFormat`）：
  - Claude 走 **Anthropic Messages API** 格式；
  - 其余四家走 **OpenAI Chat Completions** 兼容格式（DeepSeek、Kimi 官方接口本就是 OpenAI 兼容的）。
- 每家有预设 Base URL / 默认模型 / 获取 Key 提示；选「自定义」时保留用户自填的 Base URL 和模型名。
- `lib/llm/index.ts` 的分发逻辑从「看 provider」改为「看 format」；新增 `supportsJsonMode()` 判断是否用 OpenAI 的 `response_format: json_object`。

### 改进 2：个人主页从「粘贴正文」改为「粘贴链接自动抓取」
- 原来让用户手动复制主页正文，不合理 → 改成**用户只粘链接**。
- 新增 `lib/resume/fetchPage.ts`：在**background**（有 `<all_urls>` 权限、规避页面 CORS）用 `fetch` 抓HTML → `htmlToText()` 提取正文（去 script/style/nav/footer、解码 HTML 实体）→ 复用已有结构化管线。
- 新增消息类型 `STRUCTURE_URL`，background 里`structureUrl()` 一步完成「抓取 → 结构化」。
- **兜底**：需登录 / 纯 JS 动态渲染的页面可能抓不全，此时给明确提示，并保留可展开的「直接粘贴文本」入口。
- 验证：`htmlToText` 单测 9/9（脚本/样式/导航/页脚剔除、正文与研究方向保留、实体解码）。

---

## 已知局限 / 待验证（留给接手者）

见 `HANDOFF.md` 的「已知问题与待办」。核心几条：
- 真实抓取任意网站未做过大规模实测；学术主页（Google Scholar、SPA 渲染）可能抓不全。
- content script 的表单探测与填入未在大量真实招聘官网上验证。
- 尚无自动化测试框架（目前只有手写的 Node 逻辑验证脚本，未入库）。
- 尚未准备插件图标（`manifest.json` 无 `icons`，Chrome 用默认占位图）。
