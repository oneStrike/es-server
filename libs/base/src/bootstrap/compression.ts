import type { FastifyAdapter } from '@nestjs/platform-fastify'
import * as zlib from 'node:zlib'
import fastifyCompress from '@fastify/compress'

/**
 * 配置 Fastify 响应压缩
 * 支持 gzip、deflate、brotli 等压缩算法
 */
export async function setupCompression(fastifyAdapter: FastifyAdapter) {
  await fastifyAdapter.register(fastifyCompress as any, {
    global: true, // 全局启用压缩
    threshold: 1024, // 仅对大于 1KB 的响应进行压缩

    // 按优先级顺序支持的压缩算法（br > gzip > deflate）
    encodings: ['zstd', 'br', 'gzip', 'deflate'],

    // Brotli 压缩配置（最佳压缩率，但 CPU 消耗较高）
    brotliOptions: {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // 压缩质量 0-11，4 为平衡值
      },
    },

    // Gzip 压缩配置
    zlibOptions: {
      level: 6, // 压缩级别 0-9，6 为默认值（平衡压缩率和速度）
    },

    // 自定义压缩条件
    customTypes:
      /^text\/|application\/json|application\/javascript|application\/xml/, // 仅压缩文本类型

    // 移除 Content-Length 头（压缩后长度会变化）
    removeContentLengthHeader: true,
  })
}
