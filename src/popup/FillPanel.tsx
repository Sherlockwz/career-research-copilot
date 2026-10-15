import { useState } from 'react'
import type { ProfileData } from '@/types/profile'
import type { DetectedField, FillInstruction } from '@/shared/messages'
import type { FieldMapping } from '@/types'
import { api } from '@/shared/ui'
import { getMappings, upsertMapping } from '@/lib/storage/settings'
import { signatureKey } from '@/lib/forms/signature'
import { matchFields, type FieldMatch } from '@/lib/forms/match'

interface Row extends FieldMatch {
  label: string
  signature: DetectedField['signature']
  edited: string
}

export function FillPanel({
  profile,
  onBack,
}: {
  profile: ProfileData
  onBack: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [host, setHost] = useState('')
  const [status, setStatus] = useState('')
  const [phase, setPhase] = useState<'idle' | 'matched' | 'filled'>('idle')

  async function ensureCurrentApplicant() {
    const current = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' }) as ProfileData
    if (current.updatedAt !== profile.updatedAt) {
      throw new Error('求职人资料已更换或更新，请重新打开插件后再操作表单。')
    }
  }

  async function handleDetect() {
    setStatus('探测表单…')
    try {
      await ensureCurrentApplicant()
      const { fields, host } = await api.detectFields()
      await ensureCurrentApplicant()
      setHost(host)
      const mappings = await getMappings(host)
      const matches = matchFields(fields, profile, mappings)
      const rows: Row[] = matches.map((m) => {
        const f = fields.find((x) => x.refId === m.refId)!
        return {
          ...m,
          label:
            f.signature.label ||
            f.signature.name ||
            f.signature.placeholder ||
            f.refId,
          signature: f.signature,
          edited: m.value,
        }
      })
      setRows(rows)
      setPhase('matched')
      setStatus(
        fields.length
          ? `发现 ${fields.length} 个可填字段，匹配到 ${rows.length} 个`
          : '未发现可填表单'
      )
    } catch (e) {
      setStatus('探测失败：' + String((e as Error).message ?? e))
    }
  }

  async function handleFill() {
    const instructions: FillInstruction[] = rows.map((r) => ({
      refId: r.refId,
      value: r.edited,
      confidence: r.confidence,
      profilePath: r.profilePath,
    }))
    try {
      await ensureCurrentApplicant()
      const r = await api.applyFill(instructions)
      if (!r.ok) throw new Error('填入失败')
      setPhase('filled')
      setStatus(`已填入 ${r.filled} / ${rows.length} 个字段。未填入的下拉选项或已变化字段请手动检查。修改后可点「确认并学习」。`)
    } catch (e) {
      setStatus('填入失败：' + String((e as Error).message ?? e))
    }
  }

  // 确认并学习：重新探测当前值，与建议比对，更新映射；并提示数据回写
  async function handleLearn() {
    try {
      await ensureCurrentApplicant()
      const { fields } = await api.detectFields()
      await ensureCurrentApplicant()
      const now = Date.now()
      const writeBack: { path: string; value: string; label: string }[] = []
      for (const row of rows) {
        const cur = fields.find((f) => f.refId === row.refId)
        if (!cur) continue // 页面重绘后原字段已消失，不能错误地学习其他字段
        const finalVal = cur.currentValue
        // 更新映射：用户保留/修正了该字段的映射即视为一次确认
        const mapping: FieldMapping = {
          host,
          signatureKey: signatureKey(row.signature),
          signature: row.signature,
          profilePath: row.profilePath,
          confidence: 0.9,
          hitCount: 1,
          updatedAt: now,
        }
        await ensureCurrentApplicant()
        await upsertMapping(mapping)
        // 数据回写候选：用户把值改得和 profile 不同 -> 建议回写
        if (row.profilePath.startsWith('basic.') && finalVal && finalVal !== row.value) {
          writeBack.push({ path: row.profilePath, value: finalVal, label: row.label })
        }
      }
      if (writeBack.length) {
        const list = writeBack.map((w) => `・${w.label}: ${w.value}`).join('\n')
        const ok = confirm(
          `检测到以下字段被你修改，是否回写到个人数据库（下次更准）？\n\n${list}`
        )
        if (ok) {
          await ensureCurrentApplicant()
          await applyWriteBack(profile, writeBack)
        }
        setStatus(
          ok ? '映射已学习，数据已回写。' : '映射已学习（未回写数据）。'
        )
      } else {
        setStatus('映射已学习，下次同站点预填更准。')
      }
    } catch (e) {
      setStatus('学习失败：' + String((e as Error).message ?? e))
    }
  }

  return (
    <div className="p-4 text-sm text-slate-800">
      <header className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700">
          ← 返回
        </button>
        <h1 className="font-semibold">自动预填</h1>
      </header>

      {phase === 'idle' && (
        <button
          onClick={handleDetect}
          className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium hover:bg-brand-600"
        >
          探测并匹配表单
        </button>
      )}

      {status && <p className="text-xs text-slate-500 my-2">{status}</p>}

      {rows.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-auto my-2">
          {rows.map((r, i) => (
            <div key={r.refId} className="border border-slate-200 rounded p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium truncate">{r.label}</span>
                <span
                  className={`text-[10px] px-1 rounded ${
                    r.confidence < 0.6
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-brand-100 text-brand-700'
                  }`}
                >
                  {r.confidence < 0.6 ? '低置信' : '已匹配'}
                </span>
              </div>
              <input
                value={r.edited}
                onChange={(e) => {
                  const v = e.target.value
                  setRows((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, edited: v } : x))
                  )
                }}
                className="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {phase === 'matched' && rows.length > 0 && (
        <button
          onClick={handleFill}
          className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium hover:bg-brand-600 mt-2"
        >
          填入页面并高亮
        </button>
      )}

      {phase === 'filled' && (
        <button
          onClick={handleLearn}
          className="w-full rounded-lg border border-brand-500 text-brand-600 py-2 font-medium hover:bg-brand-50 mt-2"
        >
          确认并学习（更新映射 / 回写数据）
        </button>
      )}
    </div>
  )
}

// 把回写值写回 profile（仅支持 basic.* 直接字段），保存
async function applyWriteBack(
  profile: ProfileData,
  items: { path: string; value: string }[]
) {
  const next: ProfileData = JSON.parse(JSON.stringify(profile))
  for (const it of items) {
    const [head, key] = it.path.split('.')
    if (head === 'basic' && key) {
      ;(next.basic as Record<string, unknown>)[key] = it.value
    }
  }
  const result = await chrome.runtime.sendMessage({ type: 'SAVE_PROFILE', profile: next }) as { ok: boolean; error?: string }
  if (!result?.ok) throw new Error(result?.error ?? '回写个人数据失败')
}
