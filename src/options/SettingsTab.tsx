import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { LlmSettings, LlmProvider } from '@/types'
import { defaultLlmSettings, PROVIDER_PRESETS } from '@/types'
import { getSettings, saveSettings } from '@/lib/storage/settings'
import { api } from '@/shared/ui'

const PROVIDER_ORDER: LlmProvider[] = [
  'claude',
  'openai',
  'deepseek',
  'kimi',
  'custom',
]

export function SettingsTab() {
  const [s, setS] = useState<LlmSettings>(defaultLlmSettings())
  const [test, setTest] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(setS)
  }, [])

  function update<K extends keyof LlmSettings>(k: K, v: LlmSettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  function switchProvider(p: LlmProvider) {
    const preset = PROVIDER_PRESETS[p]
    setS((prev) => ({
      ...prev,
      provider: p,
      // 自定义：保留用户已填的 baseUrl/model；其余套用预设
      baseUrl: p === 'custom' ? prev.baseUrl : preset.baseUrl,
      model: p === 'custom' ? prev.model : preset.model,
    }))
    setSaved(false)
  }

  async function handleSave() {
    try {
      await saveSettings(s)
      setSaved(true)
      setTest('')
    } catch (e) {
      setTest('❌ 保存失败：' + String((e as Error).message ?? e))
    }
  }

  async function handleTest() {
    setTest('测试中…')
    try {
      await saveSettings(s) // 先存，background 读的是存储值
      const r = await api.testLlm()
      setTest(r.ok ? '✅ 连接成功' : '❌ ' + (r.error ?? '失败'))
    } catch (e) {
      setTest('❌ ' + String((e as Error).message ?? e))
    }
  }

  const hint = PROVIDER_PRESETS[s.provider]?.hint

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-lg font-semibold">模型设置</h2>
      <p className="text-sm text-slate-500">
        API Key 保存在本机浏览器存储中；调用模型时会发送给你选择的服务商，不经过本项目服务器。
      </p>
      <p className="text-sm text-slate-500">
        简历解析和网页分析会将相关文本及个人数据发送给该服务商。
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">服务商</label>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDER_ORDER.map((p) => (
            <button
              key={p}
              onClick={() => switchProvider(p)}
              className={`px-3 py-1.5 rounded border text-sm text-left ${
                s.provider === p
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {PROVIDER_PRESETS[p].label}
            </button>
          ))}
        </div>
        {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
      </div>

      <Field label="Base URL">
        <input
          value={s.baseUrl}
          onChange={(e) => update('baseUrl', e.target.value)}
          className="input"
          placeholder={
            s.provider === 'custom'
              ? '例如 https://your-proxy.com 或自部署地址'
              : PROVIDER_PRESETS[s.provider].baseUrl
          }
        />
      </Field>

      <Field label="API Key">
        <input
          type="password"
          value={s.apiKey}
          onChange={(e) => update('apiKey', e.target.value)}
          className="input"
          placeholder="sk-..."
        />
      </Field>

      <Field label="模型名">
        <input
          value={s.model}
          onChange={(e) => update('model', e.target.value)}
          className="input"
          placeholder={
            s.provider === 'custom' ? '你的模型名' : PROVIDER_PRESETS[s.provider].model
          }
        />
      </Field>

      <Field label="输出语言">
        <select
          value={s.outputLang}
          onChange={(e) => update('outputLang', e.target.value as LlmSettings['outputLang'])}
          className="input"
        >
          <option value="auto">自动（跟随页面/简历）</option>
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </Field>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded bg-brand-500 text-white px-4 py-2 text-sm hover:bg-brand-600"
        >
          保存
        </button>
        <button
          onClick={handleTest}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          测试连接
        </button>
        {saved && <span className="text-green-600 text-sm">已保存</span>}
        {test && <span className="text-sm">{test}</span>}
      </div>

      <style>{`.input{width:100%;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;font-size:14px}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  )
}
