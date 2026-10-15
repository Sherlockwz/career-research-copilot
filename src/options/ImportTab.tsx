import { useState } from 'react'
import type { ProfileData } from '@/types/profile'
import { hasProfileData } from '@/types/profile'
import { extractPdfText } from '@/lib/resume/pdf'
import { api } from '@/shared/ui'

export function ImportTab({
  profile,
  onImported,
}: {
  profile: ProfileData
  onImported: (p: ProfileData, expectedUpdatedAt: number) => Promise<void>
}) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [showPaste, setShowPaste] = useState(false)

  function confirmReplacement(): boolean {
    if (!hasProfileData(profile)) return true
    const current = profile.basic.name || profile.basic.nameEn || '当前求职人'
    const ok = window.confirm(
      `当前保存的是「${current}」的资料。继续导入会用这次解析的内容整体覆盖现有个人资料，并清除旧的预填映射和分析结果。请确认新资料属于要使用的求职人。`
    )
    if (!ok) setStatus('已取消导入，原有资料未改变。')
    return ok
  }

  async function structure(text: string) {
    if (!text.trim()) {
      setStatus('没有可解析的文本')
      return
    }
    if (!confirmReplacement()) return
    const expectedUpdatedAt = profile.updatedAt
    setBusy(true)
    setStatus('调用模型结构化中…（需已在设置里配置 API Key）')
    try {
      const r = await api.structure(text)
      if (!r.ok || !r.profile) throw new Error(r.error ?? '解析失败')
      if (!hasProfileData(r.profile)) throw new Error('未识别出个人信息，原有资料已保留。')
      await onImported(r.profile, expectedUpdatedAt)
      setStatus('✅ 已替换个人资料，请到「数据编辑」核对。')
    } catch (e) {
      setStatus('❌ ' + String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  //抓取主页链接 -> background 提取正文 -> 结构化
  async function structureFromUrl() {
    if (!url.trim()) {
      setStatus('请先填写主页链接')
      return
    }
    if (!confirmReplacement()) return
    const expectedUpdatedAt = profile.updatedAt
    setBusy(true)
    setStatus('正在读取网页并解析…（由插件抓取网页正文后交给模型）')
    try {
      const r = await api.structureUrl(url.trim())
      if (!r.ok || !r.profile) throw new Error(r.error ?? '解析失败')
      if (!hasProfileData(r.profile)) throw new Error('未识别出个人信息，原有资料已保留。')
      await onImported(r.profile, expectedUpdatedAt)
      setStatus('✅ 已用主页内容替换个人资料，请到「数据编辑」核对。')
    } catch (e) {
      setStatus('❌ ' + String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  async function handlePdf(file: File) {
    setBusy(true)
    setStatus('提取 PDF 文本…')
    try {
      const text = await extractPdfText(file)
      if (!text || text.length < 20) {
        setStatus('PDF 文本过少，可能是扫描件。可尝试粘贴文本或换文件。')
        return
      }
      await structure(text)
    } catch (e) {
      setStatus('❌ 提取失败：' + String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">上传简历 PDF</h2>
        <p className="text-sm text-slate-500 mb-2">
          在浏览器本地提取文本后交给模型结构化，文件本身不会离开你的电脑。
        </p>
        <label className="inline-block">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void handlePdf(f)
            }}
          />
          <span className="cursor-pointer rounded bg-brand-500 text-white px-4 py-2 text-sm hover:bg-brand-600">
            选择 PDF 文件
          </span>
        </label>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-1">从个人主页读取</h2>
        <p className="text-sm text-slate-500 mb-2">
          粘贴个人主页 / 学术主页链接，插件会读取正文并生成一份新资料。已有资料会在确认后整体替换。
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 border border-slate-200 rounded px-3 py-2 text-sm"
            placeholder="https://your-homepage.com"
            disabled={busy}
          />
          <button
            disabled={busy}
            onClick={structureFromUrl}
            className="rounded bg-brand-500 text-white px-4 py-2 text-sm hover:bg-brand-600 disabled:opacity-50 whitespace-nowrap"
          >
            读取并解析
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          提示：需登录或纯 JS 动态渲染的页面可能读不全，可用下方「直接粘贴文本」兜底。
        </p>

        <button
          onClick={() => setShowPaste((v) => !v)}
          className="text-xs text-brand-600 hover:underline mt-2"
        >
          {showPaste ? '收起' : '读不出来？改用直接粘贴文本'}
        </button>
        {showPaste && (
          <div className="mt-2">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={6}
              className="w-full border border-slate-200 rounded p-2 text-sm"
              placeholder="把主页正文或一段自我介绍粘进来…"
            />
            <button
              disabled={busy}
              onClick={() => structure(pastedText)}
              className="mt-2 rounded border border-brand-500 text-brand-600 px-4 py-2 text-sm hover:bg-brand-50 disabled:opacity-50"
            >
              解析并替换
            </button>
          </div>
        )}
      </div>

      {status && <div className="text-sm text-slate-700">{status}</div>}
    </div>
  )
}
