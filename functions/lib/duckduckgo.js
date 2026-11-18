const SEARCH_URL = 'https://html.duckduckgo.com/html/';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_RESULTS = 5;

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function textContent(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).trim();
}

function resultUrl(value) {
  try {
    const parsed = new URL(decodeHtml(value), SEARCH_URL);
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname === '/l/') {
      const destination = parsed.searchParams.get('uddg');
      if (destination) return resultUrl(destination);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.hostname.endsWith('duckduckgo.com')) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

async function readLimitedText(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Search provider returned an empty response.');

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Search provider response exceeded the size limit.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseResults(html) {
  const titles = [];
  const titlePattern = /<a\b([^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(titlePattern)) {
    const href = match[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
    const url = href ? resultUrl(href) : '';
    const title = textContent(match[2]).slice(0, 300);
    if (url && title) titles.push({ title, url });
    if (titles.length === MAX_RESULTS) break;
  }

  const snippets = [...html.matchAll(/<(a|div|td)\b[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => textContent(match[2]).slice(0, 1200));

  return titles.map((result, index) => ({
    ...result,
    content: snippets[index] || '',
  }));
}

export async function searchDuckDuckGo(query, signal) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', query);
  const response = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent': 'Mozilla/5.0 (compatible; CarbonChat/1.0; +https://duckduckgo.com)',
    },
    signal,
  });
  if (!response.ok) throw new Error('DuckDuckGo search request failed.');
  return { results: parseResults(await readLimitedText(response)), images: [] };
}
