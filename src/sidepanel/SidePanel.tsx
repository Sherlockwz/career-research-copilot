import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Suggestion, JdSuggestion, ProfessorSuggestion } from '@/types'
import type { ScannedPage } from '@/shared/messages'
import { readSuggestion, onSuggestionChange } from '@/shared/ui'

export function SidePanel() {
  const [data, setData] = useState<{ s: Suggestion; page: ScannedPage } | null>(
    null
  )

  useEffect(() => {
    readSuggestion().then(setData)
    return onSuggestionChange(() => readSuggestion().then(setData))
  }, [])

  if (!data) {
    return (
      <div className="p-6 text-sm text-slate-500">
        还没有分析结果。在网页上打开插件，点「扫描当前页并给建议」。
      </div>
    )
  }

  return (
    <div className="p-4 text-sm text-slate-800">
      <div className="text-xs text-slate-400 mb-1 truncate" title={data.page.url}>
        {data.page.title || data.page.host}
      </div>
      {data.s.kind === 'jd' ? (
        <JdView s={data.s} />
      ) : (
        <ProfessorView s={data.s} />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="font-semibold text-slate-700 mb-1">{title}</h3>
      {children}
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1 text-slate-700">
      {items?.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }}
      className="text-xs text-brand-600 hover:underline"
    >
      {ok ? '已复制' : '复制'}
    </button>
  )
}

function JdView({ s }: { s: JdSuggestion }) {
  return (
    <>
      <h2 className="text-base font-semibold mb-2">岗位匹配建议</h2>
      <Section title="岗位理解">
        <p className="text-slate-700">{s.summary}</p>
      </Section>
      {s.matchPoints?.length > 0 && (
        <Section title="你的匹配点">
          <Bullets items={s.matchPoints} />
        </Section>
      )}
      {s.gaps?.length > 0 && (
        <Section title="差距">
          <Bullets items={s.gaps} />
        </Section>
      )}
      {s.optimizations?.length > 0 && (
        <Section title="优化建议">
          <div className="space-y-2">
            {s.optimizations.map((o, i) => (
              <div key={i} className="border border-slate-200 rounded p-2">
                <div className="font-medium text-xs text-brand-700">{o.area}</div>
                <p className="text-slate-700 mt-0.5">{o.advice}</p>
                {o.revisedText && (
                  <div className="mt-1 bg-slate-50 rounded p-2 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400">改写建议</span>
                      <CopyBtn text={o.revisedText} />
                    </div>
                    {o.revisedText}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {s.howToMatch?.length > 0 && (
        <Section title="如何更 match">
          <Bullets items={s.howToMatch} />
        </Section>
      )}
    </>
  )
}

function ProfessorView({ s }: { s: ProfessorSuggestion }) {
  const email = `${s.emailDraft?.subject ?? ''}\n\n${s.emailDraft?.body ?? ''}`
  return (
    <>
      <h2 className="text-base font-semibold mb-2">套词 / 合作建议</h2>
      {s.researchFocus?.length > 0 && (
        <Section title="教授研究方向">
          <Bullets items={s.researchFocus} />
        </Section>
      )}
      {s.commonGround?.length > 0 && (
        <Section title="共同点">
          <Bullets items={s.commonGround} />
        </Section>
      )}
      {s.approachAngles?.length > 0 && (
        <Section title="切入角度">
          <Bullets items={s.approachAngles} />
        </Section>
      )}
      {s.collaboration?.length > 0 && (
        <Section title="可行合作方向">
          <Bullets items={s.collaboration} />
        </Section>
      )}
      {s.emailDraft && (
        <Section title="套词邮件草稿">
          <div className="border border-slate-200 rounded p-2">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-xs">
                {s.emailDraft.subject}
              </span>
              <CopyBtn text={email} />
            </div>
            <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans">
              {s.emailDraft.body}
            </pre>
          </div>
        </Section>
      )}
    </>
  )
}
