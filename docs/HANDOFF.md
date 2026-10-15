# 交接指南 ·求职科研助手 Chrome 插件

> 给接手者：**先读这一份**。它带你 5 分钟跑起来，并给出代码地图、数据流、已知问题与待办。
> 深入背景看 [`REQUIREMENTS.md`](./REQUIREMENTS.md)（要做什么）和 [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md)（怎么演进的）。

---

## 1. 快速跑起来

需要 **Node.js ≥ 18**。

```bash
npm ci
npm test
npm run build          # = tsc --noEmit && vite build，产物在 dist/
```

在 Chrome 打开 `chrome://extensions` → 开启右上角**开发者模式** → **加载已解压的扩展程序** → 选 `dist/` 目录。

改完代码重跑 `npm run build`，回扩展页点插件的**刷新**图标即可。开发热更新可用 `npm run dev`。

**首次使用**：点插件图标 → 「设置 / 简历」→ 在**模型设置**填服务商 + API Key + 模型 → 「测试连接」。然后到**简历导入**上传 PDF 或粘主页链接。

---

## 2. 技术栈

Vite + React + TypeScript + Tailwind，`@crxjs/vite-plugin` 打包 Manifest V3。纯前端，无后端。

---

## 3. 代码地图（按「我想改 X 去哪」组织）

```
manifest.json            扩展清单（权限、四端入口）
vite.config.ts           构建配置
src/
├─ popup/                【工具栏弹窗】主入口
│  ├─ Popup.tsx          数据完整度、当前页类型、扫描/预填入口
│  └─ FillPanel.tsx      ★自动预填 UI：探测→匹配→填入高亮→确认学习
├─ options/              【设置页】
│  ├─ Options.tsx        4 个 tab 容器
│  ├─ SettingsTab.tsx    ★模型设置（5 家服务商 + 自定义）
│  ├─ ImportTab.tsx      ★简历导入（PDF 上传 / 主页链接抓取 / 粘贴兜底）
│  ├─ EditorTab.tsx      结构化数据可视化编辑器
│  └─ MappingsTab.tsx    已学预填映射的查看/清除
├─ sidepanel/
│  └─ SidePanel.tsx      ★展示 JD 匹配建议 / 教授套词草稿
├─ background/
│  └─ index.ts           ★Service Worker：消息路由 + LLM 代理 + 抓取。API Key 只在这读
├─ content/
│  └─ index.ts           ★注入页面：抓正文、探测表单、填入+高亮
├─ lib/
│  ├─ llm/index.ts       ★LLM 抽象：Anthropic / OpenAI 兼容两套请求格式
│  ├─ prompts/index.ts   ★所有 prompt：结构化 / JD 匹配 / 教授套词（中英）
│  ├─ resume/pdf.ts      pdf.js 本地文本提取
│  ├─ resume/fetchPage.ts★抓 URL + HTML 转正文
│  ├─ forms/signature.ts 字段特征归一化 + 页面类型识别（启发式）
│  ├─ forms/match.ts     ★预填匹配引擎（映射 > autocomplete > 关键词）
│  └─ storage/           settings.ts=chrome.storage（设置/映射）；profile.ts=IndexedDB
├─ types/
│  ├─ profile.ts         ProfileData 数据模型（简历结构）
│  └─ index.ts           ★LlmSettings / PROVIDER_PRESETS / FieldMapping / Suggestion
└─ shared/
   ├─ messages.ts        ★类型化消息协议（四端通信的单一事实来源）
   └─ ui.ts              UI 侧 hook 与 api 封装（useProfile、api.xxx）

★ = 核心/高频改动文件
```

## 4. 数据流与消息协议

**理解消息流是理解本项目的关键**。所有跨端通信的消息类型集中定义在 `src/shared/messages.ts` 的 `Message` 联合类型 —— 改通信先看它。

典型链路：
- **简历解析**：ImportTab → `STRUCTURE_TEXT` / `STRUCTURE_URL` → background 调LLM → 返回 ProfileData → 存IndexedDB。
- **页面扫描**：Popup → content `SCAN_PAGE`（旧标签页无接收端时按需注入）→ background `QUEUE_ANALYSIS` 写入待处理状态 → Popup 在用户点击手势内打开 SidePanel → SidePanel 调用 background `ANALYZE_PAGE` → LLM → SidePanel 持久化结果/错误。
- **自动预填**：FillPanel → content `DETECT_FIELDS` → `match.ts` 匹配 → content `APPLY_FILL`（填入+高亮）→ 用户改→ 再 `DETECT_FIELDS` 比对 → 更新映射 + 回写。

存储：`lib/storage/settings.ts`（chrome.storage.local：LLM 设置、字段映射）+ `lib/storage/profile.ts`（IndexedDB：ProfileData、简历原文）。

## 5. 已知问题与待办（欢迎从这里下手）

**功能层面**
- [ ] **主页抓取**在真实网站上未大规模实测。已打开的同网址标签页优先读取渲染后的 DOM；未打开的页面仍用 `fetch`，学术主页（Google Scholar、SPA/纯 JS 渲染）可能抓不全，可先打开页面或粘贴文本。
- [ ] **表单探测/填入**（`content/index.ts` + `forms/match.ts`）未在大量真实招聘官网验证。React 受控组件已用原生 setter +派发事件兼容，但复杂组件库（如某些自研下拉/日期控件）可能填不进。
- [ ] **数据回写**目前只支持 `basic.*` 直接字段（见 `FillPanel.tsx` 的 `applyWriteBack`），经历/教育等数组字段的回写未做。
- [ ] 启发式页面类型识别（`signature.ts` 的 `detectPageKind`）较粗，可结合更多信号。

**工程层面**
- [ ] 已加入 `node --test` 回归测试，覆盖旧标签页注入、受限制页面报错和不安全预填字段；`extractJson` / `htmlToText` 等纯逻辑仍可继续补测。
- [ ] **无插件图标**（`manifest.json` 无 `icons`，Chrome 用默认占位图）。需补一套 16/48/128 图标。
- [ ] `npm install` 有安全告警（1 moderate + 1 high，来自 @crxjs beta 依赖链），暂不影响构建，可评估升级。
- [ ] i18n：文案目前中文硬编码，若要做英文界面需抽取。

**验证清单（改动后建议手测）**
1. 五个入口都能打开（popup / options 四 tab / sidepanel）。
2. 每家服务商「测试连接」通过。
3. PDF 上传 → 数据出现在编辑器；主页链接 → 能读取解析。
4. JD 页 / 教授主页扫描 → 侧边栏出对应建议。
5. 表单页预填 → 高亮 → 改一个字段 → 确认学习 → 重开同站点验证映射生效。

## 6. 注意事项

- **不要提交 `*.pem`（Chrome 打包私钥）**，已在 `.gitignore` 排除。`node_modules`、`dist`、`.claude/` 也已忽略。
- API Key 属于用户隐私，只存本地、只在 background 读，别往content script 或日志里传。
- 当前构建产物的 zip 是 `release/career-research-copilot-v0.1.2.zip`（若需免构建直接安装）；旧版 zip 保留作历史版本。
