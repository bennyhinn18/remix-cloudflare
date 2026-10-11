import type { Router } from 'remix/router'
import type { CreateWorkerHandlerOptions } from './types.js'

/**
 * Creates an ExportedHandler for Cloudflare Workers that bridges requests to a Remix 3 router.
 *
 * @param router The Remix 3 router instance
 * @param options Configuration options for error handling and asset fallbacks
 * @returns A Cloudflare Worker ExportedHandler object
 *
 * @example
 * ```ts
 * import { createWorkerHandler } from 'remix-cloudflare'
 * import { router } from './app/router.ts'
 *
 * export default createWorkerHandler(router)
 * ```
 */
export function createWorkerHandler<Env = Record<string, unknown>>(
  router: Router<any>,
  options: CreateWorkerHandlerOptions<Env> = {}
): ExportedHandler<Env> {
  const { onError, fallbackToAssets = true } = options

  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      try {
        const response = await router.fetch(request)

        // If the router returned 404 and an ASSETS binding exists, fallback to Cloudflare Edge Assets
        if (response.status === 404 && fallbackToAssets && env && typeof env === 'object' && 'ASSETS' in env) {
          const assetsBinding = (env as Record<string, any>).ASSETS
          if (assetsBinding && typeof assetsBinding.fetch === 'function') {
            const assetResponse = await assetsBinding.fetch(request)
            if (assetResponse.status !== 404) {
              return assetResponse
            }
          }
        }

        return response
      } catch (error) {
        if (onError) {
          try {
            return await onError(error, request, env)
          } catch (handlerError) {
            console.error('Error in custom onError handler:', handlerError)
          }
        }

        console.error('Unhandled Remix Cloudflare Worker error:', error)
        return new Response('Internal Server Error', {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    },
  }
}
