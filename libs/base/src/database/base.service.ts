import type { PrismaClientType } from './prisma.types'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { CustomPrismaService } from 'nestjs-prisma/dist/custom'

@Injectable()
export abstract class BaseService {
  @Inject('PrismaService')
  /** Prisma 服务注入 */
  protected prismaService!: CustomPrismaService<PrismaClientType>

  /** 获取 Prisma 客户端 */
  protected get prisma(): PrismaClientType {
    return this.prismaService.client
  }

  /** 检查错误是否匹配指定的 Prisma 错误码 */
  protected isPrismaErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === code
    )
  }

  /** Prisma 唯一约束冲突错误 (P2002) */
  isUniqueConstraintError(error: unknown): boolean {
    return this.isPrismaErrorCode(error, 'P2002')
  }

  /** Prisma 记录未找到错误 (P2025) */
  isRecordNotFound(error: unknown): boolean {
    return this.isPrismaErrorCode(error, 'P2025')
  }

  /** Prisma 事务冲突/序列化失败错误 (P2034) */
  isTransactionConflict(error: unknown): boolean {
    return this.isPrismaErrorCode(error, 'P2034')
  }

  /** 通用 Prisma 错误映射器 */
  protected handlePrismaError<T = never>(
    error: unknown,
    handlers: Partial<Record<string, () => T>>,
  ): T {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    ) {
      const code = (error as { code: string }).code
      const handler = handlers[code]
      if (handler) {
        return handler()
      }
    }

    throw error
  }

  /**
   * 将常见的 Prisma 业务错误映射为 BadRequestException 消息。
   * 使用语义化字段替代在每个服务中硬编码 P2002/P2025/P2034。
   */
  protected handlePrismaBusinessError(
    error: unknown,
    options: {
      duplicateMessage?: string
      notFoundMessage?: string
      conflictMessage?: string
    },
  ): never {
    const handlers: Partial<Record<string, () => never>> = {}

    if (options.duplicateMessage) {
      handlers.P2002 = () => {
        throw new BadRequestException(options.duplicateMessage)
      }
    }
    if (options.notFoundMessage) {
      handlers.P2025 = () => {
        throw new BadRequestException(options.notFoundMessage)
      }
    }
    if (options.conflictMessage) {
      handlers.P2034 = () => {
        throw new BadRequestException(options.conflictMessage)
      }
    }

    return this.handlePrismaError(error, handlers)
  }

  /** 事务冲突重试辅助方法 */
  protected async withTransactionConflictRetry<T>(
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number
    },
  ): Promise<T> {
    const maxRetries = Math.max(1, options?.maxRetries ?? 3)
    let lastError: unknown = new Error('事务冲突重试次数已耗尽')

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (!this.isTransactionConflict(error) || attempt >= maxRetries - 1) {
          throw error
        }
      }
    }

    throw lastError
  }
}
