// 纯前端 PDF 文本提取（pdf.js）
import * as pdfjsLib from 'pdfjs-dist'
// Vite 会把 worker 作为资源打包，用 ?url 拿到可访问路径
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const strings = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .filter(Boolean)
    parts.push(strings.join(' '))
  }
  return parts.join('\n\n').replace(/[ \t]{2,}/g, ' ').trim()
}
