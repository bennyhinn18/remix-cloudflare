# @bennyhinn18/remix-cloudflare

<div align="center">

![Remix 3](https://img.shields.io/badge/Remix-v3.0+-blue?style=flat-square&logo=remix)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers%20%7C%20Pages-orange?style=flat-square&logo=cloudflare)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**A high-performance, lightweight Cloudflare Workers and Pages adapter for Remix 3.**

[Features](#features) • [Installation](#installation) • [Quickstart](#quickstart) • [Bindings (D1, KV, R2)](#working-with-cloudflare-bindings) • [Troubleshooting](#troubleshooting)

</div>

---

## ⚡ Why @bennyhinn18/remix-cloudflare?

**Remix 3** dropped React in favor of native Web Platform primitives (`Request`, `Response`, `TransformStream`, and `createRouter`). While Remix 3's router is runtime-agnostic, running it on Cloudflare requires bridging between Cloudflare's `ExportedHandler` (`fetch(request, env, ctx)`) and Remix's Fetch router, without pulling in Node-only disk filesystem dependencies (`node:fs`).

`@bennyhinn18/remix-cloudflare` provides:
- 🚀 **Zero Overhead**: Direct native Web Fetch bridge with no runtime bloat.
- 🌐 **Static Asset Fallback**: Seamless integration with Cloudflare's modern `ASSETS` binding.
- 🔒 **Type-Safe Bindings**: Access Cloudflare D1, KV, R2, Vectorize, and AI directly from Remix actions.
- 🛡️ **Custom Error Boundaries**: Clean, production-safe error trapping.

---

## ⚡ Quickstart

### 1. Create a Brand New Project (Zero Config)

Scaffold a complete, production-ready Remix 3 + Cloudflare Workers app with one command:

```sh
npm create @bennyhinn18/remix-cloudflare my-app
# or
npx @bennyhinn18/remix-cloudflare new my-app
```

Then start building:
```sh
cd my-app
npm install
npm run preview   # Run locally on Cloudflare Workers Miniflare
npm run deploy    # Deploy live to Cloudflare Workers
```

---

### 2. Migrate an Existing Remix 3 Project

Inside any existing Remix 3 project directory:

```sh
npx @bennyhinn18/remix-cloudflare init
```

This automatically:
- 📄 Generates `worker.ts` with `createWorkerHandler`.
- ⚙️ Configures `wrangler.jsonc` with modern Edge Assets (`./public`) and `nodejs_compat`.
- 🛠️ Patches `package.json` with `deploy` and `preview` scripts, and fixes hanging CI builds.
- 🌐 Refactors `app/router.ts` for edge runtime (decoupling Node-only asset bundlers, with automatic `.bak` backup).
- 🔄 Updates `server.ts` so `npm run dev` continues serving static assets in local Node development.
- 🤖 Generates or updates `AGENTS.md` so AI coding assistants (Cursor, Copilot, Antigravity) understand the setup.

### 🩺 Diagnostic Health Check

Verify your project's readiness for Cloudflare Workers at any time:

```sh
npx @bennyhinn18/remix-cloudflare doctor
```

```text
🩺 Running Remix 3 Cloudflare Worker Diagnostic Checks...

  ✅ worker.ts: Valid Cloudflare worker entrypoint found
  ✅ Wrangler config: Found configuration file
  ✅ app/router.ts: Edge-compatible (pure Web router)
  ✅ package.json: "build" script is non-blocking
  ✅ package.json: @bennyhinn18/remix-cloudflare is listed

🎉 All checks passed! Your project is ready for Cloudflare Workers.
```

---

## 📦 Manual Installation

```sh
npm install @bennyhinn18/remix-cloudflare
npm install -D wrangler @cloudflare/workers-types
```

### 1. Create your Worker entrypoint (`worker.ts`)

```ts
import { createWorkerHandler } from '@bennyhinn18/remix-cloudflare'
import { router } from './app/router.ts'

export default createWorkerHandler(router)
```

### 2. Configure Wrangler (`wrangler.jsonc`)

Using Cloudflare's modern Edge Assets binding:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-remix-app",
  "main": "worker.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  }
}
```

### 3. Ensure your `app/router.ts` is Edge-Ready

Ensure your router only includes web-standard middleware (such as `render()`), and avoids Node-only filesystem middleware:

```ts
// app/router.ts
import { createRouter } from 'remix/router'
import { render } from 'remix/middleware/render'
import controller from './actions/controller.tsx'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [render()],
})

router.map(routes, controller)
```

### 4. Update `package.json` Scripts

In Remix 3, there is no mandatory compiler step for server routes. Cloudflare requires your build command to compile static assets (like Tailwind CSS) and exit immediately:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:remix\" \"npm run dev:css\"",
    "build:css": "tailwindcss -i ./app/styles/tailwind.css -o ./public/styles.css",
    "build": "npm run build:css",
    "preview": "wrangler dev",
    "deploy": "npm run build && wrangler deploy"
  }
}
```

---

## 🗄️ Working with Cloudflare Bindings

You can type and access Cloudflare bindings (D1 databases, KV namespaces, R2 buckets, and environment secrets) directly inside any Remix controller action using `getCloudflareContext`:

```tsx
import { getCloudflareContext } from '@bennyhinn18/remix-cloudflare'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  BUCKET: R2Bucket
  API_SECRET: string
}

export default createController(routes, {
  actions: {
    async home(context) {
      const { env, ctx, cf } = getCloudflareContext<Env>(context)

      // Query Cloudflare D1
      const users = await env.DB.prepare('SELECT * FROM users').all()

      // Read Cloudflare Geolocation
      const country = cf?.country

      return context.render(<HomePage users={users} country={country} />)
    },
  },
})
```

---

## 🛠️ Custom Error Handling

Customize how 500 errors are presented in production:

```ts
export default createWorkerHandler(router, {
  onError(error, request, env) {
    console.error('Captured Edge Error:', error)
    return new Response('Something went wrong on the edge!', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  },
})
```

---

## ❓ Troubleshooting

### My build is stuck / hanging on Cloudflare CI!
In Remix 3, the starter often includes `"build": "... && npm run start"`. Because `npm run start` launches Node's HTTP listener (`server.listen()`), the CI build never exits.
**Fix**: Change your `"build"` script to only compile your assets (`npm run build:css`) without invoking `start`.

### Bundler error: `Could not resolve lightningcss` or `oxc`
This occurs if your `worker.ts` imports `app/assets.ts` or `staticFiles` from `remix/middleware/static`. In Cloudflare Workers, static files should be served via Cloudflare's `assets = { directory: "./public" }` binding instead of Node filesystem middleware.

---

## 🤝 Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](./CONTRIBUTING.md) for details on setting up the repository and submitting pull requests.

## 📄 License

MIT © [BennyHinn Sam](https://github.com/bennyhinn18)
