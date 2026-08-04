import { useEffect, useState } from 'react'
import type { FieldMapping } from '@/types'
import { getAllMappings, clearMappings } from '@/lib/storage/settings'

export function MappingsTab() {
  const [all, setAll] = useState<Record<string, FieldMapping[]>>({})

  async function reload() {
    setAll(await getAllMappings())
  }
  useEffect(() => {
    reload()
  }, [])

  const hosts = Object.keys(all)

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">已学习的预填映射</h2>
        {hosts.length > 0 && (
          <button
            className="text-red-500 text-sm hover:underline"
            onClick={async () => {
              if (confirm('清空所有站点的映射？')) {
                await clearMappings()
                reload()
              }
            }}
          >
            清空全部
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500">
        每次你在某网站确认预填，插件会记住「该字段 → 你数据里的哪一项」，下次同站点更准。
      </p>

      {hosts.length === 0 ? (
        <p className="text-slate-400 text-sm">还没有学习到任何映射。</p>
      ) : (
        hosts.map((host) => (
          <div key={host} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{host}</h3>
              <button
                className="text-red-400 text-xs hover:underline"
                onClick={async () => {
                  await clearMappings(host)
                  reload()
                }}
              >
                删除此站点
              </button>
            </div>
            <table className="w-full text-xs">
              <thead className="text-slate-400 text-left">
                <tr>
                  <th className="py-1">字段</th>
                  <th>对应数据</th>
                  <th>置信度</th>
                  <th>确认次数</th>
                </tr>
              </thead>
              <tbody>
                {all[host].map((m) => (
                  <tr key={m.signatureKey} className="border-t border-slate-100">
                    <td className="py-1 pr-2">
                      {m.signature.label || m.signature.name || m.signature.id || '—'}
                    </td>
                    <td className="text-brand-600">{m.profilePath}</td>
                    <td>{Math.round(m.confidence * 100)}%</td>
                    <td>{m.hitCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
