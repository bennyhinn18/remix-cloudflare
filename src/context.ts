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
