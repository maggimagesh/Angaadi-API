import type { RequestHeadersReport } from '@/utils/requestHeaders'

// Server-rendered HTML for /request-headers — "display the full request headers
// your browser sends", after manytools.org/http-html-text/http-request-headers.
//
// The headers are written into the HTML by the server, so the page is complete
// with JavaScript turned off and shows the headers of the real page navigation
// (not of a fetch() call). The small inline script only adds conveniences on
// top: theme and appearance switching, filtering, copy, download and sharing.
//
// Every value that came from the request is attacker-controllable, so all of it
// goes through escapeHtml() (or escapeJsonForScript() for the embedded JSON).

export type RequestHeadersPageOptions = {
  /** Absolute URL of this page, used for the share and link-to-page snippets. */
  pageUrl: string
  /** URL of the JSON endpoint with the same data. */
  jsonUrl: string
  /** The storefront, for the breadcrumb home link and contact link. */
  siteUrl: string
  /** Per-response CSP nonce for the inline <style> and <script>. */
  nonce: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** JSON that is safe to place inside a <script> element. */
export function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

const SHARE_TEXT = 'See the full HTTP request headers your browser sends'

const UPDATES: Array<{ date: string; iso: string; text: string }> = [
  {
    date: '16 October 2026',
    iso: '2026-10-16',
    text: 'Request headers is now a server-rendered page: it shows the headers of the page load itself and works with JavaScript turned off.',
  },
  {
    date: '16 October 2026',
    iso: '2026-10-16',
    text: 'New JSON endpoint /api/v1/request-headers returns the same data for scripts and test suites.',
  },
]

function renderRows(report: RequestHeadersReport): string {
  return report.headers
    .map((header) => {
      const name = escapeHtml(header.name)
      const lower = escapeHtml(header.name.toLowerCase())
      const badge = header.origin === 'proxy'
        ? ' <span class="badge" title="Added by the hosting proxy, not by your browser">proxy</span>'
        : ''
      let value: string
      if (header.value === '') {
        value = '<span class="muted">(empty)</span>'
      } else if (header.sensitive) {
        value = `<details class="secret"><summary>Hidden &mdash; click to reveal</summary><code>${escapeHtml(header.value)}</code></details>`
      } else {
        value = `<code>${escapeHtml(header.value)}</code>`
      }
      return `<tr data-header="${lower}" data-origin="${header.origin}"><th scope="row">${name}${badge}</th><td>${value}</td></tr>`
    })
    .join('\n')
}

const STYLES = `
:root{--font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;--mono:"SF Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
/* Apple — light (default) */
:root,html[data-theme=apple]{color-scheme:light;--bg:#f5f5f7;--bg-image:none;--surface:#fff;--surface-2:#fafafc;--fill:#e8e8ed;--ink:#1d1d1f;--ink-2:#6e6e73;--ink-3:#86868b;--line:#d2d2d7;--accent:#0071e3;--accent-hover:#0077ed;--on-accent:#fff;--link:#0066cc;--danger:#e30000;--shadow:2px 4px 12px rgba(0,0,0,.08);--radius:18px;--radius-sm:12px;--blur:none;--nav:rgba(250,250,252,.8)}
/* Apple — dark */
html[data-theme=apple][data-scheme=dark]{color-scheme:dark;--bg:#000;--surface:#1d1d1f;--surface-2:#232325;--fill:#333336;--ink:#f5f5f7;--ink-2:#a1a1a6;--ink-3:#86868b;--line:#424245;--link:#2997ff;--danger:#ff453a;--shadow:0 0 0 1px rgba(255,255,255,.06);--nav:rgba(22,22,23,.8)}
/* macOS 27 — light */
html[data-theme=macos-27]{color-scheme:light;--bg:#eaf0f8;--bg-image:radial-gradient(circle at 8% 4%,rgba(92,174,255,.33),transparent 31rem),radial-gradient(circle at 94% 13%,rgba(185,139,255,.24),transparent 34rem),radial-gradient(circle at 62% 91%,rgba(86,213,194,.17),transparent 36rem),linear-gradient(145deg,#f7faff 0%,#eaf0f8 48%,#f5effb 100%);--surface:rgba(255,255,255,.91);--surface-2:rgba(241,247,255,.66);--fill:#edf2f8;--ink:#172033;--ink-2:#536178;--ink-3:#6f7c90;--line:rgba(45,65,99,.16);--accent:#0878e8;--accent-hover:#075db7;--on-accent:#fff;--link:#0878e8;--danger:#d63f59;--shadow:0 16px 42px rgba(35,57,92,.14),inset 0 1px 0 rgba(255,255,255,.88);--radius:22px;--radius-sm:14px;--blur:blur(22px) saturate(1.6);--nav:rgba(249,252,255,.76)}
/* macOS 27 — dark */
html[data-theme=macos-27][data-scheme=dark]{color-scheme:dark;--bg:#0e131d;--bg-image:radial-gradient(circle at 8% 4%,rgba(61,155,255,.22),transparent 31rem),radial-gradient(circle at 94% 13%,rgba(138,125,255,.18),transparent 34rem),radial-gradient(circle at 62% 91%,rgba(58,208,143,.1),transparent 36rem),linear-gradient(145deg,#0b1018 0%,#0e131d 48%,#120f1c 100%);--surface:rgba(30,37,52,.9);--surface-2:rgba(40,49,68,.6);--fill:rgba(196,212,240,.1);--ink:#e9eef7;--ink-2:#a7b2c5;--ink-3:#808ca2;--line:rgba(196,212,240,.14);--accent:#3d9bff;--accent-hover:#74b6ff;--on-accent:#06101f;--link:#74b6ff;--danger:#ff6b7f;--shadow:0 16px 42px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08);--nav:rgba(34,42,58,.7)}
/* No script: follow the OS appearance */
@media (prefers-color-scheme:dark){
html[data-theme=apple]:not([data-scheme]){color-scheme:dark;--bg:#000;--surface:#1d1d1f;--surface-2:#232325;--fill:#333336;--ink:#f5f5f7;--ink-2:#a1a1a6;--line:#424245;--link:#2997ff;--danger:#ff453a;--shadow:0 0 0 1px rgba(255,255,255,.06);--nav:rgba(22,22,23,.8)}
}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{font-family:var(--font);font-size:15px;line-height:1.5;color:var(--ink);background:var(--bg);background-image:var(--bg-image);background-attachment:fixed;-webkit-font-smoothing:antialiased}
a{color:var(--link);text-underline-offset:.18em}
a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
code{font-family:var(--mono);font-size:13px}
.skip{position:absolute;left:-999px}.skip:focus{left:16px;top:8px;z-index:10;background:var(--surface);padding:8px 12px;border-radius:8px}
.nav{position:sticky;top:0;z-index:5;background:var(--nav);backdrop-filter:saturate(1.8) blur(20px);-webkit-backdrop-filter:saturate(1.8) blur(20px);border-bottom:1px solid var(--line)}
.nav-inner,.wrap{max-width:1120px;margin:0 auto;padding:0 16px}
.nav-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;flex-wrap:wrap}
.brand{font-weight:700;font-size:19px;letter-spacing:-.02em;color:var(--ink);text-decoration:none}
.brand small{font-weight:500;color:var(--ink-2);font-size:13px;margin-left:6px}
.theme-controls{display:flex;gap:8px;align-items:center}
.theme-controls[hidden]{display:none}
select,input[type=search],input[type=text],textarea{font:inherit;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:7px 10px}
textarea{width:100%;resize:vertical;font-family:var(--mono);font-size:13px}
.crumbs{margin:18px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px;font-size:13px;color:var(--ink-2)}
.crumbs li+li::before{content:"\\203A";margin-right:6px;color:var(--ink-3)}
.crumbs [aria-current]{color:var(--ink)}
.intro{max-width:72ch;margin:14px 0 22px}
.eyebrow{display:inline-block;font-size:12px;font-weight:600;color:var(--ink-2);border:1px solid var(--line);border-radius:999px;padding:2px 10px}
h1{font-size:clamp(26px,3.4vw,38px);line-height:1.12;letter-spacing:-.02em;margin:12px 0 10px}
h2{font-size:20px;letter-spacing:-.01em;margin:0}
h3{font-size:16px;margin:0 0 8px}
.lede{margin:0;color:var(--ink-2);font-size:16px}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);padding:20px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px}
.stat{padding:14px 16px}
.stat.wide{grid-column:1/-1}
.label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.value{margin-top:4px;font-size:17px;font-weight:600;overflow-wrap:anywhere}
.value.mono{font-family:var(--mono);font-size:14px}
.value.plain{font-weight:400}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tools[hidden]{display:none}
.check{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--ink-2);cursor:pointer}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:14px;line-height:1;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);text-decoration:none;cursor:pointer}
.btn[hidden]{display:none}
.btn:hover{background:var(--fill);text-decoration:none}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.btn.primary:hover{background:var(--accent-hover)}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius-sm)}
table{width:100%;border-collapse:collapse;font-size:14px}
thead th{text-align:left;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);background:var(--surface-2);padding:10px 14px;border-bottom:1px solid var(--line)}
tbody th,tbody td{text-align:left;vertical-align:top;padding:10px 14px;border-bottom:1px solid var(--line)}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:var(--surface-2)}
tbody th{width:32%;min-width:150px;font-weight:600}
tbody td{overflow-wrap:anywhere;word-break:break-word}
tr[hidden]{display:none}
.badge{display:inline-block;margin-left:6px;padding:1px 7px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);background:var(--fill);border-radius:999px;vertical-align:1px}
.muted{color:var(--ink-3);font-style:italic}
.secret summary{cursor:pointer;color:var(--ink-3);font-size:13px}
.secret[open] summary{margin-bottom:4px}
.empty{padding:18px;text-align:center;color:var(--ink-2)}
.note{margin:14px 0 0;font-size:13px;color:var(--ink-2)}
aside .card+.card{margin-top:16px}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;font-size:13px;color:var(--ink-2)}
.counter{font-size:12px;color:var(--ink-3);text-align:right}
.counter.over{color:var(--danger);font-weight:600}
.row{display:flex;flex-wrap:wrap;gap:8px}
.updates{list-style:none;margin:0;padding:0}
.updates li{padding:10px 0;border-top:1px solid var(--line);font-size:14px}
.updates li:first-child{border-top:0;padding-top:0}
.updates time{display:block;font-size:12px;color:var(--ink-3)}
footer{margin:36px 0 0;padding:22px 0 40px;border-top:1px solid var(--line);font-size:13px;color:var(--ink-2)}
footer .wrap{display:grid;grid-template-columns:2fr 1fr;gap:16px}
footer p{margin:0 0 6px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:999px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s}
.toast.show{opacity:1}
@media (max-width:860px){.layout{grid-template-columns:1fr}footer .wrap{grid-template-columns:1fr}}
@media (max-width:560px){.stats{grid-template-columns:1fr 1fr}.stat.wide{grid-column:1/-1}tbody th{min-width:110px;width:38%}.tools input[type=search]{flex:1 1 100%}}
@media print{.nav,.tools,aside,.skip{display:none}.layout{grid-template-columns:1fr}.card{box-shadow:none}}
`

// Runs before first paint so a stored theme never flashes the default.
const BOOT_SCRIPT = `(function(){var d=document.documentElement,t='apple',a='system';try{var st=localStorage.getItem('angaadi:theme');if(st==='apple'||st==='macos-27')t=st;var sa=localStorage.getItem('angaadi:appearance');if(sa==='light'||sa==='dark'||sa==='system')a=sa}catch(e){}d.setAttribute('data-theme',t);d.setAttribute('data-appearance',a);var s=a==='system'?(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):a;d.setAttribute('data-scheme',s)})();`

const APP_SCRIPT = `(function(){
var d=document,root=d.documentElement,$=function(s){return d.querySelector(s)},$$=function(s){return Array.prototype.slice.call(d.querySelectorAll(s))};
var data=JSON.parse($('#request-data').textContent);
function store(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function toast(msg){var t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(function(){t.classList.remove('show')},1600)}
function copy(text,msg){function done(){toast(msg||'Copied')}if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done,fallback)}else fallback();function fallback(){var ta=d.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.className='skip';d.body.appendChild(ta);ta.select();try{d.execCommand('copy');done()}catch(e){toast('Copy failed')}d.body.removeChild(ta)}}
/* theme + appearance */
var themeSel=$('#theme-select'),appSel=$('#appearance-select'),mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
function applyScheme(){var a=root.getAttribute('data-appearance')||'system';root.setAttribute('data-scheme',a==='system'?(mq&&mq.matches?'dark':'light'):a)}
themeSel.value=root.getAttribute('data-theme');appSel.value=root.getAttribute('data-appearance');
themeSel.addEventListener('change',function(){root.setAttribute('data-theme',themeSel.value);store('angaadi:theme',themeSel.value)});
appSel.addEventListener('change',function(){root.setAttribute('data-appearance',appSel.value);store('angaadi:appearance',appSel.value);applyScheme()});
if(mq){var onMq=function(){if(root.getAttribute('data-appearance')==='system')applyScheme()};mq.addEventListener?mq.addEventListener('change',onMq):mq.addListener(onMq)}
$('#theme-controls').hidden=false;$('#tools').hidden=false;
/* filter + proxy toggle */
var filter=$('#filter'),hideProxy=$('#hide-proxy'),rows=$$('#headers-table tbody tr[data-header]'),none=$('#no-match');
function applyFilter(){var q=filter.value.trim().toLowerCase(),shown=0;rows.forEach(function(r){var hit=(!hideProxy.checked||r.getAttribute('data-origin')==='client')&&(!q||r.textContent.toLowerCase().indexOf(q)>-1);r.hidden=!hit;if(hit)shown++});none.hidden=shown>0;$('#shown-count').textContent=shown+' of '+rows.length}
filter.addEventListener('input',applyFilter);hideProxy.addEventListener('change',applyFilter);applyFilter();
/* secrets */
var revealBtn=$('#reveal'),secrets=$$('details.secret');
if(secrets.length){revealBtn.hidden=false;revealBtn.addEventListener('click',function(){var open=revealBtn.getAttribute('aria-pressed')!=='true';secrets.forEach(function(s){s.open=open});revealBtn.setAttribute('aria-pressed',String(open));revealBtn.textContent=open?'Hide secrets':'Reveal secrets'})}
/* copy + download */
$('#copy-all').addEventListener('click',function(){copy(data.headers.map(function(h){return h.name+': '+h.value}).join('\\n'),'Headers copied')});
$('#copy-json').addEventListener('click',function(){copy(JSON.stringify(data,null,2),'JSON copied')});
$('#download').addEventListener('click',function(){var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=d.createElement('a');a.href=URL.createObjectURL(blob);a.download='request-headers-'+data.timestamp.replace(/[:.]/g,'-')+'.json';d.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},0)});
/* share */
var msg=$('#share-message'),full=$('#share-full'),counter=$('#share-counter'),url=$('#share-url').value,LIMIT=140;
function shareText(){return msg.value.trim()+(full.checked?' '+url:'')}
function updateShare(){var text=shareText(),left=LIMIT-text.length;counter.textContent=left+' characters left';counter.classList.toggle('over',left<0);$('#share-x').href='https://twitter.com/intent/tweet?text='+encodeURIComponent(text);$('#share-fb').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url)+'&quote='+encodeURIComponent(msg.value.trim())}
msg.addEventListener('input',updateShare);full.addEventListener('change',updateShare);updateShare();
$('#share-copy').addEventListener('click',function(){copy(url,'Link copied')});
if(navigator.share){var ns=$('#share-native');ns.hidden=false;ns.addEventListener('click',function(){navigator.share({title:d.title,text:msg.value.trim(),url:url}).catch(function(){})})}
$('#snippet-copy').addEventListener('click',function(){copy($('#snippet').value,'HTML copied')});
/* local time */
var ts=$('#captured');if(ts){try{ts.textContent=new Date(data.timestamp).toLocaleString()}catch(e){}}
})();`

export function renderRequestHeadersPage(report: RequestHeadersReport, options: RequestHeadersPageOptions): string {
  const { pageUrl, jsonUrl, siteUrl, nonce } = options
  const n = escapeHtml(nonce)
  const proxyCount = report.headers.filter((h) => h.origin === 'proxy').length
  const pageUrlHtml = escapeHtml(pageUrl)
  const snippet = `<a href="${pageUrl}">HTTP request headers – see what your browser sends</a>`
  const defaultShare = `${SHARE_TEXT} ${pageUrl}`

  return `<!DOCTYPE html>
<html lang="en" data-theme="apple">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HTTP request headers – Angaadi</title>
<meta name="description" content="Display the full HTTP request headers your browser sends, with your IP address and user agent.">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="HTTP request headers – Angaadi">
<meta property="og:description" content="${escapeHtml(SHARE_TEXT)}.">
<meta property="og:url" content="${pageUrlHtml}">
<link rel="canonical" href="${pageUrlHtml}">
<link rel="alternate" type="application/json" href="${escapeHtml(jsonUrl)}">
<script nonce="${n}">${BOOT_SCRIPT}</script>
<style nonce="${n}">${STYLES}</style>
</head>
<body id="request-headers-page" data-testid="request-headers-page">
<a class="skip" href="#headers">Skip to headers</a>
<header class="nav">
  <div class="nav-inner">
    <a class="brand" href="${escapeHtml(siteUrl)}">angaadi<small>HTTP tools</small></a>
    <div class="theme-controls" id="theme-controls" hidden>
      <label class="skip" for="theme-select">Theme</label>
      <select id="theme-select" data-testid="theme-select"><option value="apple">Apple</option><option value="macos-27">macOS 27</option></select>
      <label class="skip" for="appearance-select">Appearance</label>
      <select id="appearance-select" data-testid="appearance-select"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select>
    </div>
  </div>
</header>

<main class="wrap">
  <nav aria-label="Breadcrumb">
    <ol class="crumbs" data-testid="breadcrumb">
      <li><a href="${escapeHtml(siteUrl)}">Home</a></li>
      <li>HTTP tools</li>
      <li aria-current="page">Request headers</li>
    </ol>
  </nav>

  <div class="intro">
    <span class="eyebrow">HTTP tools</span>
    <h1 id="request-headers-title" data-testid="request-headers-title">HTTP headers – display the full request headers your browser sends</h1>
    <p class="lede">Each time your browser requests a page over HTTP it sends request headers with information about itself and what it will accept. The table below shows the headers your browser sent to load this page, exactly as the server received them.</p>
  </div>

  <div class="layout">
    <div>
      <section class="stats" aria-label="Request summary" data-testid="request-headers-summary">
        <div class="card stat"><div class="label">Your IP</div><div class="value mono" id="request-headers-ip" data-testid="request-headers-ip">${escapeHtml(report.ip ?? 'Unknown')}</div></div>
        <div class="card stat"><div class="label">Request</div><div class="value mono" data-testid="request-headers-method">${escapeHtml(report.method)} · ${escapeHtml(report.protocol.toUpperCase())}/${escapeHtml(report.httpVersion)}</div></div>
        <div class="card stat"><div class="label">Headers</div><div class="value" id="request-headers-count" data-testid="request-headers-count">${report.headerCount}${proxyCount ? ` <span class="label">(${proxyCount} proxy)</span>` : ''}</div></div>
        <div class="card stat wide"><div class="label">User agent</div><div class="value mono plain" data-testid="request-headers-user-agent">${escapeHtml(report.userAgent ?? '—')}</div></div>
      </section>

      <section class="card" id="headers" aria-labelledby="headers-title">
        <div class="toolbar">
          <h2 id="headers-title">Request headers <span class="label" id="shown-count"></span></h2>
          <div class="tools" id="tools" hidden>
            <input type="search" id="filter" placeholder="Filter headers…" aria-label="Filter headers" data-testid="request-headers-filter">
            <label class="check"><input type="checkbox" id="hide-proxy" data-testid="request-headers-hide-proxy"> Hide proxy headers</label>
            <button type="button" class="btn" id="reveal" aria-pressed="false" hidden data-testid="request-headers-reveal">Reveal secrets</button>
            <button type="button" class="btn" id="copy-all" data-testid="request-headers-copy">Copy all</button>
            <button type="button" class="btn" id="copy-json" data-testid="request-headers-copy-json">Copy JSON</button>
            <button type="button" class="btn" id="download" data-testid="request-headers-download">Download</button>
          </div>
        </div>
        <div class="table-wrap">
          <table id="headers-table" data-testid="request-headers-table">
            <thead><tr><th scope="col">HTTP header</th><th scope="col">Value</th></tr></thead>
            <tbody>
${renderRows(report)}
<tr id="no-match" hidden><td colspan="2" class="empty" data-testid="request-headers-no-match">No headers match the filter.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="note" data-testid="request-headers-timestamp">Captured <time id="captured" datetime="${escapeHtml(report.timestamp)}">${escapeHtml(report.timestamp)}</time>. <a class="btn primary" href="${pageUrlHtml}" id="request-headers-refresh" data-testid="request-headers-refresh">Check again</a> <a href="${escapeHtml(jsonUrl)}" data-testid="request-headers-raw-link">View as JSON</a> · Nothing is stored: the page only reflects the request you just made.</p>
      </section>
    </div>

    <aside>
      <section class="card" aria-labelledby="share-title" data-testid="share-panel">
        <h3 id="share-title">Share this tool</h3>
        <label class="field">Page URL<input type="text" id="share-url" readonly value="${pageUrlHtml}" data-testid="share-url"></label>
        <label class="field">Message<textarea id="share-message" rows="3" maxlength="280" data-testid="share-message">${escapeHtml(SHARE_TEXT)}</textarea></label>
        <label class="check"><input type="checkbox" id="share-full" checked data-testid="share-full-link"> Insert full link</label>
        <div class="counter" id="share-counter" aria-live="polite" data-testid="share-counter"></div>
        <div class="row">
          <a class="btn primary" id="share-x" target="_blank" rel="noopener noreferrer" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(defaultShare)}" data-testid="share-x">Post on X</a>
          <a class="btn" id="share-fb" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}" data-testid="share-facebook">Facebook</a>
          <button type="button" class="btn" id="share-copy" data-testid="share-copy">Copy link</button>
          <button type="button" class="btn" id="share-native" hidden data-testid="share-native">Share…</button>
        </div>
      </section>

      <section class="card" aria-labelledby="link-title" data-testid="link-panel">
        <h3 id="link-title">Link to this page</h3>
        <label class="field">Paste this HTML into your site<textarea id="snippet" rows="4" readonly data-testid="link-snippet">${escapeHtml(snippet)}</textarea></label>
        <button type="button" class="btn" id="snippet-copy" data-testid="link-snippet-copy">Copy HTML</button>
      </section>

      <section class="card" aria-labelledby="contact-title" data-testid="contact-panel">
        <h3 id="contact-title">Problems?</h3>
        <p class="note">If this page shows something odd or you are missing a feature, <a href="${escapeHtml(siteUrl)}">get in touch through Angaadi</a>.</p>
      </section>

      <section class="card" aria-labelledby="updates-title" data-testid="updates-panel">
        <h3 id="updates-title">Updates</h3>
        <ul class="updates">
${UPDATES.map((u) => `<li><time datetime="${u.iso}">${escapeHtml(u.date)}</time>${escapeHtml(u.text)}</li>`).join('\n')}
        </ul>
      </section>
    </aside>
  </div>
</main>

<footer>
  <div class="wrap">
    <div>
      <p><strong>About</strong> — Angaadi is a practice storefront for test automation. Its HTTP tools show what really travels between your browser and a server.</p>
      <p>&copy; ${new Date(report.timestamp).getUTCFullYear()} Angaadi. Free to use for testing and learning.</p>
    </div>
    <div>
      <p><strong>Privacy</strong> — headers are read for this response only and never stored or logged by this page.</p>
      <p><strong>Disclaimer</strong> — provided as is; values may include headers added by the hosting proxy.</p>
    </div>
  </div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="request-data">${escapeJsonForScript(report)}</script>
<script nonce="${n}">${APP_SCRIPT}</script>
</body>
</html>`
}
