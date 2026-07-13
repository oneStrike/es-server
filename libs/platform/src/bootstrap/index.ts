export { PlatformModule } from '../platform.module'
export { setupApp } from './app.setup'
export { setupCompression } from './compression'
export {
  isValidTrustedProxyEntry,
  parseTrustedProxyIps,
  resolveFastifyTrustProxy,
} from './fastify-trust-proxy'
export type { FastifyTrustProxyConfig } from './fastify-trust-proxy'
export { logStartupInfo } from './logStartupInfo'
export { setupMultipart } from './multipart'
export { normalizeNullableReferenceSchemas, setupSwagger } from './swagger'
