// Unit tests for the ownership check and Razorpay demo-mode guard.
import assert from 'node:assert/strict'
import test, { describe, afterEach } from 'node:test'
import type { NextApiRequest } from 'next'
import { isAuthenticatedUser } from '@/utils/ownership'
import { RazorpayService } from '@/services/razorpayService'

function reqAs(sub?: string): NextApiRequest {
  return { user: sub ? { sub } : undefined } as unknown as NextApiRequest
}

describe('isAuthenticatedUser', () => {
  test('matches the token subject as string or number', () => {
    assert.equal(isAuthenticatedUser(reqAs('42'), '42'), true)
    assert.equal(isAuthenticatedUser(reqAs('42'), 42), true)
  })

  test('rejects another user or a missing identity', () => {
    assert.equal(isAuthenticatedUser(reqAs('42'), '43'), false)
    assert.equal(isAuthenticatedUser(reqAs(), '42'), false)
    assert.equal(isAuthenticatedUser(reqAs('42'), { id: 42 }), false)
  })
})

describe('RazorpayService demo mode', () => {
  const saved = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET }
  afterEach(() => {
    process.env.RAZORPAY_KEY_ID = saved.id
    process.env.RAZORPAY_KEY_SECRET = saved.secret
    if (saved.id === undefined) delete process.env.RAZORPAY_KEY_ID
    if (saved.secret === undefined) delete process.env.RAZORPAY_KEY_SECRET
  })

  test('demo payments verify with test keys', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_abc'
    process.env.RAZORPAY_KEY_SECRET = 'secret'
    const result = new RazorpayService().verifyPayment('DEMO-1', 'pay', '')
    assert.equal(result.status, 'captured')
  })

  test('demo payments are rejected with live keys', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_abc'
    process.env.RAZORPAY_KEY_SECRET = 'secret'
    assert.throws(() => new RazorpayService().verifyPayment('DEMO-1', 'pay', ''), /signature verification failed/)
  })
})
