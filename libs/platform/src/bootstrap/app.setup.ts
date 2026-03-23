import type { AppConfigInterface } from '@libs/platform/types'
import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import fastifyHelmet from '@fastify/helmet'
import { isDevelopment } from '@libs/platform/utils'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { setupCompression } from './compression'
import { setupMultipart } from './multipart'
import { setupSwagger } from './swagger'

/**
 * 閰嶇疆搴旂敤鐨勬墍鏈変腑闂翠欢鍜屾彃浠?
 */
export async function setupApp(
  app: NestFastifyApplication,
  fastifyAdapter: FastifyAdapter,
  config: AppConfigInterface,
): Promise<void> {
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  // 璁剧疆鍏ㄥ眬璺敱鍓嶇紑
  app.setGlobalPrefix(config.globalApiPrefix)

  // 澶勭悊娴忚鍣ㄨ嚜鍔ㄨ姹傜殑绔欑偣鍥炬爣锛岄伩鍏?404 鍣煶鏃ュ織
  // 鑻ラ渶瑕佽嚜瀹氫箟鍥炬爣锛屽彲鏀逛负浣跨敤 @fastify/static 鎻愪緵鐪熷疄鏂囦欢
  fastifyAdapter.getInstance().get('/favicon.ico', async (_req, reply) => {
    reply.type('image/x-icon').code(204).send()
  })

  // 閰嶇疆鍝嶅簲鍘嬬缉锛坓zip/brotli锛?
  await setupCompression(fastifyAdapter)

  // 閰嶇疆鏂囦欢涓婁紶
  await setupMultipart(fastifyAdapter, app)

  // 娉ㄥ唽瀹夊叏鍝嶅簲澶达紙Helmet锛?
  await app.register(fastifyHelmet, {
    // 渚濇嵁 API 鏈嶅姟鐗规€у紑鍚父鐢ㄥ畨鍏ㄧ瓥鐣?
    contentSecurityPolicy: false, // 鑻ユ棤妯℃澘娓叉煋锛屽彲绂佺敤浠ュ噺灏戝紑閿€
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xssFilter: true,
    hidePoweredBy: true,
  })

  // 閰嶇疆 Swagger 鏂囨。锛堢敓浜х幆澧冨彲鏉′欢鎬х鐢級
  if (isDevelopment() || config.swaggerConfig.enable) {
    setupSwagger(app, config.swaggerConfig)
  }
}
