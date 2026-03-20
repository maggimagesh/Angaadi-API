import Head from 'next/head'
import { GetServerSideProps } from 'next'

interface SlowLoadingPageProps {
  loadTime: number
  timestamp: number
}

export default function SlowLoadingPage({ loadTime, timestamp }: SlowLoadingPageProps) {
  return (
    <>
      <Head>
        <title>Slow Loading Page</title>
        <meta name="description" content="This page takes 60 seconds to load" />
      </Head>

      <main className="page-shell">
        <section className="hero-card">
          <p className="eyebrow">Slow Loading Demo</p>
          <h1>Page Loaded Successfully!</h1>
          <p className="lede">
            This page took <strong>{loadTime} seconds</strong> to load.
          </p>
          <p className="info-text">
            Server timestamp: {new Date(timestamp).toLocaleString()}
          </p>
        </section>

        <section className="content-grid">
          <article className="info-card">
            <h2>How It Works</h2>
            <p>
              The server delays the response for 60 seconds before sending any HTML,
              JavaScript, or images to the browser.
            </p>
            <p>
              During this time, the browser shows a blank page with no detectable content.
            </p>
          </article>

          <article className="info-card">
            <h2>Technical Details</h2>
            <p>
              This is achieved using Next.js <code>getServerSideProps</code> which blocks
              the page render until the server-side function completes.
            </p>
            <p>
              No chunk loading, no progressive rendering - complete delay until ready.
            </p>
          </article>
        </section>

        <section className="image-section">
          <div className="image-card">
            <h2>Sample Image</h2>
            <div className="image-placeholder">
              <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
                <rect fill="#FFB74D" width="400" height="200" />
                <circle cx="200" cy="80" r="40" fill="#526D82" />
                <path d="M0 140 L100 100 L200 160 L300 80 L400 140 L400 200 L0 200 Z" fill="#36414A" />
                <text x="200" y="180" textAnchor="middle" fill="#1E2328" fontSize="16" fontWeight="bold">
                  Loaded After 60s
                </text>
              </svg>
            </div>
          </div>
        </section>

        <section className="features-grid">
          <div className="feature-item">
            <div className="feature-icon">⏱️</div>
            <h3>60 Second Delay</h3>
            <p>Complete server-side blocking</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🔒</div>
            <h3>No Early Detection</h3>
            <p>No HTML/JS sent until ready</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">📦</div>
            <h3>Full Content Load</h3>
            <p>Everything loads at once after delay</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🖼️</div>
            <h3>Images Included</h3>
            <p>SVG images load with the page</p>
          </div>
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
          text-align: center;
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
          color: #1e2328;
        }

        h2 {
          margin: 0 0 12px;
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #526d82;
        }

        h3 {
          margin: 0 0 8px;
          font-size: 1rem;
          color: #1e2328;
        }

        .lede {
          max-width: 760px;
          margin: 20px auto 0;
          font-size: 1.05rem;
          color: #47525d;
        }

        .lede strong {
          color: #9b4d12;
          font-size: 1.2rem;
        }

        .info-text {
          margin-top: 16px;
          font-size: 0.9rem;
          color: #526d82;
          font-family: "JetBrains Mono", "Fira Code", monospace;
        }

        .content-grid {
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
          line-height: 1.6;
        }

        .info-card code {
          font-family: "JetBrains Mono", "Fira Code", monospace;
          background: rgba(30, 35, 40, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .image-section {
          width: min(1100px, 100%);
          margin: 22px auto 0;
        }

        .image-card {
          padding: 24px;
          border: 1px solid rgba(30, 35, 40, 0.12);
          border-radius: 28px;
          background: rgba(255, 252, 247, 0.88);
          box-shadow: 0 24px 80px rgba(30, 35, 40, 0.08);
          backdrop-filter: blur(10px);
        }

        .image-card h2 {
          text-align: center;
        }

        .image-placeholder {
          margin-top: 16px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(30, 35, 40, 0.12);
        }

        .image-placeholder svg {
          width: 100%;
          height: auto;
          display: block;
        }

        .features-grid {
          width: min(1100px, 100%);
          margin: 22px auto 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
        }

        .feature-item {
          padding: 24px;
          border: 1px solid rgba(30, 35, 40, 0.12);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.6);
          text-align: center;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .feature-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(30, 35, 40, 0.1);
        }

        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
        }

        .feature-item p {
          margin: 0;
          font-size: 0.9rem;
          color: #47525d;
        }

        @media (max-width: 800px) {
          .hero-card {
            padding: 24px;
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  // Wait for 60 seconds before sending ANY response (including headers)
  await new Promise((resolve) => setTimeout(resolve, 60000))

  try {
    const response = await fetch('https://angaadi.online/')
    let html = await response.text()
    
    html = html.replace('<head>', '<head>\n    <base href="https://angaadi.online/">')
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.write(html)
    res.end()
  } catch (error) {
    console.error('Error fetching UI:', error)
  }

  return {
    props: {
      loadTime: 60,
      timestamp: Date.now(),
    },
  }
}
