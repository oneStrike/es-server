import type { PrismaClientType } from './prisma.types'
import { Inject, Injectable } from '@nestjs/common'
import { CustomPrismaService } from 'nestjs-prisma/dist/custom'

@Injectable()
export abstract class BaseService {
  @Inject('PrismaService')
  /** Prisma Service 注入 */
  protected prismaService!: CustomPrismaService<PrismaClientType>

  /** 获取 Prisma Client */
  protected get prisma(): PrismaClientType {
    return this.prismaService.client
  }

  /**
   * 判断错误是否为 Prisma 记录未找到错误 (P2025)
   * @param error - 错误对象
   * @returns 是否为记录未找到错误
   */
  isRecordNotFound(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    )
  }
}
