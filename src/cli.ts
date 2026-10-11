#!/usr/bin/env node
import * as fs from 'node:fs'
import * as path from 'node:path'

async function run() {
  const command = process.argv[2] ?? 'init'

  if (command !== 'init') {
    console.log(`
Usage:
  npx @bennyhinn18/remix-cloudflare init

Initializes Cloudflare Workers configuration for a Remix 3 project.
`)
    process.exit(0)
  }

  const cwd = process.cwd()
  console.log('\n🚀 Initializing Cloudflare Workers for Remix 3...\n')

  // 1. Create worker.ts if not exists
  const workerPath = path.join(cwd, 'worker.ts')
  if (!fs.existsSync(workerPath)) {
    const workerContent = `import { createWorkerHandler } from '@bennyhinn18/remix-cloudflare'
import { router } from './app/router.ts'

export default createWorkerHandler(router)
`
    fs.writeFileSync(workerPath, workerContent, 'utf-8')
    console.log('  ✅ Created worker.ts')
  } else {
    console.log('  ℹ️  worker.ts already exists (skipped)')
  }

  // 2. Create wrangler.jsonc if not exists
  const wranglerPath = path.join(cwd, 'wrangler.jsonc')
  const wranglerTomlPath = path.join(cwd, 'wrangler.toml')
  if (!fs.existsSync(wranglerPath) && !fs.existsSync(wranglerTomlPath)) {
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
    fs.writeFileSync(wranglerPath, wranglerContent, 'utf-8')
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
        pkg.dependencies['@bennyhinn18/remix-cloudflare'] = '^0.2.1'
        modified = true
        console.log('  ✅ Added @bennyhinn18/remix-cloudflare to package.json dependencies')
      }

      // Add wrangler if not present
      if (!pkg.devDependencies['wrangler'] && !pkg.dependencies['wrangler']) {
        pkg.devDependencies['wrangler'] = '^3.0.0'
        modified = true
        console.log('  ✅ Added wrangler to package.json devDependencies')
      }

      if (modified) {
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
      if (!fs.existsSync(backupPath)) {
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

      fs.writeFileSync(routerPath, routerContent, 'utf-8')
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
      if (!fs.existsSync(backupServerPath)) {
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

      fs.writeFileSync(serverPath, serverContent, 'utf-8')
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

### Edge Runtime Guidelines:
- \`worker.ts\` is the Cloudflare entrypoint using \`createWorkerHandler(router)\`.
- \`app/router.ts\` must remain edge-compatible without Node-specific modules (\`node:fs\`, \`createAssetServer\`).
- Static assets are located in \`./public\` and served via Cloudflare Edge Assets (\`env.ASSETS\`).
- Use \`getCloudflareContext(context)\` from \`@bennyhinn18/remix-cloudflare\` in actions to access \`env\`, \`ctx\`, and \`cf\` bindings.
`

  if (fs.existsSync(agentsPath)) {
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8')
    if (!agentsContent.includes('Cloudflare Workers')) {
      fs.appendFileSync(agentsPath, '\n' + cfAgentGuide.trim() + '\n', 'utf-8')
      console.log('  ✅ Added Cloudflare guidance to existing AGENTS.md')
    }
  } else {
    fs.writeFileSync(agentsPath, '# AI Agent Guide\n' + cfAgentGuide.trim() + '\n', 'utf-8')
    console.log('  ✅ Created AGENTS.md with Cloudflare & Remix 3 guidelines')
  }

  console.log(`
🎉 Cloudflare Workers setup complete!

Test locally:
  npm run preview

Deploy to Cloudflare:
  npm run deploy
`)
}

run().catch((err) => {
  console.error('Failed to initialize remix-cloudflare:', err)
  process.exit(1)
})
