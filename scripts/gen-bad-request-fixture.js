/*
 * Generator for the crawler 400-Bad-Request fixture page.
 *
 *   node scripts/gen-bad-request-fixture.js
 *
 * Emits public/bad-request/index.html — a self-contained static HTML page,
 * ~2 MB, embedding 100 same-origin links that each resolve to
 * /api/v1/status/400/<n> (always HTTP 400 Bad Request). Because the links
 * live in the raw HTML, both static (no-JS fetch) and dynamic (headless
 * render) crawls discover the same 100 URLs.
 */
const fs = require('fs')
const path = require('path')

const LINK_COUNT = 100
const TARGET_BYTES = 2_000_000 // ~2 MB, within the requested 1–6 MB band

// ── 100 link rows, grouped 10 per section so the page reads like a real
//    "endpoint catalogue" rather than a flat dump. ───────────────────────────
const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE']
function linkRow(n) {
  const href = `/api/v1/status/400/${n}`
  const method = methods[n % methods.length]
  return (
    `      <li class="ep">` +
    `<code class="m">${method}</code> ` +
    `<a href="${href}">${href}</a>` +
    `<span class="note">— fixture endpoint #${n}, always responds <strong>400 Bad Request</strong></span>` +
    `</li>`
  )
}

const sections = []
for (let s = 0; s < 10; s++) {
  const rows = []
  for (let i = 1; i <= 10; i++) {
    rows.push(linkRow(s * 10 + i))
  }
  sections.push(
    `    <section class="batch">\n` +
      `      <h2>Batch ${s + 1} · endpoints ${s * 10 + 1}–${s * 10 + 10}</h2>\n` +
      `      <ul class="endpoints">\n${rows.join('\n')}\n      </ul>\n` +
      `    </section>`
  )
}

// ── Filler prose to push the document into the ~2 MB range. Real visible
//    text content (not comments) so a static fetch sees a genuinely large
//    body, mirroring the existing public/5mb-* fixtures. ───────────────────
const lorem =
  'A focused crawler under test must treat a 400 Bad Request as a terminal, ' +
  'non-retryable client error: the request is malformed from the server’s ' +
  'point of view and re-issuing it unchanged will fail identically. The ' +
  'fixture endpoints below exist purely to assert that behaviour — every ' +
  'one of them answers 400 regardless of method, headers, or query string, so ' +
  'a correct crawler records the failure, refrains from retry storms, and ' +
  'continues scheduling the remaining frontier without aborting the whole job. '

function fillerParagraph(i) {
  // Vary each paragraph slightly so the bytes are not trivially compressible
  // away and the text stays plausible.
  return `      <p class="filler">[§${i}] ${lorem}${lorem}</p>`
}

const head = `<!DOCTYPE html>
<!--
  CRAWLER TEST FIXTURE — /bad-request
  Purpose : QA fixture for verifying a crawler's handling of HTTP 400 responses.
  Size    : ~2 MB of real HTML body (static + dynamic crawl see identical links).
  Links   : 100 same-origin links to /api/v1/status/400/<1..100>, each 400.
-->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>HTTP 400 Bad Request — Crawler Error-Handling Fixture</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
           font-size: 14px; line-height: 1.65; color: #1c1b1f; background: #f7f2f9; }
    .top-band { background: #b3261e; color: #fff; text-align: center; padding: 7px 16px; font-size: 13px; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }
    h1 { font-size: 22px; margin-bottom: 6px; }
    h2 { font-size: 16px; margin: 22px 0 8px; padding-bottom: 3px; border-bottom: 2px solid #f9dedc; }
    p { margin: 8px 0; }
    .meta { color: #4a4458; font-size: 13px; margin-bottom: 4px; }
    .endpoints { list-style: none; }
    .ep { padding: 4px 0; border-bottom: 1px solid #e4d9ea; }
    .m { display: inline-block; min-width: 52px; font-weight: 700; color: #b3261e; }
    a { color: #6750a4; font-weight: 600; text-decoration: none; }
    .note { color: #4a4458; font-style: italic; margin-left: 6px; font-size: 12px; }
    .filler { color: #514f57; }
    hr { border: none; border-top: 1px solid #d8cfe5; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="top-band">Angaadi Research Portal &nbsp;|&nbsp; Crawler QA &nbsp;|&nbsp; HTTP 400 Fixture</div>
  <div class="wrap">
    <p class="meta"><strong>Fixture:</strong> /bad-request &nbsp;·&nbsp; <strong>Links:</strong> 100 &nbsp;·&nbsp; <strong>Each returns:</strong> 400 Bad Request</p>
    <h1>HTTP 400 Bad Request — Crawler Error-Handling Fixture</h1>
    <p>This page embeds 100 same-origin links, each pointing at
      <code>/api/v1/status/400/&lt;n&gt;</code>, which always responds with
      <strong>HTTP 400 Bad Request</strong>. The links are present in the raw
      HTML, so a static (no-JavaScript) crawl and a dynamic (rendered) crawl
      discover the same set of URLs.</p>
    <hr />
`

const foot = `  </div>
</body>
</html>
`

// Assemble: head + the 10 link sections, then pad with filler paragraphs
// until we cross the target size, then close out.
let body = head + sections.join('\n') + '\n    <hr />\n    <h2>Reference notes</h2>\n'

let i = 1
while (Buffer.byteLength(body + foot, 'utf8') < TARGET_BYTES) {
  body += fillerParagraph(i++) + '\n'
}
body += foot

const outDir = path.join(__dirname, '..', 'public', 'bad-request')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'index.html')
fs.writeFileSync(outFile, body, 'utf8')

const bytes = Buffer.byteLength(body, 'utf8')
console.log(`Wrote ${outFile}`)
console.log(`Size: ${bytes} bytes (${(bytes / 1_048_576).toFixed(2)} MB), filler paragraphs: ${i - 1}`)
