import type { UploadConfigInterface } from '@libs/base/config'
import type { AppConfigInterface } from '@libs/base/types'
import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { ConfigService } from '@nestjs/config'

export async function setupMultipart(
  fastifyAdapter: FastifyAdapter,
  app: NestFastifyApplication,
) {
  const configService = app.get(ConfigService)
  const uploadConfig = configService.get<UploadConfigInterface>('upload')!
  const appConfig = configService.get<AppConfigInterface>('app')!

  // 确保上传目录存在（在挂载的宿主机目录下递归创建）
  await mkdir(uploadConfig.uploadDir, { recursive: true })

  // 注册静态文件服务
  await fastifyAdapter.register(fastifyStatic, {
    root: uploadConfig.uploadDir,
    prefix: appConfig.fileUrlPrefix,
    index: false,
    dotfiles: 'deny',
    etag: true,
    cacheControl: true,
    maxAge: '1h',
    // 针对文档与压缩包类型强制以附件方式下载，降低 XSS 风险
    setHeaders(res: any, filePath: string) {
      try {
        const { document, archive } = uploadConfig.allowMimeTypes
        const ext = extname(filePath).toLowerCase()
        const isDoc = document?.includes(ext)
        const isArchive = archive?.includes(ext)
        if (isDoc || isArchive) {
          res.setHeader('Content-Disposition', 'attachment')
        }
      } catch {}
    },
  })

  // 注册multipart插件
  await fastifyAdapter.register(fastifyMultipart, {
    // 启用文件大小限制异常抛出
    throwFileSizeLimit: true,
    // 全局文件大小限制，直接传递给插件
    fileSize: uploadConfig.maxFileSize,
    // 其他限制配置
    limits: {
      fieldNameSize: 100, // 字段名称最大长度
      fieldSize: 100 * 1024, // 字段值最大长度 (100KB)
      fields: 10, // 最大字段数量
      files: 1, // 最大文件数量，单文件模式
      parts: 1000, // 最大part数量
      fileSize: uploadConfig.maxFileSize, // 确保在limits对象中也设置文件大小限制
    },
  })
}
