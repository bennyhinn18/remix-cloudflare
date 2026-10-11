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

test('CLI --help and -h displays structured usage and commands', () => {
  const output = execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf-8' })
  assert.ok(output.includes('USAGE:'))
  assert.ok(output.includes('COMMANDS:'))
  assert.ok(output.includes('init'))
  assert.ok(output.includes('doctor'))
  assert.ok(output.includes('OPTIONS:'))
})

test('CLI --version and -v outputs current version', () => {
  const output = execFileSync(process.execPath, [cliPath, '-v'], { encoding: 'utf-8' })
  assert.ok(output.includes('v0.2.1'))
})

test('CLI doctor detects issues before init and passes after init', () => {
  // Before init, doctor should exit 1 because worker.ts and wrangler config are missing
  assert.throws(() => {
    execFileSync(process.execPath, [cliPath, 'doctor'], { cwd: testDir, stdio: 'pipe' })
  })

  // Run init
  execFileSync(process.execPath, [cliPath, 'init'], { cwd: testDir })

  // After init, doctor should exit 0 cleanly
  const output = execFileSync(process.execPath, [cliPath, 'doctor'], { cwd: testDir, encoding: 'utf-8' })
  assert.ok(output.includes('All checks passed'))
})

test('CLI new scaffolds a complete ready-to-run Remix 3 + Cloudflare project', () => {
  const newAppDir = path.resolve('tests/fresh-app')
  if (fs.existsSync(newAppDir)) {
    fs.rmSync(newAppDir, { recursive: true, force: true })
  }

  try {
    execFileSync(process.execPath, [cliPath, 'new', 'tests/fresh-app'])

    // Verify all core files
    assert.ok(fs.existsSync(path.join(newAppDir, 'package.json')), 'package.json exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'worker.ts')), 'worker.ts exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'wrangler.jsonc')), 'wrangler.jsonc exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'server.ts')), 'server.ts exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'app/routes.ts')), 'routes.ts exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'app/router.ts')), 'router.ts exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'app/actions/controller.tsx')), 'controller.tsx exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'app/actions/document.tsx')), 'document.tsx exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'app/actions/home-page.tsx')), 'home-page.tsx exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'AGENTS.md')), 'AGENTS.md exists')
    assert.ok(fs.existsSync(path.join(newAppDir, 'public/styles.css')), 'styles.css exists')

    // Verify doctor passes on freshly scaffolded app!
    const doctorOutput = execFileSync(process.execPath, [cliPath, 'doctor'], { cwd: newAppDir, encoding: 'utf-8' })
    assert.ok(doctorOutput.includes('All checks passed'), 'fresh scaffold passes doctor')
  } finally {
    if (fs.existsSync(newAppDir)) {
      fs.rmSync(newAppDir, { recursive: true, force: true })
    }
  }
})

test('CLI init in empty directory automatically scaffolds project', () => {
  const emptyDir = path.resolve('tests/empty-app')
  if (fs.existsSync(emptyDir)) {
    fs.rmSync(emptyDir, { recursive: true, force: true })
  }
  fs.mkdirSync(emptyDir, { recursive: true })

  try {
    execFileSync(process.execPath, [cliPath, 'init'], { cwd: emptyDir })
    assert.ok(fs.existsSync(path.join(emptyDir, 'package.json')), 'package.json auto-scaffolded')
    assert.ok(fs.existsSync(path.join(emptyDir, 'worker.ts')), 'worker.ts auto-scaffolded')
    assert.ok(fs.existsSync(path.join(emptyDir, 'wrangler.jsonc')), 'wrangler.jsonc auto-scaffolded')
  } finally {
    if (fs.existsSync(emptyDir)) {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  }
})



