import test from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'

const cliPath = path.resolve('dist/cli.js')
const testDir = path.resolve('tests/sandbox-project')

test.beforeEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
  fs.mkdirSync(path.join(testDir, 'app'), { recursive: true })
  fs.writeFileSync(
    path.join(testDir, 'package.json'),
    JSON.stringify(
      {
        name: 'test-app',
        scripts: {
          build: 'npm run build:css && npm run start',
        },
      },
      null,
      2
    )
  )
  fs.writeFileSync(
    path.join(testDir, 'app/router.ts'),
    `import { createRouter } from 'remix/router'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { assets } from './assets.ts'

const renderMiddleware = render({ assets })
export const router = createRouter({
  middleware: [staticFiles('./public', { index: false }), renderMiddleware],
})
`
  )
  fs.writeFileSync(
    path.join(testDir, 'server.ts'),
    `import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { router } from './app/router.ts'

const server = http.createServer(createRequestListener(router.fetch, { trustProxy: isHmr }))
`
  )
})

test.afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

test('CLI init creates worker.ts and wrangler.jsonc', () => {
  execFileSync(process.execPath, [cliPath, 'init'], { cwd: testDir })

  assert.ok(fs.existsSync(path.join(testDir, 'worker.ts')), 'worker.ts created')
  const workerContent = fs.readFileSync(path.join(testDir, 'worker.ts'), 'utf-8')
  assert.ok(workerContent.includes("from '@bennyhinn18/remix-cloudflare'"))
  assert.ok(workerContent.includes("from './app/router.ts'"))

  assert.ok(fs.existsSync(path.join(testDir, 'wrangler.jsonc')), 'wrangler.jsonc created')
  const wranglerContent = JSON.parse(fs.readFileSync(path.join(testDir, 'wrangler.jsonc'), 'utf-8'))
  assert.equal(wranglerContent.name, 'test-app')
  assert.equal(wranglerContent.main, 'worker.ts')
  assert.equal(wranglerContent.assets?.binding, 'ASSETS')
})

test('CLI init updates package.json scripts and dependencies', () => {
  execFileSync(process.execPath, [cliPath, 'init'], { cwd: testDir })

  const pkg = JSON.parse(fs.readFileSync(path.join(testDir, 'package.json'), 'utf-8'))
  assert.equal(pkg.scripts.build, 'npm run build:css')
  assert.equal(pkg.scripts.deploy, 'npm run build && wrangler deploy')
  assert.equal(pkg.scripts.preview, 'npm run build && wrangler dev')
  assert.ok(pkg.dependencies['@bennyhinn18/remix-cloudflare'])
  assert.ok(pkg.devDependencies['wrangler'])
})

test('CLI init refactors app/router.ts for edge and preserves backup', () => {
  execFileSync(process.execPath, [cliPath, 'init'], { cwd: testDir })

  assert.ok(fs.existsSync(path.join(testDir, 'app/router.ts.bak')), 'backup created')
  const refactoredRouter = fs.readFileSync(path.join(testDir, 'app/router.ts'), 'utf-8')
  assert.ok(!refactoredRouter.includes('staticFiles'), 'staticFiles removed from router')
  assert.ok(!refactoredRouter.includes('./assets.ts'), 'assets.ts import removed')
  assert.ok(refactoredRouter.includes('renderMiddleware = render()'), 'render() decoupled from assets')
  assert.ok(refactoredRouter.includes('middleware: [renderMiddleware]'), 'clean middleware stack')
})

test('CLI init updates server.ts for Node dev static assets', () => {
  execFileSync(process.execPath, [cliPath, 'init'], { cwd: testDir })

  assert.ok(fs.existsSync(path.join(testDir, 'server.ts.bak')), 'server backup created')
  const serverContent = fs.readFileSync(path.join(testDir, 'server.ts'), 'utf-8')
  assert.ok(serverContent.includes('staticFiles'), 'server.ts includes staticFiles')
  assert.ok(serverContent.includes('fetchHandler'), 'server.ts wraps fetchHandler')
})

test('CLI init generates or updates AGENTS.md with Cloudflare instructions', () => {
  execFileSync(process.execPath, [cliPath, 'init'], { cwd: testDir })

  assert.ok(fs.existsSync(path.join(testDir, 'AGENTS.md')), 'AGENTS.md created')
  const agentsContent = fs.readFileSync(path.join(testDir, 'AGENTS.md'), 'utf-8')
  assert.ok(agentsContent.includes('Cloudflare Workers & Deployment'), 'contains Cloudflare section')
  assert.ok(agentsContent.includes('createWorkerHandler(router)'), 'contains worker guidance')
})

