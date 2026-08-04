// 字段特征归一化与页面类型识别（content 与 background 都可能用到的纯函数）
import type { FieldSignature, PageKind } from '@/types'

export function signatureKey(sig: FieldSignature): string {
  // 归一化：优先用稳定标识，去掉随机后缀数字噪声
  const norm = (s?: string) =>
    (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40)
  return [
    norm(sig.name),
    norm(sig.id).replace(/\d{3,}$/, ''),
    norm(sig.label),
    norm(sig.placeholder),
    norm(sig.autocomplete),
    sig.type ?? '',
  ].join('|')
}

// 根据 URL + 正文启发式判断页面类型
export function detectPageKind(url: string, title: string, text: string): PageKind {
  const u = url.toLowerCase()
  const t = (title + ' ' + text).toLowerCase()

  const professorHints = [
    'faculty',
    'professor',
    'ph.d',
    'phd',
    'research interests',
    'publications',
    'lab',
    '课题组',
    '实验室',
    '导师',
    '招收',
    '研究方向',
  ]
  const jdHints = [
    'job',
    'career',
    'position',
    'responsibilities',
    'requirements',
    'qualifications',
    '岗位职责',
    '任职要求',
    '招聘',
    '实习',
    'jd',
  ]

  const hasForm =
    typeof document !== 'undefined' &&
    document.querySelectorAll('input, textarea, select').length >= 4

  const profScore = professorHints.filter((h) => u.includes(h) || t.includes(h)).length
  const jdScore = jdHints.filter((h) => u.includes(h) || t.includes(h)).length

  if (profScore >= 2 && profScore >= jdScore) return 'professor'
  if (jdScore >= 2) return 'jd'
  if (hasForm) return 'form'
  return 'unknown'
}
