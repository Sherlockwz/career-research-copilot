// UI 侧共享 hook 与工具
import { useEffect, useState, useCallback } from 'react'
import type { ProfileData } from '@/types/profile'
import { emptyProfile } from '@/types/profile'
import type {
  ScannedPage,
  DetectedField,
  FillInstruction,
  AnalyzeResult,
  StructureResult,
  TestLlmResult,
  AnalysisState,
} from '@/shared/messages'
import { sendMessage, sendToActiveTab } from '@/shared/messages'
import type { Suggestion } from '@/types'

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData>(emptyProfile())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const p = await sendMessage<ProfileData | { ok: false; error: string }>({ type: 'GET_PROFILE' })
      if (!p) setProfile(emptyProfile())
      else if ('ok' in p) throw new Error(p.error)
      else setProfile(p)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const save = useCallback(async (p: ProfileData) => {
    const result = await sendMessage<{ ok: boolean; error?: string }>({ type: 'SAVE_PROFILE', profile: p })
    if (!result?.ok) throw new Error(result?.error ?? '保存个人数据失败')
    setProfile(p)
  }, [])

  return { profile, setProfile, loading, error, reload, save }
}

// —— 各类后台/内容脚本调用封装 ——
export const api = {
  scanPage: () => sendToActiveTab<ScannedPage>({ type: 'SCAN_PAGE' }),
  detectFields: () =>
    sendToActiveTab<{ fields: DetectedField[]; host: string; url: string }>({
      type: 'DETECT_FIELDS',
    }),
  applyFill: (instructions: FillInstruction[]) =>
    sendToActiveTab<{ ok: boolean; filled: number }>({
      type: 'APPLY_FILL',
      instructions,
    }),
  clearHighlight: () => sendToActiveTab({ type: 'HIGHLIGHT_CLEAR' }),
  analyze: (page: ScannedPage) =>
    sendMessage<AnalyzeResult>({ type: 'ANALYZE_PAGE', page }),
  structure: (text: string, mergeInto: boolean) =>
    sendMessage<StructureResult>({ type: 'STRUCTURE_TEXT', text, mergeInto }),
  structureUrl: (url: string, mergeInto: boolean) =>
    sendMessage<StructureResult>({ type: 'STRUCTURE_URL', url, mergeInto }),
  testLlm: () => sendMessage<TestLlmResult>({ type: 'TEST_LLM' }),
}

const ANALYSIS_KEY = 'currentAnalysis'

export async function readAnalysis(): Promise<AnalysisState | null> {
  const r = await chrome.storage.local.get(ANALYSIS_KEY)
  return r[ANALYSIS_KEY] ?? null
}

export async function finishAnalysis(
  requestId: string,
  result: { suggestion: Suggestion } | { error: string }
): Promise<void> {
  const current = await readAnalysis()
  if (current?.requestId !== requestId || current.status !== 'pending') return
  const next: AnalysisState = 'suggestion' in result
    ? { status: 'complete', page: current.page, requestId, suggestion: result.suggestion }
    : { status: 'error', page: current.page, requestId, error: result.error }
  await chrome.storage.local.set({ [ANALYSIS_KEY]: next })
}

export function onAnalysisChange(cb: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes[ANALYSIS_KEY]) cb()
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
