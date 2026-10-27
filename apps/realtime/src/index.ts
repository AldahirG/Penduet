import { handleRequest } from './routes'
import type { Env } from './env'

export { Room } from './room'
export { Limiter } from './limiter'
export type { Env }

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
} satisfies ExportedHandler<Env>
