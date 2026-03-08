import type { PrismaClientType } from './prisma.types'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { CustomPrismaService } from 'nestjs-prisma/dist/custom'

@Injectable()
export abstract class BaseService {
  @Inject('PrismaService')
  /** Prisma service injection */
  protected prismaService!: CustomPrismaService<PrismaClientType>

  /** Access Prisma client */
  protected get prisma(): PrismaClientType {
    return this.prismaService.client
  }

  /** Check whether error matches a Prisma error code */
  protected isPrismaErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === code
    )
  }

  /** Prisma unique constraint violation (P2002) */
  isUniqueConstraintError(error: unknown): boolean {
    return this.isPrismaErrorCode(error, 'P2002')
  }

  /** Prisma record not found (P2025) */
  isRecordNotFound(error: unknown): boolean {
    return this.isPrismaErrorCode(error, 'P2025')
  }

  /** Prisma transaction conflict / serialization failure (P2034) */
  isTransactionConflict(error: unknown): boolean {
    return this.isPrismaErrorCode(error, 'P2034')
  }

  /** Generic Prisma error mapper */
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
   * Map common Prisma business errors to BadRequestException messages.
   * Use semantic fields instead of hardcoding P2002/P2025/P2034 in each service.
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

  /** Retry helper for transaction conflicts */
  protected async withTransactionConflictRetry<T>(
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number
    },
  ): Promise<T> {
    const maxRetries = Math.max(1, options?.maxRetries ?? 3)
    let lastError: unknown = new Error(
      'transaction conflict retry exhausted unexpectedly',
    )

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
