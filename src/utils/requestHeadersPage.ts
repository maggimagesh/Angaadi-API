import type { RequestHeadersReport } from '@/utils/requestHeaders'

// HTML for /request-headers: the headers of the page request itself as one
// plain table, after manytools.org/http-html-text/http-request-headers.
// No script and nothing else on the page — the table is the whole document.
//
// Header values come from the request, so every one goes through escapeHtml().

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  body { margin: 16px; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #8888; padding: 6px 10px; text-align: left; vertical-align: top; }
  thead th { background: #8882; }
  td { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
`

export function renderRequestHeadersPage(report: RequestHeadersReport): string {
  const rows = report.headers
    .map(
      (h) =>
        `<tr data-header="${escapeHtml(h.name.toLowerCase())}"><th scope="row">${escapeHtml(h.name)}</th><td>${escapeHtml(h.value)}</td></tr>`
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>HTTP request headers</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<table id="request-headers-table" data-testid="request-headers-table">
<thead><tr><th scope="col">HTTP header</th><th scope="col">Value</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`
}
