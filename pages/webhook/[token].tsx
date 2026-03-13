import Head from 'next/head'
import type { GetServerSidePropsContext, InferGetServerSidePropsType } from 'next'
import { useEffect, useState } from 'react'
import type { IncomingMessage } from 'http'
import type { WebhookCaptureListResponse, WebhookCaptureRecord } from '@/types/webhook'
import { isValidWebhookToken } from '@/utils/webhookToken'

function getSingleHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'undefined') {
    return null
  }

  return Array.isArray(value) ? value[0] || null : value
}

function buildOrigin(req: IncomingMessage): string {
  const forwardedProto = getSingleHeaderValue(req.headers['x-forwarded-proto'])?.split(',')[0]?.trim()
  const forwardedHost = getSingleHeaderValue(req.headers['x-forwarded-host'])?.split(',')[0]?.trim()
  const host = forwardedHost || req.headers.host || 'localhost:3000'
  const protocol = forwardedProto || 'http'

  return `${protocol}://${host}`
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** unitIndex

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function renderStructuredValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') {
    return 'None'
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function getBodyText(record: WebhookCaptureRecord): string {
  if (record.body.format === 'json') {
    return renderStructuredValue(record.body.json)
  }

  if (record.body.format === 'binary') {
    return record.body.base64 || 'Binary body missing'
  }

  return record.body.text || 'No request body'
}

function getResponseText(record: WebhookCaptureRecord): string {
  if (record.response.text) {
    return record.response.text
  }

  return renderStructuredValue(record.response.body)
}

export async function getServerSideProps(context: GetServerSidePropsContext<{ token: string }>) {
  const token = context.params?.token

  if (!token || !isValidWebhookToken(token)) {
    return { notFound: true }
  }

  const origin = buildOrigin(context.req)

  return {
    props: {
      token,
      initialCaptureUrl: `${origin}/hook/${token}`,
      initialInspectUrl: `${origin}/webhook/${token}`,
    },
  }
}

export default function WebhookInspectorPage({
  token,
  initialCaptureUrl,
  initialInspectUrl,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [payload, setPayload] = useState<WebhookCaptureListResponse>({
    token,
    captureUrl: initialCaptureUrl,
    inspectUrl: initialInspectUrl,
    requests: [],
  })
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const selectedRequest =
    payload.requests.find((request) => request.id === selectedRequestId) || payload.requests[0] || null

  const loadRequests = async (showSpinner: boolean) => {
    if (showSpinner) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const response = await fetch(`/api/webhook/${encodeURIComponent(token)}/requests`, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Inspector fetch failed with status ${response.status}`)
      }

      const nextPayload = (await response.json()) as WebhookCaptureListResponse

      setPayload(nextPayload)
      setSelectedRequestId((current) =>
        nextPayload.requests.some((request) => request.id === current)
          ? current
          : nextPayload.requests[0]?.id || null
      )
      setLastUpdatedAt(new Date().toISOString())
      setError(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Failed to load captured requests'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadRequests(true)

    const intervalId = window.setInterval(() => {
      void loadRequests(false)
    }, 2500)

    return () => window.clearInterval(intervalId)
  }, [token])

  const copyToClipboard = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyFeedback(key)
      window.setTimeout(() => {
        setCopyFeedback((current) => (current === key ? null : current))
      }, 1600)
    } catch {
      setError('Clipboard access failed')
    }
  }

  const clearRequests = async () => {
    if (!window.confirm(`Delete all captured requests for token ${token}?`)) {
      return
    }

    setRefreshing(true)

    try {
      const response = await fetch(`/api/webhook/${encodeURIComponent(token)}/requests`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Clear failed with status ${response.status}`)
      }

      setPayload((current) => ({ ...current, requests: [] }))
      setSelectedRequestId(null)
      setLastUpdatedAt(new Date().toISOString())
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to clear requests')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <Head>
        <title>{`Webhook ${token}`}</title>
        <meta
          name="description"
          content="Inspect captured webhook requests, headers, body, and response details."
        />
      </Head>

      <main className="page-shell">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">Live Webhook Inbox</p>
            <h1>{token}</h1>
            <p className="lede">
              Send traffic to the capture URL below. This page polls every 2.5 seconds and stores
              method, headers, query, cookies, body, and the API response.
            </p>
          </div>

          <div className="url-grid">
            <article className="url-card">
              <span className="url-label">Capture URL</span>
              <code>{payload.captureUrl}</code>
              <button onClick={() => void copyToClipboard('capture', payload.captureUrl)}>
                {copyFeedback === 'capture' ? 'Copied' : 'Copy'}
              </button>
            </article>

            <article className="url-card">
              <span className="url-label">Inspector URL</span>
              <code>{payload.inspectUrl}</code>
              <button onClick={() => void copyToClipboard('inspect', payload.inspectUrl)}>
                {copyFeedback === 'inspect' ? 'Copied' : 'Copy'}
              </button>
            </article>
          </div>

          <div className="toolbar">
            <button className="primary-button" onClick={() => void loadRequests(true)}>
              {refreshing ? 'Refreshing...' : 'Refresh now'}
            </button>
            <button className="secondary-button" onClick={() => void clearRequests()}>
              Clear inbox
            </button>
            <span className="status-line">
              {lastUpdatedAt ? `Last synced ${formatDateTime(lastUpdatedAt)}` : 'Waiting for first sync'}
            </span>
          </div>

          <div className="example-card">
            <span className="url-label">Quick test</span>
            <pre>{`curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"source":"curl","message":"hello"}' \\
  ${payload.captureUrl}`}</pre>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <section className="workspace-grid">
          <aside className="request-list-card">
            <div className="panel-header">
              <h2>Requests</h2>
              <span>{payload.requests.length}</span>
            </div>

            {loading ? <p className="empty-state">Loading captured requests...</p> : null}

            {!loading && payload.requests.length === 0 ? (
              <p className="empty-state">
                No requests yet. Send any HTTP request to <code>{payload.captureUrl}</code>.
              </p>
            ) : null}

            <div className="request-list">
              {payload.requests.map((request) => (
                <button
                  key={request.id}
                  className={`request-row ${selectedRequest?.id === request.id ? 'active' : ''}`}
                  onClick={() => setSelectedRequestId(request.id)}
                >
                  <span className="request-method">{request.method}</span>
                  <span className="request-path">{request.path}</span>
                  <span className="request-meta">
                    {formatDateTime(request.receivedAt)} · {formatBytes(request.body.sizeBytes)}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="details-column">
            {selectedRequest ? (
              <>
                <article className="detail-card">
                  <div className="panel-header">
                    <h2>Overview</h2>
                    <span>{selectedRequest.method}</span>
                  </div>
                  <div className="meta-grid">
                    <div>
                      <span className="meta-label">Received</span>
                      <strong>{formatDateTime(selectedRequest.receivedAt)}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Path</span>
                      <strong>{selectedRequest.path}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Remote IP</span>
                      <strong>{selectedRequest.ip || 'Unknown'}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Body Size</span>
                      <strong>{formatBytes(selectedRequest.body.sizeBytes)}</strong>
                    </div>
                    <div className="wide">
                      <span className="meta-label">Request URL</span>
                      <strong>{selectedRequest.url}</strong>
                    </div>
                  </div>
                </article>

                <article className="detail-card">
                  <div className="panel-header">
                    <h2>Body</h2>
                    <span>{selectedRequest.body.contentType || selectedRequest.body.format}</span>
                  </div>
                  <pre>{getBodyText(selectedRequest)}</pre>
                </article>

                <article className="detail-card">
                  <div className="panel-header">
                    <h2>Query</h2>
                    <span>{Object.keys(selectedRequest.query).length}</span>
                  </div>
                  <pre>{renderStructuredValue(selectedRequest.query)}</pre>
                </article>

                <article className="detail-card">
                  <div className="panel-header">
                    <h2>Headers</h2>
                    <span>{Object.keys(selectedRequest.headers).length}</span>
                  </div>
                  <pre>{renderStructuredValue(selectedRequest.headers)}</pre>
                </article>

                <article className="detail-card">
                  <div className="panel-header">
                    <h2>Cookies</h2>
                    <span>{Object.keys(selectedRequest.cookies).length}</span>
                  </div>
                  <pre>{renderStructuredValue(selectedRequest.cookies)}</pre>
                </article>

                <article className="detail-card">
                  <div className="panel-header">
                    <h2>Response</h2>
                    <span>{selectedRequest.response.statusCode}</span>
                  </div>
                  <pre>{getResponseText(selectedRequest)}</pre>
                </article>
              </>
            ) : (
              <article className="detail-card empty-detail">
                <h2>Inspector ready</h2>
                <p>Requests will appear here as soon as they arrive.</p>
              </article>
            )}
          </section>
        </section>
      </main>

      <style jsx>{`
        .page-shell {
          min-height: 100vh;
          padding: 32px 18px 56px;
          background:
            radial-gradient(circle at top left, rgba(246, 190, 78, 0.18), transparent 28%),
            radial-gradient(circle at 85% 15%, rgba(67, 94, 116, 0.22), transparent 25%),
            linear-gradient(180deg, #f3eee6 0%, #e6ddd2 100%);
          color: #1e2328;
          font-family: "Sora", "Avenir Next", "Segoe UI", sans-serif;
        }

        .hero-card,
        .request-list-card,
        .detail-card {
          border: 1px solid rgba(30, 35, 40, 0.12);
          border-radius: 24px;
          background: rgba(255, 251, 245, 0.88);
          box-shadow: 0 18px 60px rgba(30, 35, 40, 0.08);
          backdrop-filter: blur(10px);
        }

        .hero-card {
          width: min(1300px, 100%);
          margin: 0 auto 20px;
          padding: 28px;
        }

        .eyebrow {
          margin: 0 0 10px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #9b4d12;
        }

        h1 {
          margin: 0;
          font-size: clamp(1.8rem, 4vw, 3.4rem);
          line-height: 1;
          overflow-wrap: anywhere;
        }

        h2 {
          margin: 0;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #526d82;
        }

        .lede {
          max-width: 780px;
          margin: 14px 0 0;
          color: #4d5a65;
        }

        .url-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 22px;
        }

        .url-card,
        .example-card {
          display: grid;
          gap: 10px;
          padding: 18px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.68);
          border: 1px solid rgba(30, 35, 40, 0.08);
        }

        .url-card code,
        pre {
          font-family: "JetBrains Mono", "Fira Code", monospace;
        }

        .url-card code {
          overflow-wrap: anywhere;
          color: #1e2328;
          font-size: 0.95rem;
        }

        .url-label,
        .meta-label {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6b7d8d;
        }

        .url-card button,
        .primary-button,
        .secondary-button {
          justify-self: flex-start;
          border: none;
          border-radius: 14px;
          padding: 11px 16px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
        }

        .url-card button,
        .secondary-button {
          background: #d7c1a5;
          color: #1e2328;
        }

        .primary-button {
          background: linear-gradient(135deg, #1e2328 0%, #36414a 100%);
          color: #fff7eb;
          box-shadow: 0 14px 30px rgba(30, 35, 40, 0.18);
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-top: 18px;
        }

        .status-line {
          color: #52616c;
          font-size: 0.92rem;
        }

        .example-card {
          margin-top: 18px;
        }

        .example-card pre,
        .detail-card pre {
          margin: 0;
          padding: 16px;
          overflow: auto;
          border-radius: 18px;
          background: #1f252a;
          color: #f8f0e3;
          line-height: 1.55;
          font-size: 0.9rem;
        }

        .error-text {
          margin: 16px 0 0;
          color: #a03232;
          font-weight: 600;
        }

        .workspace-grid {
          width: min(1300px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .request-list-card {
          padding: 18px;
          position: sticky;
          top: 18px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 14px;
        }

        .panel-header span {
          color: #6b7d8d;
          font-weight: 700;
        }

        .request-list {
          display: grid;
          gap: 10px;
        }

        .request-row {
          display: grid;
          gap: 5px;
          width: 100%;
          padding: 14px;
          text-align: left;
          border: 1px solid rgba(30, 35, 40, 0.1);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.72);
          cursor: pointer;
          color: inherit;
        }

        .request-row.active {
          border-color: rgba(155, 77, 18, 0.45);
          background: linear-gradient(135deg, rgba(255, 223, 176, 0.65), rgba(255, 249, 240, 0.9));
          box-shadow: inset 0 0 0 1px rgba(155, 77, 18, 0.12);
        }

        .request-method {
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9b4d12;
        }

        .request-path {
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .request-meta,
        .empty-state,
        .empty-detail p {
          color: #59646f;
        }

        .details-column {
          display: grid;
          gap: 18px;
        }

        .detail-card {
          padding: 20px;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .meta-grid div {
          display: grid;
          gap: 6px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.68);
          border: 1px solid rgba(30, 35, 40, 0.08);
        }

        .meta-grid .wide {
          grid-column: 1 / -1;
        }

        .meta-grid strong {
          overflow-wrap: anywhere;
        }

        .empty-detail {
          min-height: 240px;
          display: grid;
          place-content: center;
          text-align: center;
        }

        @media (max-width: 1024px) {
          .workspace-grid {
            grid-template-columns: 1fr;
          }

          .request-list-card {
            position: static;
          }
        }

        @media (max-width: 760px) {
          .hero-card,
          .request-list-card,
          .detail-card {
            padding: 18px;
            border-radius: 20px;
          }

          .url-grid,
          .meta-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}
