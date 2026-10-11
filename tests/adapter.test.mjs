import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkerHandler, getCloudflareContext } from '../dist/index.js'

test('createWorkerHandler routes standard request to router', async () => {
  const mockRouter = {
    async fetch(req) {
      assert.equal(req.url, 'http://localhost/test')
      return new Response('Hello from Remix 3', { status: 200 })
    },
  }

  const handler = createWorkerHandler(mockRouter)
  const req = new Request('http://localhost/test')
  const env = { TEST_VAR: 'remix-on-edge' }
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {} }

  const res = await handler.fetch(req, env, ctx)
  assert.equal(res.status, 200)
  assert.equal(await res.text(), 'Hello from Remix 3')
})

test('createWorkerHandler falls back to ASSETS binding on 404', async () => {
  const mockRouter = {
    async fetch() {
      return new Response('Not Found', { status: 404 })
    },
  }

  const handler = createWorkerHandler(mockRouter, { fallbackToAssets: true })
  const req = new Request('http://localhost/styles.css')
  const env = {
    ASSETS: {
      async fetch(r) {
        return new Response('body { color: red; }', {
          status: 200,
          headers: { 'Content-Type': 'text/css' },
        })
      },
    },
  }
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {} }

  const res = await handler.fetch(req, env, ctx)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'text/css')
  assert.equal(await res.text(), 'body { color: red; }')
})

test('createWorkerHandler decorates request with Cloudflare env and ctx', async () => {
  let capturedReq = null
  const mockRouter = {
    async fetch(req) {
      capturedReq = req
      return new Response('ok')
    },
  }

  const handler = createWorkerHandler(mockRouter)
  const req = new Request('http://localhost/api/bindings')
  const env = { KV_STORE: 'mock-kv', SECRET_KEY: 'secret123' }
  const ctx = { waitUntil: () => {} }

  await handler.fetch(req, env, ctx)

  assert.ok(capturedReq)
  const cfCtx = getCloudflareContext({ request: capturedReq })
  assert.equal(cfCtx.env.KV_STORE, 'mock-kv')
  assert.equal(cfCtx.env.SECRET_KEY, 'secret123')
  assert.equal(cfCtx.ctx, ctx)
})

test('createWorkerHandler invokes custom onError on exception', async () => {
  const mockRouter = {
    async fetch() {
      throw new Error('Database connection failed')
    },
  }

  let capturedError = null
  const handler = createWorkerHandler(mockRouter, {
    onError(err) {
      capturedError = err
      return new Response('Custom Error Handled', { status: 503 })
    },
  })

  const req = new Request('http://localhost/crash')
  const res = await handler.fetch(req, {}, {})

  assert.equal(res.status, 503)
  assert.equal(await res.text(), 'Custom Error Handled')
  assert.equal(capturedError.message, 'Database connection failed')
})
