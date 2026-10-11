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

  // 3. Patch package.json scripts
  const pkgPath = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      pkg.scripts = pkg.scripts || {}

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

      if (modified) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
      }
    } catch (e) {
      console.warn('  ⚠️  Could not automatically update package.json:', e)
    }
  }

  // 4. Check app/router.ts for staticFiles
  const routerPath = path.join(cwd, 'app', 'router.ts')
  if (fs.existsSync(routerPath)) {
    const routerContent = fs.readFileSync(routerPath, 'utf-8')
    if (routerContent.includes('staticFiles')) {
      console.log('\n  ⚠️  Notice: "app/router.ts" currently imports staticFiles from "remix/middleware/static".')
      console.log('     On Cloudflare Workers, static assets are served directly from "./public" via Cloudflare CDN.')
      console.log('     Remember to remove staticFiles and createAssetServer from your worker router to avoid bundling errors.\n')
    }
  }

  console.log(`
🎉 Setup complete!
To test locally:
  npm run preview

To deploy to Cloudflare:
  npm run deploy
`)
}

run().catch((err) => {
  console.error('Failed to initialize remix-cloudflare:', err)
  process.exit(1)
})
