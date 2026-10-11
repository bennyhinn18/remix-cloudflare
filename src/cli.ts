#!/usr/bin/env node
import * as fs from 'node:fs'
import * as path from 'node:path'
import { scaffoldProject } from './scaffold.js'

const VERSION = '0.2.1'

function printHelp() {
  console.log(`
@bennyhinn18/remix-cloudflare v${VERSION}
High-performance Cloudflare Workers & Pages adapter for Remix 3

USAGE:
  $ npx @bennyhinn18/remix-cloudflare <command> [directory] [options]

COMMANDS:
  new <dir>      Create a new Remix 3 + Cloudflare Workers project from scratch (alias: create)
  init [dir]     Initialize Cloudflare Workers (scaffolds if empty, migrates if existing)
  doctor         Run diagnostic health checks for Cloudflare Workers readiness (alias: check)
  help           Show this help message

OPTIONS:
  --dry-run      Simulate migration without modifying any files
  --force        Overwrite existing worker.ts and wrangler.jsonc
  -h, --help     Show help information
  -v, --version  Show CLI version

EXAMPLES:
  # Create a brand new project:
  $ npx @bennyhinn18/remix-cloudflare new my-app
  $ npm create @bennyhinn18/remix-cloudflare my-app

  # Migrate an existing Remix 3 project:
  $ cd my-existing-remix-project
  $ npx @bennyhinn18/remix-cloudflare init

  # Check configuration health:
  $ npx @bennyhinn18/remix-cloudflare doctor

DOCUMENTATION:
  https://github.com/bennyhinn18/remix-cloudflare#readme
`)
}

async function runDoctor(cwd: string) {
  console.log('\n🩺 Running Remix 3 Cloudflare Worker Diagnostic Checks...\n')
  let issues = 0

  // 1. Check worker.ts
  const workerPath = path.join(cwd, 'worker.ts')
  if (fs.existsSync(workerPath)) {
    const content = fs.readFileSync(workerPath, 'utf-8')
    if (content.includes('createWorkerHandler')) {
      console.log('  ✅ worker.ts: Valid Cloudflare worker entrypoint found')
    } else {
      console.log('  ⚠️  worker.ts: Found, but does not seem to use createWorkerHandler')
    }
  } else {
    console.log('  ❌ worker.ts: Missing. Run "npx @bennyhinn18/remix-cloudflare init" to generate.')
    issues++
  }

  // 2. Check wrangler config
  const wranglerJson = path.join(cwd, 'wrangler.jsonc')
  const wranglerToml = path.join(cwd, 'wrangler.toml')
  if (fs.existsSync(wranglerJson) || fs.existsSync(wranglerToml)) {
    console.log('  ✅ Wrangler config: Found configuration file')
  } else {
    console.log('  ❌ Wrangler config: Missing wrangler.jsonc or wrangler.toml.')
    issues++
  }

  // 3. Check app/router.ts for edge compatibility
  const routerPath = path.join(cwd, 'app', 'router.ts')
  if (fs.existsSync(routerPath)) {
    const routerContent = fs.readFileSync(routerPath, 'utf-8')
    if (routerContent.includes('staticFiles') || routerContent.includes('render({ assets })')) {
      console.log('  ❌ app/router.ts: Contains Node-only staticFiles or assets. Run "npx @bennyhinn18/remix-cloudflare init" to refactor.')
      issues++
    } else {
      console.log('  ✅ app/router.ts: Edge-compatible (pure Web router)')
    }
  } else {
    console.log('  ⚠️  app/router.ts: File not found at expected path')
  }

  // 4. Check package.json
  const pkgPath = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.scripts?.build?.includes('npm run start')) {
        console.log('  ❌ package.json: "build" script contains "npm run start" which hangs CI builds.')
        issues++
      } else {
        console.log('  ✅ package.json: "build" script is non-blocking')
      }

      if (pkg.dependencies?.['@bennyhinn18/remix-cloudflare'] || pkg.devDependencies?.['@bennyhinn18/remix-cloudflare']) {
        console.log('  ✅ package.json: @bennyhinn18/remix-cloudflare is listed')
      } else {
        console.log('  ⚠️  package.json: @bennyhinn18/remix-cloudflare is not in dependencies')
      }
    } catch {}
  }

  if (issues === 0) {
    console.log('\n🎉 All checks passed! Your project is ready for Cloudflare Workers.\n')
    process.exit(0)
  } else {
    console.log(`\n⚠️  Found ${issues} issue(s). Run "npx @bennyhinn18/remix-cloudflare init" to automatically resolve.\n`)
    process.exit(1)
  }
}

