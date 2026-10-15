import { useEffect, useState } from 'react'
import type { ScannedPage } from '@/shared/messages'
import type { PageKind } from '@/types'
import { useProfile, api } from '@/shared/ui'
import { FillPanel } from './FillPanel'

const KIND_LABEL: Record<PageKind, string> = {
  jd: '岗位 JD',
  professor: '教授/科研主页',
  form: '申请表单',
  unknown: '普通网页',
}

export function Popup() {
  const { profile, loading, error: profileError } = useProfile()
  const [page, setPage] = useState<ScannedPage | null>(null)
  const [error, setError] = useState('')
  const [pageError, setPageError] = useState('')
  const [readingPage, setReadingPage] = useState(true)
  const [analysisKind, setAnalysisKind] = useState<'jd' | 'professor'>('jd')
  const [windowId, setWindowId] = useState<number | null>(null)
  const [view, setView] = useState<'home' | 'fill'>('home')

  // 打开时探测当前页类型
  useEffect(() => {
    void loadPage()
  }, [])

  async function loadPage() {
    setReadingPage(true)
    setPageError('')
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setWindowId(tab?.windowId ?? null)
      const result = await api.scanPage()
      if (!result || typeof result.text !== 'string' || typeof result.url !== 'string') {
        throw new Error('页面脚本返回的数据无效，请刷新网页后重试。')
      }
      setPage(result)
      setAnalysisKind(result.kind === 'professor' ? 'professor' : 'jd')
    } catch (e) {
      setPage(null)
      setPageError(String((e as Error).message ?? e))
    } finally {
      setReadingPage(false)
    }
  }

  const completeness = profileCompleteness(profile)

  function handleAnalyze() {
    if (!page) return
    setError('')
    const cur: ScannedPage = { ...page, kind: analysisKind }
    // 先发起后台请求，再在本次点击手势内立即打开侧边栏。
    void chrome.runtime.sendMessage({ type: 'QUEUE_ANALYSIS', page: cur, requestId: crypto.randomUUID() })
      .then((result: { ok: boolean; error?: string }) => {
        if (!result?.ok) setError(result?.error ?? '无法开始分析')
      })
      .catch((e) => setError(String((e as Error).message ?? e)))
    void chrome.sidePanel.open({ windowId: windowId ?? chrome.windows.WINDOW_ID_CURRENT })
      .catch((e) => setError(`无法打开侧边栏：${String((e as Error).message ?? e)}`))
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
            <details className="text-xs text-slate-500 mt-2">
              <summary className="cursor-pointer">已读取 {page.text.length} 字，查看摘录</summary>
              <p className="whitespace-pre-wrap max-h-24 overflow-auto mt-1">{page.text.slice(0, 500)}</p>
            </details>
          </>
        ) : (
          <div className="text-xs text-slate-500">{readingPage ? '正在读取当前页…' : pageError || '无法读取当前页'}</div>
        )}
        <button onClick={() => void loadPage()} disabled={readingPage} className="text-xs text-brand-600 hover:underline mt-2 disabled:opacity-50">
          重新读取
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-50 text-red-600 text-xs p-2 mb-3">{error}</div>
      )}
      {profileError && <div className="rounded bg-red-50 text-red-600 text-xs p-2 mb-3">个人数据加载失败：{profileError}</div>}

      {/* 操作 */}
      <div className="grid grid-cols-1 gap-2">
        {page && (
          <label className="text-xs text-slate-600">
            分析用途
            <select value={analysisKind} onChange={(e) => setAnalysisKind(e.target.value as 'jd' | 'professor')} className="ml-2 border border-slate-200 rounded px-2 py-1">
              <option value="jd">岗位</option>
              <option value="professor">教授 / 科研主页</option>
            </select>
          </label>
        )}
        <button
          disabled={!page}
          onClick={handleAnalyze}
          className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium disabled:opacity-50 hover:bg-brand-600"
        >
          扫描当前页并给建议
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
