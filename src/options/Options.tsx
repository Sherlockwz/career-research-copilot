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
  const { profile, setProfile, save, loading, error } = useProfile()
  const [tab, setTab] = useState<Tab>('settings')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-1">求职科研助手</h1>
        <p className="text-sm text-slate-500 mb-4">
          配置模型、管理简历数据与预填映射。所有数据仅存本地。
        </p>
        {error && <p className="text-sm text-red-600 mb-4">个人数据加载失败：{error}</p>}

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

        {loading ? (
          <p className="text-slate-400">加载中…</p>
        ) : (
          <>
            {tab === 'settings' && <SettingsTab />}
            {tab === 'import' && (
              <ImportTab
                profile={profile}
                onImported={(p) => save(p)}
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