async function runInit(cwd: string, options: { dryRun: boolean; force: boolean }) {
  console.log(`\n🚀 Initializing Cloudflare Workers for Remix 3...${options.dryRun ? ' (DRY RUN)' : ''}\n`)

  // 1. Create worker.ts if not exists
  const workerPath = path.join(cwd, 'worker.ts')
  if (!fs.existsSync(workerPath) || options.force) {
    const workerContent = `import { createWorkerHandler } from '@bennyhinn18/remix-cloudflare'
import { router } from './app/router.ts'

export default createWorkerHandler(router)
`
    if (!options.dryRun) {
      fs.writeFileSync(workerPath, workerContent, 'utf-8')
    }
    console.log('  ✅ Created worker.ts')
  } else {
    console.log('  ℹ️  worker.ts already exists (skipped)')
  }

  // 2. Create wrangler.jsonc if not exists
  const wranglerPath = path.join(cwd, 'wrangler.jsonc')
  const wranglerTomlPath = path.join(cwd, 'wrangler.toml')
  if ((!fs.existsSync(wranglerPath) && !fs.existsSync(wranglerTomlPath)) || options.force) {
    const pkgPath = path.join(cwd, 'package.json')
    let appName = 'remix-app'
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        if (pkg.name) appName = pkg.name.replace(/^@[^/]+\//, '')
      } catch {}
    }

    const wranglerContent = `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "${appName}",
  "main": "worker.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  }
}
`
    if (!options.dryRun) {
      fs.writeFileSync(wranglerPath, wranglerContent, 'utf-8')
    }
    console.log('  ✅ Created wrangler.jsonc')
  } else {
    console.log('  ℹ️  Wrangler configuration already exists (skipped)')
  }

  // 3. Patch package.json scripts and dependencies
  const pkgPath = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      pkg.scripts = pkg.scripts || {}
      pkg.dependencies = pkg.dependencies || {}
      pkg.devDependencies = pkg.devDependencies || {}

      let modified = false

      // Fix build script if it starts the server
      if (pkg.scripts.build && pkg.scripts.build.includes('npm run start')) {
        pkg.scripts.build = pkg.scripts.build.replace(/\s*&&\s*npm run start/, '')
        modified = true
        console.log('  ✅ Fixed "build" script in package.json (removed blocking server start)')
      }

      if (!pkg.scripts.deploy) {
        pkg.scripts.deploy = 'npm run build && wrangler deploy'
        modified = true
        console.log('  ✅ Added "deploy" script to package.json')
      }

      if (!pkg.scripts.preview) {
        pkg.scripts.preview = 'npm run build && wrangler dev'
        modified = true
        console.log('  ✅ Added "preview" script to package.json')
      }

      // Add @bennyhinn18/remix-cloudflare if not present
      if (!pkg.dependencies['@bennyhinn18/remix-cloudflare'] && !pkg.devDependencies['@bennyhinn18/remix-cloudflare']) {
        pkg.dependencies['@bennyhinn18/remix-cloudflare'] = `^${VERSION}`
        modified = true
        console.log('  ✅ Added @bennyhinn18/remix-cloudflare to package.json dependencies')
      }

      // Add wrangler if not present
      if (!pkg.devDependencies['wrangler'] && !pkg.dependencies['wrangler']) {
        pkg.devDependencies['wrangler'] = '^3.0.0'
        modified = true
        console.log('  ✅ Added wrangler to package.json devDependencies')
      }

      if (modified && !options.dryRun) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
      }
    } catch (e) {
      console.warn('  ⚠️  Could not automatically update package.json:', e)
    }
  }

  // 4. Adapt app/router.ts for Edge compatibility
  const routerPath = path.join(cwd, 'app', 'router.ts')
  if (fs.existsSync(routerPath)) {
    let routerContent = fs.readFileSync(routerPath, 'utf-8')
    const hasStaticFiles = routerContent.includes('staticFiles')
    const hasAssetsImport = routerContent.includes('./assets.ts') || routerContent.includes('render({ assets })')

    if (hasStaticFiles || hasAssetsImport) {
      // Backup original
      const backupPath = path.join(cwd, 'app', 'router.ts.bak')
      if (!fs.existsSync(backupPath) && !options.dryRun) {
        fs.writeFileSync(backupPath, routerContent, 'utf-8')
      }

      // 1. Remove staticFiles import
      routerContent = routerContent.replace(/import\s*\{\s*staticFiles\s*\}\s*from\s*['"]remix\/middleware\/static['"]\s*\n?/, '')
      // 2. Remove assets import
      routerContent = routerContent.replace(/import\s*\{\s*assets\s*\}\s*from\s*['"]\.\/assets\.ts['"]\s*\n?/, '')
      // 3. Replace render({ assets }) with render()
      routerContent = routerContent.replace(/render\(\{\s*assets\s*\}\)/g, 'render()')
      // 4. Clean middleware array
      routerContent = routerContent.replace(/middleware:\s*\[\s*staticFiles\([^\]]*\)\s*,\s*renderMiddleware\s*\]/, 'middleware: [renderMiddleware]')
      routerContent = routerContent.replace(/staticFiles\([^)]*\)\s*,\s*/g, '')

      if (!options.dryRun) {
        fs.writeFileSync(routerPath, routerContent, 'utf-8')
      }
      console.log('  ✅ Refactored app/router.ts for edge compatibility (backup saved to app/router.ts.bak)')
    } else {
      console.log('  ℹ️  app/router.ts is edge-compatible (no Node asset server found)')
    }
  }

  // 5. Update server.ts for Node dev static file serving if needed
  const serverPath = path.join(cwd, 'server.ts')
  if (fs.existsSync(serverPath)) {
    let serverContent = fs.readFileSync(serverPath, 'utf-8')
    if (!serverContent.includes('staticFiles') && serverContent.includes('router.fetch')) {
      const backupServerPath = path.join(cwd, 'server.ts.bak')
      if (!fs.existsSync(backupServerPath) && !options.dryRun) {
        fs.writeFileSync(backupServerPath, serverContent, 'utf-8')
      }

      // Add imports
      if (!serverContent.includes("from 'remix/router'")) {
        serverContent = `import { createRouter } from 'remix/router'\nimport { staticFiles } from 'remix/middleware/static'\n` + serverContent
      } else if (!serverContent.includes('staticFiles')) {
        serverContent = `import { staticFiles } from 'remix/middleware/static'\n` + serverContent
      }

      // Wrap router.fetch with nodeRouter
      const nodeRouterSnippet = `const nodeRouter = createRouter({\n  middleware: [staticFiles('./public', { index: false })],\n})\n\nasync function fetchHandler(request: Request): Promise<Response> {\n  const staticResponse = await nodeRouter.fetch(request)\n  if (staticResponse.status !== 404) {\n    return staticResponse\n  }\n  return router.fetch(request)\n}\n\n`
      
      serverContent = serverContent.replace(
        /const server = http\.createServer\(createRequestListener\(router\.fetch,\s*\{\s*trustProxy:\s*isHmr\s*\}\)\)/,
        `${nodeRouterSnippet}const server = http.createServer(createRequestListener(fetchHandler, { trustProxy: isHmr }))`
      )

      if (!options.dryRun) {
        fs.writeFileSync(serverPath, serverContent, 'utf-8')
      }
      console.log('  ✅ Updated server.ts to serve static files in Node dev (backup saved to server.ts.bak)')
    }
  }

  // 6. Inspect app/actions/document.tsx
  const docPath = path.join(cwd, 'app', 'actions', 'document.tsx')
  if (fs.existsSync(docPath)) {
    const docContent = fs.readFileSync(docPath, 'utf-8')
    if (docContent.includes('../assets.ts') || docContent.includes('scriptEntry')) {
      console.log('\n  ℹ️  Notice: "app/actions/document.tsx" references dynamic assets from "app/assets.ts".')
      console.log('     On Cloudflare Workers, static assets are served from "./public" via Cloudflare CDN.')
      console.log('     If you use client-side hydration, compile your client script to "./public/entry.js"')
      console.log('     and reference <script type="module" src="/entry.js" /> instead of Node assets.ts.\n')
    }
  }

  // 7. Update or create AGENTS.md for AI coding assistants
  const agentsPath = path.join(cwd, 'AGENTS.md')
  const cfAgentGuide = `
## Cloudflare Workers & Deployment

This project uses \`@bennyhinn18/remix-cloudflare\` to run on Cloudflare Workers.

### Commands:
- \`npm run preview\`: Previews Cloudflare Worker locally via Wrangler
- \`npm run deploy\`: Builds assets and deploys to Cloudflare Workers
- \`npx @bennyhinn18/remix-cloudflare doctor\`: Runs health checks on Cloudflare configuration

### Edge Runtime Guidelines:
- \`worker.ts\` is the Cloudflare entrypoint using \`createWorkerHandler(router)\`.
- \`app/router.ts\` must remain edge-compatible without Node-specific modules (\`node:fs\`, \`createAssetServer\`).
- Static assets are located in \`./public\` and served via Cloudflare Edge Assets (\`env.ASSETS\`).
- Use \`getCloudflareContext(context)\` from \`@bennyhinn18/remix-cloudflare\` in actions to access \`env\`, \`ctx\`, and \`cf\` bindings.
`

  if (fs.existsSync(agentsPath)) {
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8')
    if (!agentsContent.includes('Cloudflare Workers')) {
      if (!options.dryRun) {
        fs.appendFileSync(agentsPath, '\n' + cfAgentGuide.trim() + '\n', 'utf-8')
      }
      console.log('  ✅ Added Cloudflare guidance to existing AGENTS.md')
    }
  } else {
    if (!options.dryRun) {
      fs.writeFileSync(agentsPath, '# AI Agent Guide\n' + cfAgentGuide.trim() + '\n', 'utf-8')
    }
    console.log('  ✅ Created AGENTS.md with Cloudflare & Remix 3 guidelines')
  }

  console.log(`
🎉 Cloudflare Workers setup complete!

Test locally:
  npm run preview

Diagnose configuration:
  npx @bennyhinn18/remix-cloudflare doctor

Deploy to Cloudflare:
  npm run deploy
`)
}

async function run() {
  const args = process.argv.slice(2)
  const nonFlagArgs = args.filter((a) => !a.startsWith('-'))
  const firstArg = nonFlagArgs[0]
  const isHelp = args.includes('--help') || args.includes('-h') || firstArg === 'help'
  const isVersion = args.includes('--version') || args.includes('-v') || firstArg === 'version'
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const cwd = process.cwd()

  if (isVersion) {
    console.log(`@bennyhinn18/remix-cloudflare v${VERSION}`)
    process.exit(0)
  }

  if (isHelp) {
    printHelp()
    process.exit(0)
  }

  if (firstArg === 'doctor' || firstArg === 'check') {
    const targetDir = nonFlagArgs[1] ? path.resolve(cwd, nonFlagArgs[1]) : cwd
    await runDoctor(targetDir)
    return
  }

  // Handle "new <dir>" or "create <dir>"
  if (firstArg === 'new' || firstArg === 'create') {
    const target = nonFlagArgs[1] || 'my-remix-app'
    const targetDir = path.resolve(cwd, target)
    scaffoldProject({ projectName: path.basename(targetDir), targetDir, dryRun })
    return
  }

  // Handle "init [dir]"
  if (firstArg === 'init') {
    const target = nonFlagArgs[1]
    const targetDir = target ? path.resolve(cwd, target) : cwd
    const hasPkg = fs.existsSync(path.join(targetDir, 'package.json'))

    if (!hasPkg) {
      scaffoldProject({ projectName: path.basename(targetDir) || 'remix-app', targetDir, dryRun })
    } else {
      await runInit(targetDir, { dryRun, force })
    }
    return
  }

  // Handle direct directory target (e.g. "npm create @bennyhinn18/remix-cloudflare my-app")
  if (firstArg) {
    const targetDir = path.resolve(cwd, firstArg)
    const hasPkg = fs.existsSync(path.join(targetDir, 'package.json'))

    if (!hasPkg) {
      scaffoldProject({ projectName: firstArg, targetDir, dryRun })
    } else {
      await runInit(targetDir, { dryRun, force })
    }
    return
  }

  // No arguments provided: inspect current working directory
  const hasPkgInCwd = fs.existsSync(path.join(cwd, 'package.json'))
  if (!hasPkgInCwd) {
    scaffoldProject({ projectName: path.basename(cwd) || 'remix-app', targetDir: cwd, dryRun })
  } else {
    await runInit(cwd, { dryRun, force })
  }
}

run().catch((err) => {
  console.error('Failed to run remix-cloudflare CLI:', err)
  process.exit(1)
})
