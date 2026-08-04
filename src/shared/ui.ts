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
} from '@/shared/messages'
import { sendMessage, sendToActiveTab } from '@/shared/messages'
import type { Suggestion } from '@/types'

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData>(emptyProfile())
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const p = await sendMessage<ProfileData>({ type: 'GET_PROFILE' })
    setProfile(p ?? emptyProfile())
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const save = useCallback(async (p: ProfileData) => {
    await sendMessage({ type: 'SAVE_PROFILE', profile: p })
    setProfile(p)
  }, [])

  return { profile, setProfile, loading, reload, save }
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

// 把分析结果暂存，供 side panel 读取
const SUGGESTION_KEY = 'lastSuggestion'
export async function stashSuggestion(s: Suggestion, page: ScannedPage) {
  await chrome.storage.local.set({ [SUGGESTION_KEY]: { s, page, at: Date.now() } })
}
export async function readSuggestion(): Promise<{
  s: Suggestion
  page: ScannedPage
} | null> {
  const r = await chrome.storage.local.get(SUGGESTION_KEY)
  return r[SUGGESTION_KEY] ?? null
}
export function onSuggestionChange(cb: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes[SUGGESTION_KEY]) cb()
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
