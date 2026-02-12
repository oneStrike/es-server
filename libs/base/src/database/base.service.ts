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
}
