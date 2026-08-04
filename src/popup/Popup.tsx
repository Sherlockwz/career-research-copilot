import { useEffect, useState } from 'react'
import type { ScannedPage } from '@/shared/messages'
import type { PageKind } from '@/types'
import { useProfile, api, stashSuggestion } from '@/shared/ui'
import { FillPanel } from './FillPanel'

const KIND_LABEL: Record<PageKind, string> = {
  jd: '岗位 JD',
  professor: '教授/科研主页',
  form: '申请表单',
  unknown: '普通网页',
}

export function Popup() {
  const { profile, loading } = useProfile()
  const [page, setPage] = useState<ScannedPage | null>(null)
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const [view, setView] = useState<'home' | 'fill'>('home')

  // 打开时探测当前页类型
  useEffect(() => {
    api
      .scanPage()
      .then(setPage)
      .catch(() => setPage(null))
  }, [])

  const completeness = profileCompleteness(profile)

  async function handleAnalyze() {
    if (!page) return
    setError('')
    setBusy('分析中…')
    try {
      const cur = page.kind === 'unknown' || page.kind === 'form' ? { ...page, kind: 'jd' as PageKind } : page
      const r = await api.analyze(cur)
      if (!r.ok || !r.suggestion) throw new Error(r.error ?? '分析失败')
      await stashSuggestion(r.suggestion, cur)
      // 打开 side panel 展示
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId })
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy('')
    }
  }

  if (view === 'fill') {
    return <FillPanel profile={profile} onBack={() => setView('home')} />
  }

  return (
    <div className="p-4 text-sm text-slate-800">
      <header className="flex items-center justify-between mb-3">
        <h1 className="font-semibold text-base">求职科研助手</h1>
        <button
          className="text-brand-600 text-xs hover:underline"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          设置 / 简历
        </button>
      </header>

      {/* 数据完整度 */}
      <div className="rounded-lg border border-slate-200 p-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-500">个人数据完整度</span>
          <span className="font-medium">{completeness}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded">
          <div
            className="h-2 bg-brand-500 rounded"
            style={{ width: `${completeness}%` }}
          />
        </div>
        {completeness < 30 && (
          <p className="text-xs text-amber-600 mt-2">
            数据较少，先到「设置 / 简历」上传简历或填写主页。
          </p>
        )}
      </div>

      {/* 当前页面 */}
      <div className="rounded-lg border border-slate-200 p-3 mb-3">
        <div className="text-slate-500 mb-1">当前页面</div>
        {page ? (
          <>
            <div className="font-medium truncate" title={page.title}>
              {page.title || page.host}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              识别为：<span className="text-brand-600">{KIND_LABEL[page.kind]}</span>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400">无法读取当前页（可能是浏览器内置页）</div>
        )}
      </div>

      {error && (
        <div className="rounded bg-red-50 text-red-600 text-xs p-2 mb-3">{error}</div>
      )}

      {/* 操作 */}
      <div className="grid grid-cols-1 gap-2">
        <button
          disabled={!page || !!busy}
          onClick={handleAnalyze}
          className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium disabled:opacity-50 hover:bg-brand-600"
        >
          {busy || '扫描当前页并给建议'}
        </button>
        <button
          disabled={!page}
          onClick={() => setView('fill')}
          className="w-full rounded-lg border border-brand-500 text-brand-600 py-2 font-medium disabled:opacity-50 hover:bg-brand-50"
        >
          自动预填表单
        </button>
      </div>

      {loading && <p className="text-xs text-slate-400 mt-3">加载数据中…</p>}
    </div>
  )
}

function profileCompleteness(p: ReturnType<typeof useProfile>['profile']): number {
  let score = 0
  const b = p.basic
  if (b.name || b.nameEn) score += 10
  if (b.email) score += 10
  if (b.phone) score += 5
  if (p.education.length) score += 20
  if (p.experiences.length) score += 25
  if (p.skills.length) score += 10
  if (p.summaries.length) score += 10
  if (p.publications.length) score += 5
  if (b.github || b.homepage || b.linkedin) score += 5
  return Math.min(100, score)
}
