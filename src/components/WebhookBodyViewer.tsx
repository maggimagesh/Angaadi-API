import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WebhookCaptureRecord } from '@/types/webhook'

// Network slice size. Big enough that a 127 MB body is ~16 round trips instead
// of thousands (round trips are what hurt when the app is a continent away),
// small enough that progress moves visibly and a retry is cheap.
const CHUNK_BYTES = 8 * 1024 * 1024

// Display page size. Decoupled from CHUNK_BYTES on purpose: the browser can
// hold a 127 MB payload in memory, but it cannot lay out 127 MB of text in one
// DOM node without locking the tab, so only one page is ever mounted.
const PAGE_CHARS = 256 * 1024

// Pretty-printing re-serializes the whole payload; past this it is slower and
// more memory than it is worth, so raw text is served instead.
const PRETTY_PRINT_LIMIT_BYTES = 8 * 1024 * 1024

interface Props {
  token: string
  request: WebhookCaptureRecord
  onLoadingChange?: (loading: boolean) => void
}

interface LoadState {
  status: 'idle' | 'loading' | 'done' | 'error' | 'cancelled'
  loadedBytes: number
  totalBytes: number
  startedAt: number
  error: string | null
  partial: boolean
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** unitIndex
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDuration(ms: number): string {
  const seconds = Math.max(ms, 0) / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  }
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds - minutes * 60)}s`
}

function isTextualContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true
  }
  const value = contentType.toLowerCase()
  return (
    value.startsWith('text/') ||
    value.includes('json') ||
    value.includes('xml') ||
    value.includes('javascript') ||
    value.includes('yaml') ||
    value.includes('csv') ||
    value.includes('x-www-form-urlencoded')
  )
}

function inlineBodyText(record: WebhookCaptureRecord): string | null {
  if (record.body.format === 'json' && record.body.json !== null && record.body.json !== undefined) {
    return JSON.stringify(record.body.json, null, 2)
  }
  if (record.body.text !== null && record.body.text !== undefined) {
    return record.body.text
  }
  if (record.body.format === 'binary' && record.body.base64) {
    return record.body.base64
  }
  return null
}

function splitIntoPages(text: string): string[] {
  if (text.length <= PAGE_CHARS) {
    return [text]
  }
  const pages: string[] = []
  for (let index = 0; index < text.length; index += PAGE_CHARS) {
    pages.push(text.slice(index, index + PAGE_CHARS))
  }
  return pages
}

export default function WebhookBodyViewer({ token, request, onLoadingChange }: Props) {
  const bodyUrl = `/api/webhook/${encodeURIComponent(token)}/${encodeURIComponent(request.id)}/body`
  const sizeBytes = request.body.sizeBytes
  const textual = isTextualContentType(request.body.contentType)
  const isEmpty = sizeBytes === 0 || request.body.format === 'empty'

  const inlineText = useMemo(() => inlineBodyText(request), [request])

  const [pages, setPages] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pretty, setPretty] = useState(false)
  const [wrap, setWrap] = useState(true)
  const [load, setLoad] = useState<LoadState>({
    status: 'idle',
    loadedBytes: 0,
    totalBytes: sizeBytes,
    startedAt: 0,
    error: null,
    partial: false,
  })

  const abortRef = useRef<AbortController | null>(null)

  // Every piece of viewer state belongs to one captured request. The inspector
  // re-polls every couple of seconds and can swap the selection underneath us,
  // so reset hard whenever the request changes and abort any transfer still in
  // flight for the previous one.
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPages([])
    setPageIndex(0)
    setPretty(false)
    setLoad({
      status: 'idle',
      loadedBytes: 0,
      totalBytes: sizeBytes,
      startedAt: 0,
      error: null,
      partial: false,
    })
  }, [request.id, sizeBytes])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    onLoadingChange?.(load.status === 'loading')
  }, [load.status, onLoadingChange])

  const loadBody = useCallback(
    async (maxBytes: number | null) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const startedAt = Date.now()
      setPages([])
      setPageIndex(0)
      setPretty(false)
      setLoad({
        status: 'loading',
        loadedBytes: 0,
        totalBytes: sizeBytes,
        startedAt,
        error: null,
        partial: false,
      })

      // Chunks are decoded as a single UTF-8 stream so a multi-byte character
      // split across a slice boundary still comes out intact.
      const decoder = new TextDecoder('utf-8')
      const collected: string[] = []
      let pending = ''
      let offset = 0
      let total = sizeBytes

      const flushPending = (final: boolean) => {
        while (pending.length >= PAGE_CHARS) {
          collected.push(pending.slice(0, PAGE_CHARS))
          pending = pending.slice(PAGE_CHARS)
        }
        if (final && pending.length > 0) {
          collected.push(pending)
          pending = ''
        }
      }

      try {
        while (offset < total) {
          const remainingAllowance = maxBytes === null ? CHUNK_BYTES : Math.min(CHUNK_BYTES, maxBytes - offset)
          if (remainingAllowance <= 0) {
            break
          }

          const response = await fetch(
            `${bodyUrl}?offset=${offset}&limit=${remainingAllowance}`,
            { signal: controller.signal, headers: { Accept: '*/*' } }
          )

          if (!response.ok) {
            throw new Error(
              response.status === 404
                ? 'The captured body is no longer on disk (it may have aged out of retention).'
                : `Body fetch failed with status ${response.status}`
            )
          }

          const reportedTotal = Number(response.headers.get('x-body-total-bytes'))
          if (Number.isFinite(reportedTotal) && reportedTotal > 0) {
            total = reportedTotal
          }

          // Read the slice incrementally instead of awaiting the whole body:
          // gzip is unwrapped by the browser before this point, so every byte
          // read here is one source byte, which makes the progress bar move
          // continuously even when a single 8 MB slice takes a while to arrive.
          const chunkStart = offset
          let received = 0

          if (response.body) {
            const reader = response.body.getReader()
            let lastPaint = 0

            for (;;) {
              const { done, value } = await reader.read()
              if (done) {
                break
              }
              if (!value || value.byteLength === 0) {
                continue
              }

              received += value.byteLength
              pending += decoder.decode(value, { stream: true })
              flushPending(false)

              const loadedSoFar = chunkStart + received
              const currentTotal = total
              setLoad((current) => ({ ...current, loadedBytes: loadedSoFar, totalBytes: currentTotal }))

              // Repaint the page list at most a few times per slice: it is what
              // makes the payload readable from the first page onward, but
              // rebuilding it on every socket read would cost more than it buys.
              if (collected.length - lastPaint >= 8) {
                lastPaint = collected.length
                setPages(collected.slice())
              }
            }
          } else {
            // No streaming body (very old browsers): fall back to one buffer.
            const buffer = await response.arrayBuffer()
            received = buffer.byteLength
            pending += decoder.decode(new Uint8Array(buffer), { stream: true })
            flushPending(false)
          }

          // The server states how many source bytes the slice covered; trust it
          // over the received count so the next offset can never drift.
          const reportedChunk = Number(response.headers.get('x-body-chunk-bytes'))
          const consumed = Number.isFinite(reportedChunk) && reportedChunk > 0 ? reportedChunk : received

          if (consumed <= 0) {
            break
          }

          offset = chunkStart + consumed
          const loadedSoFar = offset
          const currentTotal = total
          setLoad((current) => ({ ...current, loadedBytes: loadedSoFar, totalBytes: currentTotal }))
          setPages(collected.slice())

          if (response.headers.get('x-body-complete') === '1') {
            break
          }
        }

        pending += decoder.decode()
        flushPending(true)

        const truncatedByAllowance = maxBytes !== null && offset < total
        setPages(collected.length > 0 ? collected : [''])
        setLoad({
          status: 'done',
          loadedBytes: offset,
          totalBytes: total,
          startedAt,
          error: null,
          partial: truncatedByAllowance,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          setLoad((current) => ({ ...current, status: 'cancelled' }))
          return
        }
        setLoad((current) => ({
          ...current,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to load the payload',
        }))
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [bodyUrl, sizeBytes]
  )

  const cancelLoad = () => {
    abortRef.current?.abort()
    abortRef.current = null
  }

  const activePages = useMemo(() => {
    if (pages.length > 0) {
      return pages
    }
    if (inlineText !== null) {
      return splitIntoPages(inlineText)
    }
    return []
  }, [pages, inlineText])

  const prettyPages = useMemo(() => {
    if (!pretty || activePages.length === 0) {
      return null
    }
    try {
      const parsed = JSON.parse(activePages.join(''))
      return splitIntoPages(JSON.stringify(parsed, null, 2))
    } catch {
      return null
    }
  }, [pretty, activePages])

  const viewPages = prettyPages || activePages
  const safePageIndex = Math.min(pageIndex, Math.max(viewPages.length - 1, 0))
  const currentPage = viewPages[safePageIndex] ?? ''

  const loadedAll = load.status === 'done' && !load.partial
  const canPrettyPrint =
    (request.body.contentType?.includes('json') || request.body.format === 'json') &&
    load.loadedBytes <= PRETTY_PRINT_LIMIT_BYTES &&
    sizeBytes <= PRETTY_PRINT_LIMIT_BYTES &&
    activePages.length > 0

  const percent = load.totalBytes > 0 ? Math.min((load.loadedBytes / load.totalBytes) * 100, 100) : 0
  const elapsedMs = load.startedAt > 0 ? Date.now() - load.startedAt : 0
  const throughput = elapsedMs > 0 ? (load.loadedBytes / elapsedMs) * 1000 : 0

  if (isEmpty) {
    return <pre className="body-pre">No request body</pre>
  }

  return (
    <div className="body-viewer">
      <div className="body-toolbar">
        <span className="body-stat">{formatBytes(sizeBytes)}</span>
        <span className="body-stat">{request.body.contentType || request.body.format}</span>

        {request.body.truncated && load.status !== 'done' ? (
          <>
            <button
              className="viewer-button primary"
              disabled={load.status === 'loading'}
              onClick={() => void loadBody(null)}
            >
              {load.status === 'loading' ? 'Loading…' : `Load full payload (${formatBytes(sizeBytes)})`}
            </button>
            {sizeBytes > CHUNK_BYTES ? (
              <button
                className="viewer-button"
                disabled={load.status === 'loading'}
                onClick={() => void loadBody(CHUNK_BYTES)}
              >
                {`Load first ${formatBytes(CHUNK_BYTES)}`}
              </button>
            ) : null}
          </>
        ) : null}

        {load.status === 'loading' ? (
          <button className="viewer-button" onClick={cancelLoad}>
            Cancel
          </button>
        ) : null}

        {load.status === 'done' && load.partial ? (
          <button className="viewer-button primary" onClick={() => void loadBody(null)}>
            Load the rest
          </button>
        ) : null}

        {loadedAll ? <span className="body-stat done">Fully loaded</span> : null}

        {canPrettyPrint ? (
          <button className="viewer-button" onClick={() => setPretty((current) => !current)}>
            {pretty ? 'Show raw' : 'Pretty print'}
          </button>
        ) : null}

        <button className="viewer-button" onClick={() => setWrap((current) => !current)}>
          {wrap ? 'No wrap' : 'Wrap lines'}
        </button>

        <a className="viewer-button" href={`${bodyUrl}?download=1`} download>
          Download raw
        </a>
      </div>

      {load.status === 'loading' ? (
        <div className="progress-block">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="progress-text">
            {`${formatBytes(load.loadedBytes)} of ${formatBytes(load.totalBytes)} (${percent.toFixed(1)}%) · ${formatDuration(elapsedMs)} elapsed · ${formatBytes(throughput)}/s`}
          </span>
        </div>
      ) : null}

      {load.status === 'error' ? <p className="viewer-error">{load.error}</p> : null}
      {load.status === 'cancelled' ? <p className="viewer-note">Load cancelled. Pages fetched so far are shown below.</p> : null}
      {load.status === 'done' && load.partial ? (
        <p className="viewer-note">
          {`Showing the first ${formatBytes(load.loadedBytes)} of ${formatBytes(load.totalBytes)}.`}
        </p>
      ) : null}

      {!textual ? (
        <p className="viewer-note">
          {`This body is not text (${request.body.contentType || 'unknown type'}). Its bytes are shown decoded as UTF-8, which is lossy — use Download raw for a faithful copy.`}
        </p>
      ) : null}

      {viewPages.length > 1 ? (
        <div className="pager">
          <button
            className="viewer-button"
            disabled={safePageIndex === 0}
            onClick={() => setPageIndex(0)}
          >
            First
          </button>
          <button
            className="viewer-button"
            disabled={safePageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(current - 1, 0))}
          >
            Prev
          </button>
          <span className="pager-label">
            {`Page ${safePageIndex + 1} of ${viewPages.length} · ${formatBytes(PAGE_CHARS)} per page`}
          </span>
          <button
            className="viewer-button"
            disabled={safePageIndex >= viewPages.length - 1}
            onClick={() => setPageIndex((current) => Math.min(current + 1, viewPages.length - 1))}
          >
            Next
          </button>
          <button
            className="viewer-button"
            disabled={safePageIndex >= viewPages.length - 1}
            onClick={() => setPageIndex(viewPages.length - 1)}
          >
            Last
          </button>
          <input
            className="pager-input"
            type="number"
            min={1}
            max={viewPages.length}
            value={safePageIndex + 1}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) {
                setPageIndex(Math.min(Math.max(Math.floor(next) - 1, 0), viewPages.length - 1))
              }
            }}
          />
        </div>
      ) : null}

      {viewPages.length > 0 ? (
        <pre className={`body-pre ${wrap ? '' : 'nowrap'}`}>{currentPage}</pre>
      ) : (
        <pre className="body-pre">{request.body.preview || 'No request body'}</pre>
      )}

      <style jsx>{`
        .body-viewer {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .body-toolbar,
        .pager {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .body-stat {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #5c6672;
        }

        .body-stat.done {
          color: #1d7a4c;
        }

        .viewer-button {
          border: 1px solid rgba(30, 35, 40, 0.18);
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 600;
          font-family: inherit;
          color: #1e2328;
          background: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          text-decoration: none;
        }

        .viewer-button:hover:not(:disabled) {
          background: rgba(246, 190, 78, 0.28);
        }

        .viewer-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .viewer-button.primary {
          background: #1e2328;
          border-color: #1e2328;
          color: #fdf8f1;
        }

        .viewer-button.primary:hover:not(:disabled) {
          background: #33393f;
        }

        .progress-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .progress-track {
          height: 8px;
          border-radius: 999px;
          background: rgba(30, 35, 40, 0.12);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f6be4e, #9b4d12);
          transition: width 120ms linear;
        }

        .progress-text {
          font-size: 0.78rem;
          color: #5c6672;
        }

        .viewer-error {
          margin: 0;
          font-size: 0.82rem;
          color: #a1341f;
        }

        .viewer-note {
          margin: 0;
          font-size: 0.82rem;
          color: #5c6672;
        }

        .pager-label {
          font-size: 0.78rem;
          color: #5c6672;
        }

        .pager-input {
          width: 84px;
          padding: 5px 8px;
          border-radius: 10px;
          border: 1px solid rgba(30, 35, 40, 0.18);
          font-family: inherit;
          font-size: 0.8rem;
        }

        .body-pre {
          margin: 0;
          padding: 14px;
          border-radius: 16px;
          background: rgba(30, 35, 40, 0.06);
          font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
          font-size: 0.8rem;
          line-height: 1.5;
          max-height: 460px;
          overflow: auto;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .body-pre.nowrap {
          white-space: pre;
          overflow-wrap: normal;
        }
      `}</style>
    </div>
  )
}
