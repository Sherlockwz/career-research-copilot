import { useState } from 'react'
import { useProfile } from '@/shared/ui'
import { SettingsTab } from './SettingsTab'
import { ImportTab } from './ImportTab'
import { EditorTab } from './EditorTab'
import { MappingsTab } from './MappingsTab'

type Tab = 'settings' | 'import' | 'editor' | 'mappings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'settings', label: '模型设置' },
  { id: 'import', label: '简历导入' },
  { id: 'editor', label: '数据编辑' },
  { id: 'mappings', label: '预填映射' },
]

export function Options() {
  const { profile, setProfile, save, replace, clear, loading, error } = useProfile()
  const [tab, setTab] = useState<Tab>('settings')
  const [clearing, setClearing] = useState(false)
  const [actionStatus, setActionStatus] = useState('')

  async function switchApplicant() {
    const name = profile.basic.name || profile.basic.nameEn || '当前求职人'
    if (!window.confirm(
      `确定清空「${name}」的个人资料并更换求职人吗？简历/主页原文、预填映射和分析结果也会删除；模型设置和 API Key 会保留。此操作无法撤销。`
    )) return
    setClearing(true)
    setActionStatus('正在清空个人信息…')
    try {
      await clear(profile.updatedAt)
      setTab('import')
      setActionStatus('已清空旧资料，现在可以导入另一位求职人。')
    } catch (e) {
      setActionStatus('清空失败：' + String((e as Error).message ?? e))
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-1">求职科研助手</h1>
        <p className="text-sm text-slate-500 mb-4">
          配置模型、管理简历数据与预填映射。所有数据仅存本地。
        </p>
        {error && <p className="text-sm text-red-600 mb-4">个人数据加载失败：{error}</p>}

        {!loading && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 mb-4">
            <span className="text-sm text-slate-600">
              当前求职人：<strong>{profile.basic.name || profile.basic.nameEn || '未填写姓名'}</strong>
            </span>
            <button
              type="button"
              disabled={clearing}
              onClick={() => void switchApplicant()}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              更换求职人 / 清空之前所有信息
            </button>
          </div>
        )}
        {actionStatus && <p className="text-sm text-slate-600 mb-4" role="status">{actionStatus}</p>}

        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${
                tab === t.id
                  ? 'border-brand-500 text-brand-700 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading || clearing ? (
          <p className="text-slate-400">加载中…</p>
        ) : (
          <>
            {tab === 'settings' && <SettingsTab />}
            {tab === 'import' && (
              <ImportTab
                profile={profile}
                onImported={(p, expectedUpdatedAt) => replace(p, expectedUpdatedAt)}
              />
            )}
            {tab === 'editor' && (
              <EditorTab
                profile={profile}
                onChange={setProfile}
                onSave={() => save(profile)}
              />
            )}
            {tab === 'mappings' && <MappingsTab />}
          </>
        )}
      </div>
    </div>
  )
}
