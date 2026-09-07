import assert from 'assert'
import { promises as fsp, statfsSync } from 'fs'
import os from 'os'
import path from 'path'

// Emergency disk-pressure cleanup for the Fly volume mounted at /data.
//
// The time-based retention sweep (instrumentation-node.ts) only prunes
// webhook_inbox records it tracks in memory. Callback bodies under
// /data/callback_OP have no retention at all, so a burst of large uploads
// fills the 5 GiB volume in days. This guard is the backstop: when the
// volume crosses HIGH_WATER, delete oldest files first until back under
// LOW_WATER, regardless of which subtree they live in.

const DATA_ROOT =
  process.env.CALLBACK_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data'))

function readPct(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : fallback
}

// Trigger at 95% full, free down to 80%. Override in fly.toml [env].
const HIGH_WATER = readPct('DISK_GUARD_HIGH_WATER', 0.95)
const LOW_WATER = readPct('DISK_GUARD_LOW_WATER', 0.8)

// Never delete per-token auth configs — that silently disables auth on a token.
function isProtected(p: string): boolean {
  return p.includes(`${path.sep}_auth${path.sep}`)
}

function usedFraction(): number {
  // statfs is on Node >= 18.15 / 19.6; this image is Node 24.
  const { blocks, bfree } = statfsSync(DATA_ROOT)
  if (!blocks) return 0
  return (blocks - bfree) / blocks
}

type Entry = { path: string; size: number; mtimeMs: number }

async function listFiles(dir: string, acc: Entry[]): Promise<void> {
  let dirents
  try {
    dirents = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const d of dirents) {
    const full = path.join(dir, d.name)
    if (isProtected(full)) continue
    if (d.isDirectory()) {
      await listFiles(full, acc)
    } else if (d.isFile()) {
      try {
        const st = await fsp.stat(full)
        acc.push({ path: full, size: st.size, mtimeMs: st.mtimeMs })
      } catch {
        /* raced with another unlink */
      }
    }
  }
}

// Called from the retention sweep. Cheap when the disk isn't full: one statfs.
export async function pruneByDiskUsage(): Promise<void> {
  if (usedFraction() < HIGH_WATER) return

  const files: Entry[] = []
  await listFiles(DATA_ROOT, files)
  files.sort((a, b) => a.mtimeMs - b.mtimeMs) // oldest first

  let deleted = 0
  let freedBytes = 0
  for (const f of files) {
    if (usedFraction() <= LOW_WATER) break
    try {
      await fsp.unlink(f.path)
      deleted++
      freedBytes += f.size
    } catch {
      /* already gone */
    }
  }

  console.warn(
    `disk guard: /data crossed ${Math.round(HIGH_WATER * 100)}%, deleted ${deleted} ` +
      `oldest files (~${Math.round(freedBytes / 1e6)} MB), now at ${Math.round(usedFraction() * 100)}%`
  )
}

// Self-check:
//   npx ts-node --compilerOptions '{"module":"commonjs","moduleResolution":"node"}' src/utils/diskGuard.ts
// Exercises the walk (recursion + oldest-first sort) and the _auth skip;
// disk fullness itself is a one-line statfs and not worth faking.
if (require.main === module) {
  void (async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'diskguard-'))
    await fsp.mkdir(path.join(root, 'sub'), { recursive: true })
    await fsp.mkdir(path.join(root, '_auth'), { recursive: true })
    await fsp.writeFile(path.join(root, 'sub', 'old.json'), 'x')
    await fsp.writeFile(path.join(root, 'new.json'), 'y')
    await fsp.writeFile(path.join(root, '_auth', 'token.json'), 'secret')
    const oldTime = new Date(Date.now() - 60_000)
    await fsp.utimes(path.join(root, 'sub', 'old.json'), oldTime, oldTime)

    const found: Entry[] = []
    await listFiles(root, found)
    found.sort((a, b) => a.mtimeMs - b.mtimeMs)

    assert.deepStrictEqual(
      found.map((f) => path.relative(root, f.path)),
      [path.join('sub', 'old.json'), 'new.json'],
      'walks recursively, sorts oldest-first, skips _auth'
    )
    assert.ok(isProtected(path.join(root, '_auth', 'token.json')))
    await fsp.rm(root, { recursive: true, force: true })
    console.log('diskGuard self-check ok')
  })()
}
