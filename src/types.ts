import type { Router } from 'remix/router'

/**
 * Options for configuring the Cloudflare Workers Remix adapter.
 */
export interface CreateWorkerHandlerOptions<Env = unknown> {
  /**
   * Custom error handler invoked when the router or request throws an unhandled error.
   */
  onError?: (error: unknown, request: Request, env: Env) => Response | Promise<Response>

  /**
   * Whether to fallback to `env.ASSETS` fetch if the router does not match a route.
   * Default: true
   */
  fallbackToAssets?: boolean
}

/**
 * Cloudflare Worker execution context and environment bindings
 * accessible from Remix request context.
 */
export interface CloudflareAppContext<Env = Record<string, unknown>> {
  env: Env
  ctx: ExecutionContext
  cf?: IncomingRequestCfProperties
}

declare module 'remix' {
  interface RouterTypes {
    env?: Record<string, unknown>
    cf?: IncomingRequestCfProperties
  }
}
