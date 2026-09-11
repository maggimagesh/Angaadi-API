import type { NextApiResponse } from 'next'

export interface MockResponse {
  res: NextApiResponse
  statusCode: number | null
  headers: Record<string, unknown>
  jsonBody: unknown
  ended: boolean
}

// Captures what a route handler writes instead of talking to a socket, so the
// API endpoints can be driven end to end from the test process.
export function mockResponse(): MockResponse {
  const state: MockResponse = {
    res: null as unknown as NextApiResponse,
    statusCode: null,
    headers: {},
    jsonBody: undefined,
    ended: false,
  }

  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(body: unknown) {
      state.jsonBody = body
      state.ended = true
      return res
    },
    send(body: unknown) {
      state.jsonBody = body
      state.ended = true
      return res
    },
    end() {
      state.ended = true
      return res
    },
    setHeader(name: string, value: unknown) {
      state.headers[name.toLowerCase()] = value
      return res
    },
    getHeader(name: string) {
      return state.headers[name.toLowerCase()]
    },
    removeHeader(name: string) {
      delete state.headers[name.toLowerCase()]
    },
  }

  state.res = res as unknown as NextApiResponse
  return state
}
