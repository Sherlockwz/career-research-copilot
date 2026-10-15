import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const emptyProfile = () => ({
  basic: {}, education: [], experiences: [], publications: [], skills: [], languages: [], summaries: [], updatedAt: 0,
})

function loadTs(path, modules, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText
  const exports = {}
  new Function('exports', 'require', ...Object.keys(globals), code)(
    exports, (name) => modules[name], ...Object.values(globals),
  )
  return exports
}

function backgroundHarness(parsed) {
  let handler
  let profile = {
    ...emptyProfile(), basic: { name: '旧同学', email: 'old@example.com' },
    education: [{ id: 'old', school: '旧学校' }], updatedAt: 10,
  }
  const local = {
    llmSettings: { apiKey: 'operator-key' },
    fieldMappings: { 'example.com': [{ profilePath: 'basic.email' }] },
    currentAnalysis: { status: 'complete', suggestion: { summary: '旧同学' } },
  }
  const chrome = {
    tabs: { query: async () => [] },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(fn) { handler = fn } },
    },
    storage: {
      local: {
        async set(values) { Object.assign(local, values) },
        async remove(keys) { for (const key of keys) delete local[key] },
      },
    },
  }
  loadTs('../src/background/index.ts', {
    '@/shared/messages': { sendToTab: async () => ({}) },
    '@/types/profile': { emptyProfile },
    '@/lib/storage/settings': { getSettings: async () => ({}) },
    '@/lib/storage/profile': {
      loadProfile: async () => profile,
      saveProfile: async (next) => {
        if (next.updatedAt !== profile.updatedAt) throw new Error('stale profile')
        profile = { ...next, updatedAt: profile.updatedAt + 1 }
        return profile
      },
      replaceProfile: async (next, expectedUpdatedAt) => {
        if (expectedUpdatedAt !== profile.updatedAt) throw new Error('stale profile')
        profile = { ...next, updatedAt: profile.updatedAt + 1 }
        return profile
      },
    },
    '@/lib/llm': {
      chat: async () => ({ text: JSON.stringify(parsed) }),
      extractJson: JSON.parse,
      supportsJsonMode: () => false,
    },
    '@/lib/resume/fetchPage': { fetchPageText: async () => ({ text: '新同学主页' }) },
    '@/lib/prompts': { STRUCTURE_SYSTEM: '', structureUserPrompt: (text) => text },
  }, { chrome })
  const send = (message) => new Promise((resolve) => handler(message, {}, resolve))
  return { send, local, getProfile: () => profile }
}

test('new imports replace the old applicant and remove old personal state', async () => {
  const app = backgroundHarness({ basic: { name: '新同学' }, skills: [{ id: 'new', items: ['Python'] }] })
  const parsed = await app.send({ type: 'STRUCTURE_TEXT', text: '新同学简历' })
  const fromUrl = await app.send({ type: 'STRUCTURE_URL', url: 'https://example.com/new' })
  assert.equal(parsed.profile.basic.name, '新同学')
  assert.deepEqual(fromUrl.profile, parsed.profile)
  assert.deepEqual(parsed.profile.education, [])
  assert.equal(app.getProfile().basic.name, '旧同学', 'parsing alone must not overwrite saved data')

  const saved = await app.send({ type: 'REPLACE_PROFILE', profile: parsed.profile, expectedUpdatedAt: 10 })
  assert.equal(saved.ok, true)
  assert.equal(app.getProfile().basic.name, '新同学')
  assert.deepEqual(app.getProfile().education, [])
  assert.deepEqual(app.getProfile().skills, [{ id: 'new', items: ['Python'] }])
  assert.equal(app.local.fieldMappings, undefined)
  assert.equal(app.local.currentAnalysis, undefined)
  assert.deepEqual(app.local.llmSettings, { apiKey: 'operator-key' })

  const stale = await app.send({ type: 'SAVE_PROFILE', profile: { ...emptyProfile(), basic: { name: '旧同学' }, updatedAt: 10 } })
  assert.equal(stale.ok, false)
  assert.equal(app.getProfile().basic.name, '新同学')
})

test('switch applicant clears personal data but retains model settings', async () => {
  const app = backgroundHarness({})
  const result = await app.send({ type: 'CLEAR_PERSONAL_DATA', expectedUpdatedAt: 10 })
  assert.equal(result.ok, true)
  assert.deepEqual(app.getProfile().basic, {})
  assert.deepEqual(app.getProfile().education, [])
  assert.equal(app.local.fieldMappings, undefined)
  assert.equal(app.local.currentAnalysis, undefined)
  assert.deepEqual(app.local.llmSettings, { apiKey: 'operator-key' })
})

test('an education-only profile still counts as existing data', () => {
  const { hasProfileData } = loadTs('../src/types/profile.ts', {})
  assert.equal(hasProfileData({ ...emptyProfile(), education: [{ id: 'e1' }] }), true)
  assert.equal(hasProfileData(emptyProfile()), false)
})
