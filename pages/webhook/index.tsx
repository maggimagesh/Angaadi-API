import Head from 'next/head'
import { useState } from 'react'
import { createWebhookToken, isValidWebhookToken } from '@/utils/webhookToken'

export default function WebhookLandingPage() {
  const [manualToken, setManualToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  const openInspector = (token: string) => {
    const trimmedToken = token.trim()

    if (!isValidWebhookToken(trimmedToken)) {
      setError('Use 10 to 128 characters: letters, numbers, hyphens, or underscores.')
      return
    }

    setError(null)
    window.location.assign(`/webhook/${trimmedToken}`)
  }

  return (
    <>
      <Head>
        <title>Webhook Inbox</title>
        <meta
          name="description"
          content="Create a unique webhook capture URL and inspect incoming requests."
        />
      </Head>

      <main className="page-shell">
        <section className="hero-card">
          <p className="eyebrow">Webhook Inspector</p>
          <h1>Capture requests on a unique URL.</h1>
          <p className="lede">
            Create a token, send traffic to <code>/hook/&lt;token&gt;</code>, then inspect every
            request at <code>/webhook/&lt;token&gt;</code>.
          </p>

          <div className="actions">
            <button className="primary-button" onClick={() => openInspector(createWebhookToken())}>
              Create new inbox
            </button>

            <form
              className="manual-form"
              onSubmit={(event) => {
                event.preventDefault()
                openInspector(manualToken)
              }}
            >
              <label htmlFor="webhook-token" className="label">
                Open an existing token
              </label>
              <div className="manual-row">
                <input
                  id="webhook-token"
                  className="token-input"
                  type="text"
                  placeholder="Paste a token"
                  value={manualToken}
                  onChange={(event) => setManualToken(event.target.value)}
                  autoComplete="off"
                />
                <button type="submit" className="secondary-button">
                  Open
                </button>
              </div>
            </form>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <section className="details-grid">
          <article className="info-card">
            <h2>How it works</h2>
            <p>Each token creates an isolated inbox.</p>
            <p>Any HTTP method is accepted.</p>
            <p>Headers, query params, cookies, body, and response metadata are stored.</p>
          </article>

          <article className="info-card">
            <h2>Example</h2>
            <pre>{`curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"status":"ok","source":"local-test"}' \\
  http://localhost:3000/hook/<token>`}</pre>
          </article>
        </section>
      </main>

      <style jsx>{`
        .page-shell {
          min-height: 100vh;
          padding: 48px 20px 64px;
          background:
            radial-gradient(circle at top left, rgba(255, 183, 77, 0.18), transparent 35%),
            radial-gradient(circle at top right, rgba(82, 109, 130, 0.22), transparent 30%),
            linear-gradient(180deg, #f6f1e8 0%, #ece5da 100%);
          color: #1e2328;
          font-family: "Sora", "Avenir Next", "Segoe UI", sans-serif;
        }

        .hero-card,
        .info-card {
          width: min(1100px, 100%);
          margin: 0 auto;
          border: 1px solid rgba(30, 35, 40, 0.12);
          border-radius: 28px;
          background: rgba(255, 252, 247, 0.88);
          box-shadow: 0 24px 80px rgba(30, 35, 40, 0.08);
          backdrop-filter: blur(10px);
        }

        .hero-card {
          padding: 36px;
        }

        .eyebrow {
          margin: 0 0 12px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #9b4d12;
        }

        h1 {
          margin: 0;
          font-size: clamp(2.4rem, 6vw, 4.4rem);
          line-height: 0.95;
        }

        h2 {
          margin: 0 0 12px;
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #526d82;
        }

        .lede {
          max-width: 760px;
          margin: 20px 0 0;
          font-size: 1.05rem;
          color: #47525d;
        }

        .lede code,
        pre {
          font-family: "JetBrains Mono", "Fira Code", monospace;
        }

        .actions {
          display: grid;
          grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
          gap: 18px;
          margin-top: 28px;
          align-items: end;
        }

        .manual-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .label {
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #526d82;
        }

        .manual-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
        }

        .token-input {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid rgba(30, 35, 40, 0.14);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.75);
          color: inherit;
          font: inherit;
        }

        .primary-button,
        .secondary-button {
          border: none;
          border-radius: 16px;
          padding: 14px 18px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
        }

        .primary-button {
          min-height: 54px;
          background: linear-gradient(135deg, #1e2328 0%, #36414a 100%);
          color: #fff7eb;
          box-shadow: 0 14px 30px rgba(30, 35, 40, 0.2);
        }

        .secondary-button {
          background: #d7c1a5;
          color: #1e2328;
        }

        .primary-button:hover,
        .secondary-button:hover {
          transform: translateY(-1px);
        }

        .error-text {
          margin: 14px 0 0;
          color: #a03232;
          font-weight: 600;
        }

        .details-grid {
          width: min(1100px, 100%);
          margin: 22px auto 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .info-card {
          padding: 24px;
        }

        .info-card p {
          margin: 0 0 10px;
          color: #47525d;
        }

        .info-card pre {
          margin: 0;
          padding: 16px;
          overflow: auto;
          border-radius: 18px;
          background: #1e2328;
          color: #fff7eb;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        @media (max-width: 800px) {
          .hero-card {
            padding: 24px;
          }

          .actions,
          .details-grid,
          .manual-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}
