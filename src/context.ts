import { createContextKey, type Middleware } from 'remix/router'

export interface ContextKey<Value> {
  defaultValue?: Value
}

export const CloudflareEnvKey: ContextKey<unknown> = createContextKey<unknown>()

export const CloudflareExecutionContextKey: ContextKey<ExecutionContext> =
  createContextKey<ExecutionContext>()

export const CloudflareCfKey: ContextKey<IncomingRequestCfProperties | undefined> =
  createContextKey<IncomingRequestCfProperties | undefined>()

/**
 * Creates middleware that injects Cloudflare Worker bindings (env, ctx, cf) into Remix request context.
 */
export function cloudflareContext<Env = unknown>(
  env: Env,
  ctx: ExecutionContext,
  cf?: IncomingRequestCfProperties
): Middleware {
  return async (context, next) => {
    context.set(CloudflareEnvKey as any, env)
    context.set(CloudflareExecutionContextKey as any, ctx)
    if (cf) {
      context.set(CloudflareCfKey as any, cf)
    }

    return next()
  }
}

/**
 * Helper to retrieve Cloudflare Worker bindings (env, ctx, cf) from any Remix context or request.
 */
export function getCloudflareContext<Env = Record<string, unknown>>(context: any): {
  env: Env
  ctx: ExecutionContext
  cf?: IncomingRequestCfProperties
} {
  const req = context?.request ?? context
  const env =
    context?.get?.(CloudflareEnvKey) ??
    req?.env ??
    context?.env ??
    {}
  const ctx =
    context?.get?.(CloudflareExecutionContextKey) ??
    req?.ctx ??
    context?.ctx
  const cf =
    context?.get?.(CloudflareCfKey) ??
    req?.cf ??
    context?.cf

  return { env: env as Env, ctx: ctx as ExecutionContext, cf }
}
