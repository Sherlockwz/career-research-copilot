// 从 URL 抓取网页并提取正文（在 background 中执行，避开页面 CORS 限制）
// 说明：这里用 fetch 拿原始 HTML，适合静态/半静态主页；
// 对完全依赖 JS 渲染的页面可能抓不全，此时提示用户改用「粘贴文本」。

export interface FetchedPage {
  url: string
  title: string
  text: string
}

// 极简HTML -> 纯文本：去 script/style/注释/标签，压缩空白
export function htmlToText(html: string): { title: string; text: string } {
  // 标题
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() : ''

  let s = html
  // 去掉不含正文的块
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<(nav|footer|header|svg|head)[\s\S]*?<\/\1>/gi, ' ')
  // 块级标签转换行，便于保留段落结构
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  // 去剩余标签
  s = stripTags(s)
  s = decodeEntities(s)
  // 压缩空白
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return { title, text: s.slice(0, 20000) }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

export async function fetchPageText(url: string): Promise<FetchedPage> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error('链接格式不正确，请填写完整网址（含 http/https）')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('只支持 http/https 链接')
  }

  let res: Response
  try {
    res = await fetch(u.toString(), { redirect: 'follow' })
  } catch (e) {
    throw new Error(
      '抓取失败：' +
        String((e as Error).message ?? e) +
        '。该网站可能禁止跨站抓取，可改用「粘贴文本」。'
    )
  }
  if (!res.ok) throw new Error(`抓取失败，HTTP ${res.status}`)

  const html = await res.text()
  const { title, text } = htmlToText(html)
  if (text.length < 40) {
    throw new Error(
      '抓到的正文过少（可能是需要登录或 JS 动态渲染的页面）。可改用「粘贴文本」。'
    )
  }
  return { url: u.toString(), title, text }
}
