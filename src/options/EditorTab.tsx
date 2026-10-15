import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ProfileData, ExperienceItem } from '@/types/profile'

// 简易 id 生成（编辑器新增条目用；非 workflow 环境可用 Date/Math）
function rid() {
  return Math.random().toString(36).slice(2, 8)
}

const BASIC_FIELDS: { key: keyof ProfileData['basic']; label: string }[] = [
  { key: 'name', label: '姓名' },
  { key: 'nameEn', label: '英文名' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '电话' },
  { key: 'gender', label: '性别' },
  { key: 'location', label: '现居城市' },
  { key: 'wechat', label: '微信' },
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'homepage', label: '个人主页' },
]

const EXP_TYPES: { v: ExperienceItem['type']; label: string }[] = [
  { v: 'internship', label: '实习' },
  { v: 'work', label: '工作' },
  { v: 'project', label: '项目' },
  { v: 'research', label: '科研' },
]

export function EditorTab({
  profile,
  onChange,
  onSave,
}: {
  profile: ProfileData
  onChange: (p: ProfileData) => void
  onSave: () => Promise<void>
}) {
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaveStatus('保存中…')
    try {
      await onSave()
      setSaveStatus('已保存')
    } catch (e) {
      setSaveStatus('保存失败：' + String((e as Error).message ?? e))
    } finally {
      setSaving(false)
    }
  }

  function patch(mut: (p: ProfileData) => void) {
    const next: ProfileData = JSON.parse(JSON.stringify(profile))
    mut(next)
    onChange(next)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">个人数据</h2>
        <div className="flex items-center gap-2">
          {saveStatus && <span className="text-xs text-slate-500">{saveStatus}</span>}
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded bg-brand-500 text-white px-4 py-2 text-sm hover:bg-brand-600"
          >
            保存
          </button>
        </div>
      </div>

      {/* 基本信息 */}
      <Card title="基本信息">
        <div className="grid grid-cols-2 gap-3">
          {BASIC_FIELDS.map((f) => (
            <label key={f.key} className="text-sm">
              <span className="block text-slate-500 mb-0.5">{f.label}</span>
              <input
                className="inp"
                value={profile.basic[f.key] ?? ''}
                onChange={(e) =>
                  patch((p) => {
                    ;(p.basic as Record<string, unknown>)[f.key] = e.target.value
                  })
                }
              />
            </label>
          ))}
        </div>
      </Card>

      {/* 教育 */}
      <Card
        title="教育经历"
        onAdd={() =>
          patch((p) => p.education.push({ id: rid() }))
        }
      >
        {profile.education.map((ed, i) => (
          <Row key={ed.id} onDelete={() => patch((p) => p.education.splice(i, 1))}>
            <input className="inp" placeholder="学校" value={ed.school ?? ''} onChange={(e) => patch((p) => (p.education[i].school = e.target.value))} />
            <input className="inp" placeholder="学历" value={ed.degree ?? ''} onChange={(e) => patch((p) => (p.education[i].degree = e.target.value))} />
            <input className="inp" placeholder="专业" value={ed.major ?? ''} onChange={(e) => patch((p) => (p.education[i].major = e.target.value))} />
            <input className="inp" placeholder="起止(如 2022-2026)" value={`${ed.startDate ?? ''}${ed.endDate ? '~' + ed.endDate : ''}`} onChange={(e) => patch((p) => { const [s, en] = e.target.value.split('~'); p.education[i].startDate = s?.trim(); p.education[i].endDate = en?.trim() })} />
          </Row>
        ))}
      </Card>

      {/* 经历（实习/工作/项目/科研） */}
      <Card
        title="实习 / 工作 / 项目 / 科研"
        onAdd={() => patch((p) => p.experiences.push({ id: rid(), type: 'internship' }))}
      >
        {profile.experiences.map((x, i) => (
          <Row key={x.id} onDelete={() => patch((p) => p.experiences.splice(i, 1))}>
            <select className="inp" value={x.type} onChange={(e) => patch((p) => (p.experiences[i].type = e.target.value as ExperienceItem['type']))}>
              {EXP_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <input className="inp" placeholder="机构/公司/实验室" value={x.organization ?? ''} onChange={(e) => patch((p) => (p.experiences[i].organization = e.target.value))} />
            <input className="inp" placeholder="角色/职位" value={x.role ?? ''} onChange={(e) => patch((p) => (p.experiences[i].role = e.target.value))} />
            <input className="inp col-span-3" placeholder="要点（用 ; 分隔多条）" value={(x.highlights ?? []).join('; ')} onChange={(e) => patch((p) => (p.experiences[i].highlights = e.target.value.split(';').map((s) => s.trim()).filter(Boolean)))} />
          </Row>
        ))}
      </Card>

      {/* 论文 */}
      <Card title="论文" onAdd={() => patch((p) => p.publications.push({ id: rid() }))}>
        {profile.publications.map((pub, i) => (
          <Row key={pub.id} onDelete={() => patch((p) => p.publications.splice(i, 1))}>
            <input className="inp col-span-2" placeholder="标题" value={pub.title ?? ''} onChange={(e) => patch((p) => (p.publications[i].title = e.target.value))} />
            <input className="inp" placeholder="发表处" value={pub.venue ?? ''} onChange={(e) => patch((p) => (p.publications[i].venue = e.target.value))} />
            <input className="inp" placeholder="年份" value={pub.year ?? ''} onChange={(e) => patch((p) => (p.publications[i].year = e.target.value))} />
          </Row>
        ))}
      </Card>

      {/* 技能 */}
      <Card title="技能" onAdd={() => patch((p) => p.skills.push({ id: rid() }))}>
        {profile.skills.map((sk, i) => (
          <Row key={sk.id} onDelete={() => patch((p) => p.skills.splice(i, 1))}>
            <input className="inp" placeholder="类别（如 编程语言）" value={sk.category ?? ''} onChange={(e) => patch((p) => (p.skills[i].category = e.target.value))} />
            <input className="inp col-span-3" placeholder="条目（用 / 分隔）" value={(sk.items ?? []).join(' / ')} onChange={(e) => patch((p) => (p.skills[i].items = e.target.value.split('/').map((s) => s.trim()).filter(Boolean)))} />
          </Row>
        ))}
      </Card>

      {/* 自我介绍（多版本） */}
      <Card title="自我介绍（可多版本）" onAdd={() => patch((p) => p.summaries.push({ id: rid() }))}>
        {profile.summaries.map((sm, i) => (
          <div key={sm.id} className="border border-slate-200 rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input className="inp flex-1" placeholder="版本名（如 通用/算法岗）" value={sm.label ?? ''} onChange={(e) => patch((p) => (p.summaries[i].label = e.target.value))} />
              <button className="text-red-400 text-xs" onClick={() => patch((p) => p.summaries.splice(i, 1))}>删除</button>
            </div>
            <textarea className="inp" rows={3} placeholder="中文" value={sm.zh ?? ''} onChange={(e) => patch((p) => (p.summaries[i].zh = e.target.value))} />
            <textarea className="inp" rows={3} placeholder="English" value={sm.en ?? ''} onChange={(e) => patch((p) => (p.summaries[i].en = e.target.value))} />
          </div>
        ))}
      </Card>

      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;font-size:14px}`}</style>
    </div>
  )
}

function Card({
  title,
  children,
  onAdd,
}: {
  title: string
  children: ReactNode
  onAdd?: () => void
}) {
  return (
    <section className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700">{title}</h3>
        {onAdd && (
          <button onClick={onAdd} className="text-brand-600 text-sm hover:underline">
            + 添加
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Row({
  children,
  onDelete,
}: {
  children: ReactNode
  onDelete: () => void
}) {
  return (
    <div className="relative grid grid-cols-3 gap-2 border-b border-slate-100 pb-3">
      {children}
      <button
        onClick={onDelete}
        className="absolute -right-1 -top-1 text-red-300 hover:text-red-500 text-xs"
        title="删除"
      >
        ✕
      </button>
    </div>
  )
}
