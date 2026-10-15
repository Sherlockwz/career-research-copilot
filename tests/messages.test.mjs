import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)

function loadTypeScript(path, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText
  const exports = {}
  const localRequire = (name) => {
    if (name === './signature') return loadTypeScript('../src/lib/forms/signature.ts', globals)
    return require(name)
  }
  new Function('exports', 'require', ...Object.keys(globals), code)(
    exports, localRequire, ...Object.values(globals),
  )
  return exports
}

test('reads an existing content script without injecting again', async () => {
  let injections = 0
  const chrome = {
    tabs: {
      query: async () => [{ id: 3, url: 'https://example.com/job' }],
      sendMessage: async () => ({ url: 'https://example.com/job', text: 'Job description' }),
    },
    scripting: { executeScript: async () => { injections++ } },
  }
  const { sendToActiveTab } = loadTypeScript('../src/shared/messages.ts', { chrome })
  const result = await sendToActiveTab({ type: 'SCAN_PAGE' })
  assert.equal(result.text, 'Job description')
  assert.equal(injections, 0)
})

test('injects the packaged content script into an already-open tab', async () => {
  let ready = false
  let injectedFiles
  const chrome = {
    tabs: {
      query: async () => [{ id: 4, url: 'https://example.com/job' }],
      sendMessage: async () => {
        if (!ready) throw new Error('Could not establish connection. Receiving end does not exist.')
        return { url: 'https://example.com/job', text: 'Job description' }
      },
    },
    runtime: { getManifest: () => ({ content_scripts: [{ js: ['assets/content-loader.js'] }] }) },
    scripting: { executeScript: async ({ files }) => { injectedFiles = files; ready = true } },
  }
  const { sendToActiveTab } = loadTypeScript('../src/shared/messages.ts', { chrome })
  const result = await sendToActiveTab({ type: 'SCAN_PAGE' })
  assert.equal(result.text, 'Job description')
  assert.deepEqual(injectedFiles, ['assets/content-loader.js'])
})

test('reports restricted pages and content-script errors', async () => {
  const chrome = {
    tabs: {
      query: async () => [{ id: 5, url: 'chrome://extensions' }],
      sendMessage: async () => ({ ok: false, error: 'page empty' }),
    },
  }
  const { sendToActiveTab } = loadTypeScript('../src/shared/messages.ts', { chrome })
  await assert.rejects(sendToActiveTab({ type: 'SCAN_PAGE' }), /不能由扩展读取/)
  chrome.tabs.query = async () => [{ id: 5, url: 'https://example.com' }]
  await assert.rejects(sendToActiveTab({ type: 'SCAN_PAGE' }), /page empty/)
})

test('does not put full names or cities into incompatible application fields', () => {
  const { matchFields } = loadTypeScript('../src/lib/forms/match.ts')
  const profile = {
    basic: { name: 'Zixuan Wang', location: 'Shanghai', email: 'user@example.com' },
    education: [], experiences: [], publications: [], skills: [], languages: [], summaries: [], updatedAt: 0,
  }
  const fields = [
    { refId: '1', signature: { label: 'First name', autocomplete: 'given-name' } },
    { refId: '2', signature: { label: 'Street address', autocomplete: 'street-address' } },
    { refId: '3', signature: { label: 'Email', autocomplete: 'email' } },
  ]
  assert.deepEqual(matchFields(fields, profile, []).map((m) => m.refId), ['3'])
})
