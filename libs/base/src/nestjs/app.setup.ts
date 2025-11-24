import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import fastifyCsrf from '@fastify/csrf-protection'
import fastifyHelmet from '@fastify/helmet'
import { isProduction } from '@libs/utils'

import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { setupCompression } from './compression'
import { setupMultipart } from './multipart'
import { setupSwagger } from './swagger'

export interface AppSetupConfig {
  // 全局路由前缀
  globalPrefix?: string
  // 端口号
  port?: number
  // swagger 文档是否启用
  enableSwagger?: boolean
  // swagger文档配置
  swaggerConfig?: {
    // 文档标题
    title?: string
    // 文档描述
    description?: string
    // 文档版本
    version?: string
    // 文档路径
    path?: string
  }
}

const defaultConfig: AppSetupConfig = {
  globalPrefix: 'api',
  port: 8080,
}

/**
 * 配置应用的所有中间件和插件
 */
export async function setupApp(
  app: NestFastifyApplication,
  fastifyAdapter: FastifyAdapter,
  config?: AppSetupConfig,
): Promise<void> {
  const mergedConfig = { ...defaultConfig, ...config }

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  // 设置全局路由前缀
  app.setGlobalPrefix(mergedConfig.globalPrefix!)

  // 处理浏览器自动请求的站点图标，避免 404 噪音日志
  // 若需要自定义图标，可改为使用 @fastify/static 提供真实文件
  fastifyAdapter.getInstance().get('/favicon.ico', async (_req, reply) => {
    reply.type('image/x-icon').code(204).send()
  })

  // 配置响应压缩（gzip/brotli）
  await setupCompression(fastifyAdapter)

  // 配置文件上传
  await setupMultipart(fastifyAdapter, app)

  // 注册 CSRF 保护插件
  await app.register(fastifyCsrf)

  // 注册安全响应头（Helmet）
  await app.register(fastifyHelmet, {
    // 依据 API 服务特性开启常用安全策略
    contentSecurityPolicy: false, // 若无模板渲染，可禁用以减少开销
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xssFilter: true,
    hidePoweredBy: true,
  })

  // 配置 Swagger 文档（生产环境可条件性禁用）
  if (isProduction() || mergedConfig.enableSwagger) {
    setupSwagger(app, mergedConfig.swaggerConfig)
  }
}
