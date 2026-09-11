// Unit tests for the config validators that guard every write to a webhook's
// authorization rules.
import assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import {
  MAX_AUTH_QUERY_PARAMS,
  validateAuthConfigInput,
  validateAuthQueryConfigInput,
} from '@/utils/webhookAuth'

function expectError(result: unknown): string {
  assert.ok(result && typeof result === 'object' && 'error' in result, 'expected a validation error')
  return (result as { error: string }).error
}

function expectConfig<T>(result: T | { error: string }): Exclude<T, { error: string }> {
  assert.ok(
    result && typeof result === 'object' && 'config' in result,
    `expected a valid config, got ${JSON.stringify(result)}`
  )
  return result as Exclude<T, { error: string }>
}

describe('validateAuthConfigInput — query params', () => {
  test('accepts a well-formed query param list', () => {
    const result = expectConfig(
      validateAuthConfigInput({
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: [{ name: 'callback_key', value: 'secret-123' }],
      })
    )

    assert.equal(result.config.queryEnabled, true)
    assert.deepEqual(result.config.queryParams, [{ name: 'callback_key', value: 'secret-123' }])
  })

  test('trims surrounding whitespace on names and values', () => {
    const result = expectConfig(
      validateAuthConfigInput({
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: [{ name: '  key  ', value: '  secret  ' }],
      })
    )

    assert.deepEqual(result.config.queryParams, [{ name: 'key', value: 'secret' }])
  })

  test('rejects enabling the check with no params configured', () => {
    const error = expectError(
      validateAuthConfigInput({ enabled: false, headers: [], queryEnabled: true, queryParams: [] })
    )

    assert.match(error, /at least one query param/i)
  })

  test('rejects a param that is missing a name or a value', () => {
    for (const entry of [{ name: 'key' }, { value: 'secret' }, { name: '', value: 'secret' }]) {
      const error = expectError(
        validateAuthConfigInput({
          enabled: false,
          headers: [],
          queryEnabled: true,
          queryParams: [entry],
        })
      )
      assert.match(error, /name and value are both required/i)
    }
  })

  test('rejects duplicate names case-sensitively, but allows differing case', () => {
    const duplicate = expectError(
      validateAuthConfigInput({
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: [
          { name: 'key', value: 'a' },
          { name: 'key', value: 'b' },
        ],
      })
    )
    assert.match(duplicate, /listed more than once/i)

    // Query strings are case-sensitive, so "key" and "Key" are genuinely two
    // different params and both may be required.
    const mixedCase = expectConfig(
      validateAuthConfigInput({
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: [
          { name: 'key', value: 'a' },
          { name: 'Key', value: 'b' },
        ],
      })
    )
    assert.equal(mixedCase.config.queryParams.length, 2)
  })

  test('rejects more than the allowed number of params', () => {
    const tooMany = Array.from({ length: MAX_AUTH_QUERY_PARAMS + 1 }, (_unused, index) => ({
      name: `key${index}`,
      value: 'secret',
    }))

    const error = expectError(
      validateAuthConfigInput({
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: tooMany,
      })
    )
    assert.match(error, /maximum of 10/i)
  })

  test('rejects a value longer than the limit', () => {
    const error = expectError(
      validateAuthConfigInput({
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: [{ name: 'key', value: 'x'.repeat(1025) }],
      })
    )
    assert.match(error, /limited to 1024 characters/i)
  })

  test('rejects a non-array queryParams field', () => {
    const error = expectError(
      validateAuthConfigInput({
        enabled: false,
        headers: [],
        queryEnabled: true,
        queryParams: { name: 'key', value: 'secret' },
      })
    )
    assert.match(error, /must be an array/i)
  })

  test('rejects a non-object body', () => {
    for (const body of [null, undefined, 'string', 42, true]) {
      assert.match(expectError(validateAuthConfigInput(body)), /must be a JSON object/i)
    }
  })
})

describe('validateAuthQueryConfigInput', () => {
  test('accepts queryEnabled', () => {
    const result = expectConfig(
      validateAuthQueryConfigInput({
        queryEnabled: true,
        queryParams: [{ name: 'key', value: 'secret' }],
      })
    )
    assert.equal(result.config.queryEnabled, true)
  })

  test('accepts "enabled" as an alias for queryEnabled', () => {
    const result = expectConfig(
      validateAuthQueryConfigInput({
        enabled: true,
        queryParams: [{ name: 'key', value: 'secret' }],
      })
    )
    assert.equal(result.config.queryEnabled, true)
  })

  test('prefers queryEnabled when both are present', () => {
    const result = expectConfig(
      validateAuthQueryConfigInput({
        enabled: true,
        queryEnabled: false,
        queryParams: [{ name: 'key', value: 'secret' }],
      })
    )
    assert.equal(result.config.queryEnabled, false)
  })

  test('requires queryParams to be present', () => {
    assert.match(expectError(validateAuthQueryConfigInput({ queryEnabled: false })), /must be an array/i)
  })

  test('allows disabling with an empty list', () => {
    const result = expectConfig(
      validateAuthQueryConfigInput({ queryEnabled: false, queryParams: [] })
    )
    assert.equal(result.config.queryEnabled, false)
    assert.deepEqual(result.config.queryParams, [])
  })
})
