import { promises as fs } from 'fs'
import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'

export type RouteToggleScope = 'exact' | 'prefix'

type RouteToggleState = {
  exactRoutes: string[]
  prefixRoutes: string[]
}

type RouteAvailabilityResult =
  | {
      disabled: false
      path: string
    }
  | {
      disabled: true
      path: string
      scope: RouteToggleScope
      matchedRule: string
    }

const TOGGLE_FILE_PATH = path.join(process.cwd(), 'data', 'api-route-toggles.json')
const EXEMPT_ROUTES = new Set(['/api/v1/system/toggle-route'])

// Every incoming request (including webhook callbacks) calls readRouteToggleState()
// via enforceRouteAvailability(). Without a cache, that's an fs.readFile() per
// request, and fs ops share Node's small libuv threadpool with dns.reverse() —
// under concurrent load the two compete and stall response writes. Cache briefly
// and update the cache in-process on writes so toggles still take effect fast.
const ROUTE_TOGGLE_CACHE_TTL_MS = 2000
let routeToggleCache: { state: RouteToggleState; loadedAt: number } | null = null

function normalizeRoutePath(route: string): string {
  const trimmedRoute = route.trim()

  if (!trimmedRoute) {
    return ''
  }

  const routeWithLeadingSlash = trimmedRoute.startsWith('/')
    ? trimmedRoute
    : `/${trimmedRoute}`

  return routeWithLeadingSlash.length > 1
    ? routeWithLeadingSlash.replace(/\/+$/, '')
    : routeWithLeadingSlash
}

function getRequestPath(req: NextApiRequest): string {
  const pathname = (req.url ?? '').split('?')[0] ?? ''
  return normalizeRoutePath(pathname)
}

function normalizeRouteList(routes: unknown): string[] {
  if (!Array.isArray(routes)) {
    return []
  }

  return Array.from(
    new Set(
      routes
        .filter((route): route is string => typeof route === 'string')
        .map(normalizeRoutePath)
        .filter((route) => route && !EXEMPT_ROUTES.has(route))
    )
  ).sort()
}

function normalizeState(state: Partial<RouteToggleState> | null | undefined): RouteToggleState {
  return {
    exactRoutes: normalizeRouteList(state?.exactRoutes),
    prefixRoutes: normalizeRouteList(state?.prefixRoutes),
  }
}

async function readRouteToggleState(): Promise<RouteToggleState> {
  if (routeToggleCache && Date.now() - routeToggleCache.loadedAt < ROUTE_TOGGLE_CACHE_TTL_MS) {
    return routeToggleCache.state
  }

  try {
    const rawState = await fs.readFile(TOGGLE_FILE_PATH, 'utf8')
    const state = normalizeState(JSON.parse(rawState))
    routeToggleCache = { state, loadedAt: Date.now() }
    return state
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const state = normalizeState(undefined)
      routeToggleCache = { state, loadedAt: Date.now() }
      return state
    }

    console.error('Failed to read API route toggle state:', error)
    return routeToggleCache?.state ?? normalizeState(undefined)
  }
}

async function writeRouteToggleState(state: RouteToggleState): Promise<void> {
  const normalized = normalizeState(state)
  await fs.mkdir(path.dirname(TOGGLE_FILE_PATH), { recursive: true })
  await fs.writeFile(
    TOGGLE_FILE_PATH,
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf8'
  )
  routeToggleCache = { state: normalized, loadedAt: Date.now() }
}

export async function listDisabledRoutes(): Promise<RouteToggleState> {
  return readRouteToggleState()
}

export async function toggleRouteAvailability(
  route: string,
  scope: RouteToggleScope = 'exact'
): Promise<{
  route: string
  scope: RouteToggleScope
  disabled: boolean
}> {
  const normalizedRoute = normalizeRoutePath(route)

  if (!normalizedRoute) {
    throw new Error('A valid route is required')
  }

  if (EXEMPT_ROUTES.has(normalizedRoute)) {
    throw new Error('This route cannot be toggled')
  }

  const currentState = await readRouteToggleState()
  const stateKey = scope === 'prefix' ? 'prefixRoutes' : 'exactRoutes'
  const isCurrentlyDisabled = currentState[stateKey].includes(normalizedRoute)

  const nextState: RouteToggleState = {
    ...currentState,
    [stateKey]: isCurrentlyDisabled
      ? currentState[stateKey].filter((value) => value !== normalizedRoute)
      : [...currentState[stateKey], normalizedRoute].sort(),
  }

  await writeRouteToggleState(nextState)

  return {
    route: normalizedRoute,
    scope,
    disabled: !isCurrentlyDisabled,
  }
}

export async function getRouteAvailability(pathname: string): Promise<RouteAvailabilityResult> {
  const normalizedPath = normalizeRoutePath(pathname)

  if (!normalizedPath || EXEMPT_ROUTES.has(normalizedPath)) {
    return {
      disabled: false,
      path: normalizedPath,
    }
  }

  const state = await readRouteToggleState()

  if (state.exactRoutes.includes(normalizedPath)) {
    return {
      disabled: true,
      path: normalizedPath,
      scope: 'exact',
      matchedRule: normalizedPath,
    }
  }

  const matchedPrefix = [...state.prefixRoutes]
    .sort((left, right) => right.length - left.length)
    .find((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))

  if (matchedPrefix) {
    return {
      disabled: true,
      path: normalizedPath,
      scope: 'prefix',
      matchedRule: matchedPrefix,
    }
  }

  return {
    disabled: false,
    path: normalizedPath,
  }
}

export async function enforceRouteAvailability(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  const routeAvailability = await getRouteAvailability(getRequestPath(req))

  if (!routeAvailability.disabled) {
    return true
  }

  res.status(503).json({
    error: 'API route is temporarily disabled',
    route: routeAvailability.path,
    matchedRule: routeAvailability.matchedRule,
    scope: routeAvailability.scope,
  })

  return false
}
