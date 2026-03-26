import type { UploadConfigInterface } from '@libs/platform/config'
import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { ConfigService } from '@nestjs/config'

const EXT_LEADING_DOT_REGEX = /^\./

/**
 * 配置文件上传与静态文件服务
 *
 * 初始化上传目录、注册静态文件服务与 multipart 解析器。
 * 对文档和压缩包类型强制设置 Content-Disposition 为 attachment，防止浏览器直接渲染或执行。
 *
 * @param fastifyAdapter - Fastify 适配器实例
 * @param app - NestJS 应用实例，用于获取 ConfigService
 */
export async function setupMultipart(
  fastifyAdapter: FastifyAdapter,
  app: NestFastifyApplication,
) {
  const configService = app.get(ConfigService)
  const uploadConfig = configService.get<UploadConfigInterface>('upload')!

  await Promise.all([
    mkdir(uploadConfig.localDir, { recursive: true }),
    mkdir(uploadConfig.tmpDir, { recursive: true }),
  ])

  await fastifyAdapter.register(fastifyStatic, {
    root: uploadConfig.localDir,
    prefix: uploadConfig.localUrlPrefix,
    index: false,
    dotfiles: 'deny',
    etag: true,
    cacheControl: true,
    maxAge: '1h',
    setHeaders(res: any, filePath: string) {
      try {
        const { document, archive } = uploadConfig.allowExtensions
        const ext = extname(filePath).toLowerCase().replace(EXT_LEADING_DOT_REGEX, '')
        const isDoc = document?.includes(ext)
        const isArchive = archive?.includes(ext)
        if (isDoc || isArchive) {
          res.setHeader('Content-Disposition', 'attachment')
          res.setHeader('X-Content-Type-Options', 'nosniff')
        }
      } catch {}
    },
  })

  await fastifyAdapter.register(fastifyMultipart, {
    throwFileSizeLimit: true,
    fileSize: uploadConfig.maxFileSize,
    limits: {
      fieldNameSize: 100,
      fieldSize: 100 * 1024,
      fields: 10,
      files: 1,
      parts: 1000,
      fileSize: uploadConfig.maxFileSize,
    },
  })
}
