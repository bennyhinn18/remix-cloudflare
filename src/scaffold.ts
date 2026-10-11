import * as fs from 'node:fs'
import * as path from 'node:path'

export interface ScaffoldOptions {
  projectName: string
  targetDir: string
  dryRun?: boolean
}

export function scaffoldProject(options: ScaffoldOptions) {
  const { projectName, targetDir, dryRun = false } = options
  const version = '0.2.1'

  console.log(`\n📦 Scaffolding new Remix 3 + Cloudflare Workers project in:\n   ${targetDir}\n`)

  const files: Record<string, string> = {
    'package.json': JSON.stringify(
      {
        name: projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          build: 'npm run build:css',
          'build:css': 'lightningcss --minify --bundle app/styles.css -o public/styles.css',
          dev: 'node --watch --watch-preserve-output server.ts',
          preview: 'npm run build && wrangler dev',
          deploy: 'npm run build && wrangler deploy',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          '@bennyhinn18/remix-cloudflare': `^${version}`,
          remix: '^3.0.0',
        },
        devDependencies: {
          '@cloudflare/workers-types': '^4.20241004.0',
          '@types/node': '^22.0.0',
          'lightningcss-cli': '^1.29.0',
          typescript: '^5.6.3',
          wrangler: '^3.0.0',
        },
      },
      null,
      2
    ) + '\n',

    'wrangler.jsonc': `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "${projectName}",
  "main": "worker.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  }
}
`,

    'worker.ts': `import { createWorkerHandler } from '@bennyhinn18/remix-cloudflare'
import { router } from './app/router.ts'

export default createWorkerHandler(router)
`,

    'server.ts': `import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { createRouter } from 'remix/router'
import { staticFiles } from 'remix/middleware/static'
import { router } from './app/router.ts'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000

const nodeRouter = createRouter({
  middleware: [staticFiles('./public', { index: false })],
})

async function fetchHandler(request: Request): Promise<Response> {
  const staticResponse = await nodeRouter.fetch(request)
  if (staticResponse.status !== 404) return staticResponse
  return router.fetch(request)
}

const server = http.createServer(createRequestListener(fetchHandler))
server.listen(port, () => {
  console.log(\`🚀 Local server running on http://localhost:\${port}\`)
})
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "strict": true,
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "types": ["node", "@cloudflare/workers-types"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ESNext",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "remix/component",
    "noEmit": true
  },
  "exclude": ["dist"]
}
`,

    '.gitignore': `node_modules
dist
.wrangler
*.log
.DS_Store
.env
.env.*
`,

    'app/routes.ts': `import { get, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  apiInfo: get('/api/info'),
})
`,

    'app/router.ts': `import { createRouter, type MiddlewareContext } from 'remix/router'
import { render } from 'remix/middleware/render'
import controller from './actions/controller.tsx'
import { routes } from './routes.ts'

const renderMiddleware = render()
type AppContext = MiddlewareContext<[typeof renderMiddleware]>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({
  middleware: [renderMiddleware],
})

router.map(routes, controller)
`,

    'app/actions/document.tsx': `import type { Handle, RemixNode } from 'remix/component'

export interface DocumentProps {
  children?: RemixNode
  title?: string
  description?: string
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    const {
      children,
      title = 'Remix 3 on Cloudflare Workers',
      description = 'Blazing fast Remix 3 app running at the edge.',
    } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <meta name="description" content={description} />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
`,

    'app/actions/home-page.tsx': `import type { Handle } from 'remix/component'

export interface HomePageProps {
  country?: string
  city?: string
  colo?: string
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    const { country = 'Global Edge', city = 'Cloudflare Network', colo = 'Edge' } = handle.props

    return (
      <main className="container">
        <header className="hero">
          <div className="badge">⚡ Remix 3 + Cloudflare Workers</div>
          <h1>Blazing Fast Edge Architecture</h1>
          <p className="subtitle">
            Running natively on Cloudflare Workers with native Web Fetch standards and zero runtime bloat.
          </p>
        </header>

        <section className="cards">
          <div className="card">
            <div className="card-icon">🌍</div>
            <h3>Edge Geolocation</h3>
            <p>
              Request served from <strong>{city}</strong>, {country} ({colo}).
            </p>
          </div>
          <div className="card">
            <div className="card-icon">⚡</div>
            <h3>Native Web Primitives</h3>
            <p>Powered by Web Streams, Fetch API, and standard Request / Response.</p>
          </div>
          <div className="card">
            <div className="card-icon">📦</div>
            <h3>Static Assets CDN</h3>
            <p>Images, fonts, and styles served directly from Cloudflare Edge CDN.</p>
          </div>
        </section>

        <section className="cta">
          <h2>API Endpoint Ready</h2>
          <p>Test the edge API returning typed Cloudflare context:</p>
          <a href="/api/info" className="button">
            View /api/info
          </a>
        </section>
      </main>
    )
  }
}
`,

    'app/actions/controller.tsx': `import { createController } from 'remix/router'
import { getCloudflareContext } from '@bennyhinn18/remix-cloudflare'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'
import { HomePage } from './home-page.tsx'

export default createController(routes, {
  actions: {
    home(context) {
      const { cf } = getCloudflareContext(context)
      return context.render(
        <Document>
          <HomePage
            country={cf?.country}
            city={cf?.city}
            colo={cf?.colo}
          />
        </Document>
      )
    },
    apiInfo(context) {
      const { cf } = getCloudflareContext(context)
      return Response.json({
        framework: 'Remix 3',
        runtime: 'Cloudflare Workers',
        adapter: '@bennyhinn18/remix-cloudflare',
        edge: {
          country: cf?.country ?? 'Unknown',
          city: cf?.city ?? 'Unknown',
          colo: cf?.colo ?? 'Unknown',
          timezone: cf?.timezone ?? 'UTC',
        },
        timestamp: new Date().toISOString(),
      })
    },
  },
})
`,

    'app/styles.css': `:root {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --bg-color: #0f172a;
  --card-bg: #1e293b;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --accent: #38bdf8;
  --accent-gradient: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-color);
  color: var(--text-main);
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 4rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
}

.hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.badge {
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
  border: 1px solid rgba(56, 189, 248, 0.2);
  padding: 0.35rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.hero h1 {
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.2;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.125rem;
  max-width: 600px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.card {
  background: var(--card-bg);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-icon {
  font-size: 2rem;
}

.card h3 {
  font-size: 1.25rem;
}

.card p {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.cta {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(30, 41, 59, 0.8) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 2.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.cta p {
  color: var(--text-muted);
}

.button {
  display: inline-block;
  background: var(--accent-gradient);
  color: #0f172a;
  font-weight: 700;
  text-decoration: none;
  padding: 0.75rem 1.75rem;
  border-radius: 8px;
  margin-top: 0.5rem;
  transition: opacity 0.2s;
}

.button:hover {
  opacity: 0.9;
}
`,

    'public/favicon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="20" fill="#0f172a"/>
  <path d="M50 20 L75 40 L60 80 L40 80 L25 40 Z" fill="url(#grad)"/>
</svg>
`,

    'AGENTS.md': `# AI Agent Guide — ${projectName}

This repository is built with **Remix 3** and deployed to **Cloudflare Workers** using \`@bennyhinn18/remix-cloudflare\`.

---

## 🛠️ Development & Deployment Commands

\`\`\`sh
npm install            # Install dependencies
npm run preview        # Preview Cloudflare Worker locally via Wrangler Miniflare
npm run deploy         # Build stylesheets and deploy live to Cloudflare Workers
npm run typecheck      # Type-check TypeScript (tsc --noEmit)
npx @bennyhinn18/remix-cloudflare doctor # Check Cloudflare Workers compatibility health
\`\`\`

---

## 🏗️ Architecture & Edge Conventions

- **Entrypoint**: \`worker.ts\` bridges Cloudflare's fetch handler to Remix via \`createWorkerHandler(router)\`.
- **Edge Router (\`app/router.ts\`)**: Must remain 100% runtime-agnostic. Never import Node.js packages (\`node:fs\`, \`node:child_process\`).
- **Edge Assets**: Static files live in \`./public\` and are served globally by Cloudflare Edge Assets (\`env.ASSETS\`).
- **Bindings**: Access KV, D1, R2, and AI bindings in actions via \`const { env, cf, ctx } = getCloudflareContext(context)\`.
`,

    'README.md': `# ${projectName}

A modern, high-performance web app built with **Remix 3** and **Cloudflare Workers**.

Powered by [\`@bennyhinn18/remix-cloudflare\`](https://github.com/bennyhinn18/remix-cloudflare).

---

## 🚀 Quickstart

\`\`\`sh
# 1. Install dependencies
npm install

# 2. Preview locally on Cloudflare Workers (Miniflare)
npm run preview

# 3. Deploy live to Cloudflare Workers
npm run deploy
\`\`\`

---

## 📂 Project Structure

- \`worker.ts\`: Cloudflare Worker entrypoint with \`createWorkerHandler\`
- \`wrangler.jsonc\`: Cloudflare Workers & Edge Assets configuration
- \`app/routes.ts\`: Typed route contracts
- \`app/router.ts\`: Edge-compatible fetch router
- \`app/actions/\`: UI components and controller actions
- \`public/\`: Static files served directly by Cloudflare CDN
`,
  }

  // Also write public/styles.css by default so the app displays styled out of the box
  files['public/styles.css'] = files['app/styles.css']

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(targetDir, relativePath)
    if (!dryRun) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content, 'utf-8')
    }
    console.log(`  ✅ Created ${relativePath}`)
  }

  console.log(`
🎉 Successfully scaffolded ${projectName}!

Next steps:
  cd ${path.relative(process.cwd(), targetDir) || '.'}
  npm install
  npm run preview
`)
}
