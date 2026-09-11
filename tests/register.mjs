// Resolves the "@/..." path alias from tsconfig.json for the test runner.
// Tests import the real source modules directly (Node strips the types), so
// they exercise the same code the API serves rather than a copy.
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// tsconfig "paths" are compile-time only, so the extensionless specifiers the
// source uses ("@/utils/webhookAuth") have to be completed here.
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

function resolveAliasTarget(specifier) {
  const base = path.join(projectRoot, 'src', specifier.slice(2))

  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${base}${suffix}`
    if (suffix !== '' && existsSync(candidate)) {
      return candidate
    }
  }

  return base
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(pathToFileURL(resolveAliasTarget(specifier)).href, context)
    }
    return nextResolve(specifier, context)
  },
})
