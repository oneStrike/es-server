import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import type { UploadConfig } from '../../../../libs/upload/src/upload.config'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { ConfigService } from '@nestjs/config'

export async function setupMultipart(
  fastifyAdapter: FastifyAdapter,
  app: NestFastifyApplication,
) {
  const uploadConfig = app.get(ConfigService).get<UploadConfig>('upload')!

  // 确保上传目录存在（在挂载的宿主机目录下递归创建）
  await mkdir(uploadConfig.uploadDir, { recursive: true })

  // 注册静态文件服务
  await fastifyAdapter.register(fastifyStatic as any, {
    root: uploadConfig.uploadDir,
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
    etag: true,
    cacheControl: true,
    maxAge: '1h',
    // 针对文档与压缩包类型强制以附件方式下载，降低 XSS 风险
    setHeaders(res: any, filePath: string) {
      try {
        const ext = extname(filePath).toLowerCase()
        const isDoc = uploadConfig.documentType.extensions.includes(ext)
        const isArchive = uploadConfig.archiveType.extensions.includes(ext)
        if (isDoc || isArchive) {
          res.setHeader('Content-Disposition', 'attachment')
        }
      } catch {}
    },
  })

  // 注册multipart插件
  await fastifyAdapter.register(fastifyMultipart as any, {
    throwFileSizeLimit: true, // 启用文件大小限制异常抛出
    limits: {
      fieldNameSize: 100, // 字段名称最大长度
      fieldSize: 100 * 1024, // 字段值最大长度 (100KB)
      fields: 10, // 最大字段数量
      files: uploadConfig.maxFiles, // 最大文件数量
      fileSize: uploadConfig.maxFileSize, // 全局文件大小限制
      parts: 1000, // 最大part数量
    },
  })
}
