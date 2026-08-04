// Prompt 模板：文本结构化、JD 匹配、教授套词。中英双语由 outputLang 控制。
import type { ProfileData } from '@/types/profile'
import type { LlmSettings } from '@/types'

function langInstruction(lang: LlmSettings['outputLang']): string {
  if (lang === 'zh') return '请用中文输出。'
  if (lang === 'en') return 'Respond in English.'
  return '根据页面/简历主要语言选择中文或英文输出（中文内容用中文，英文内容用英文）。'
}

// ---- 简历/主页文本 -> 结构化 ProfileData ----
export const STRUCTURE_SYSTEM = `你是一个信息抽取引擎。你会收到一份简历或个人主页的纯文本，需要把它抽取成严格的 JSON。
只输出 JSON，不要任何解释文字。JSON 必须符合以下 TypeScript 结构（字段缺失就省略或给空数组，不要编造）：

{
  "basic": { "name","nameEn","email","phone","gender","birthday","location","wechat","github","linkedin","homepage","portfolio" },
  "education": [ { "id","school","schoolEn","degree","major","majorEn","gpa","startDate","endDate","city","description","courses":[] } ],
  "experiences": [ { "id","type":"internship|work|project|research","organization","organizationEn","role","roleEn","startDate","endDate","city","highlights":[],"highlightsEn":[],"tech":[],"link" } ],
  "publications": [ { "id","title","authors","venue","year","link","note" } ],
  "skills": [ { "id","category","items":[] } ],
  "languages": [ { "id","language","level" } ],
  "summaries": [ { "id","label","zh","en" } ]
}

规则：
- 每个数组项的 id 用短随机字符串（如 "e1","x1"）。
- experiences 里实习=internship，正式工作=work，课程/个人项目=project，科研经历=research。
- 尽量保留原文要点，highlights 每条是一句话。
- 若原文是中文，highlights 填 highlights；若是英文，填 highlightsEn。`

export function structureUserPrompt(text: string): string {
  return `以下是简历/主页文本，请抽取为 JSON：\n\n"""\n${text.slice(0, 20000)}\n"""`
}

// ---- 基于 profile 构造上下文摘要（供匹配/套词复用） ----
export function profileContext(p: ProfileData): string {
  const lines: string[] = []
  if (p.basic.name || p.basic.nameEn)
    lines.push(`姓名: ${p.basic.name ?? ''} ${p.basic.nameEn ?? ''}`)
  for (const e of p.education)
    lines.push(
      `教育: ${e.school ?? ''} ${e.degree ?? ''} ${e.major ?? ''} (${e.startDate ?? ''}-${e.endDate ?? ''})`
    )
  for (const x of p.experiences) {
    const hl = [...(x.highlights ?? []), ...(x.highlightsEn ?? [])].slice(0, 4).join('; ')
    lines.push(
      `${x.type}: ${x.organization ?? x.organizationEn ?? ''} - ${x.role ?? x.roleEn ?? ''} | ${hl}`
    )
  }
  for (const pub of p.publications)
    lines.push(`论文: ${pub.title ?? ''} (${pub.venue ?? ''} ${pub.year ?? ''})`)
  const skills = p.skills.map((s) => `${s.category ?? ''}: ${(s.items ?? []).join('/')}`).join(' | ')
  if (skills) lines.push(`技能: ${skills}`)
  return lines.join('\n').slice(0, 6000)
}

// ---- JD 匹配 ----
export function jdSystem(settings: LlmSettings): string {
  return `你是资深求职顾问。基于用户的背景和岗位 JD，给出可执行的匹配与优化建议。${langInstruction(
    settings.outputLang
  )}
只输出 JSON，结构如下（不要多余文字）：
{
  "kind": "jd",
  "summary": "对岗位的一句话理解",
  "matchPoints": ["用户已具备、与岗位契合的点"],
  "gaps": ["明显差距"],
  "optimizations": [ { "area":"简历某部分/某段经历", "advice":"如何优化", "revisedText":"可选，改写后的文案" } ],
  "howToMatch": ["为了更 match 可以做的具体动作：补充哪些项目/研究、从哪些方向切入"]
}`
}

export function jdUser(profile: ProfileData, jdText: string): string {
  return `【我的背景】\n${profileContext(profile)}\n\n【岗位 JD】\n${jdText.slice(0, 8000)}`
}

// ---- 教授套词 ----
export function professorSystem(settings: LlmSettings): string {
  return `你是科研申请顾问，帮助学生联系教授（套词）、申请 RA/研究生。基于教授主页信息和用户背景给建议。${langInstruction(
    settings.outputLang
  )}
只输出 JSON，结构如下（不要多余文字）：
{
  "kind": "professor",
  "researchFocus": ["教授的研究方向/兴趣点"],
  "commonGround": ["与用户背景的共同点/可衔接处"],
  "approachAngles": ["套词切入角度"],
  "collaboration": ["后续可行的合作方向：基于用户已有内容能做什么、如何展开"],
  "emailDraft": { "subject": "邮件标题", "body": "可直接发送的套词邮件正文，含称呼与署名占位" }
}`
}

export function professorUser(profile: ProfileData, pageText: string): string {
  return `【我的背景】\n${profileContext(profile)}\n\n【教授主页/研究信息】\n${pageText.slice(0, 8000)}`
}
