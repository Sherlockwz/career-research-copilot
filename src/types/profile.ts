// 个人结构化数据 —— 插件的中枢数据模型
// 所有字段尽量支持中英双语（部分字段用 {zh,en} 结构，简单字段直接字符串）

export interface BilingualText {
  zh?: string
  en?: string
}

export interface BasicInfo {
  name?: string
  nameEn?: string
  email?: string
  phone?: string
  gender?: string
  birthday?: string
  location?: string // 现居城市
  wechat?: string
  // 链接
  github?: string
  linkedin?: string
  homepage?: string
  portfolio?: string
}

export interface EducationItem {
  id: string
  school?: string
  schoolEn?: string
  degree?: string // 本科/硕士/博士 等
  major?: string
  majorEn?: string
  gpa?: string
  startDate?: string
  endDate?: string
  city?: string
  description?: string
  courses?: string[]
}

export interface ExperienceItem {
  id: string
  type: 'internship' | 'work' | 'project' | 'research'
  organization?: string // 公司/实验室/组织
  organizationEn?: string
  role?: string // 职位/角色
  roleEn?: string
  startDate?: string
  endDate?: string
  city?: string
  // 要点（bullet），支持中英
  highlights?: string[]
  highlightsEn?: string[]
  tech?: string[] // 用到的技术/方法
  link?: string
}

export interface PublicationItem {
  id: string
  title?: string
  authors?: string
  venue?: string // 期刊/会议
  year?: string
  link?: string
  note?: string // 作者序、状态（under review 等）
}

export interface SkillGroup {
  id: string
  category?: string // 编程语言 / 框架 / 研究方法 等
  items?: string[]
}

export interface LanguageItem {
  id: string
  language?: string
  level?: string // 母语/流利/CET-6/TOEFL 105 等
}

// 自我介绍支持多版本（如：通用版、算法岗版、科研版）+ 中英
export interface SummaryVersion {
  id: string
  label?: string // 版本名，如「通用」「算法实习」
  zh?: string
  en?: string
}

export interface ProfileData {
  basic: BasicInfo
  education: EducationItem[]
  experiences: ExperienceItem[] // 实习/工作/项目/研究统一存放，用 type 区分
  publications: PublicationItem[]
  skills: SkillGroup[]
  languages: LanguageItem[]
  summaries: SummaryVersion[]
  updatedAt: number
}

export function emptyProfile(): ProfileData {
  return {
    basic: {},
    education: [],
    experiences: [],
    publications: [],
    skills: [],
    languages: [],
    summaries: [],
    updatedAt: 0,
  }
}
