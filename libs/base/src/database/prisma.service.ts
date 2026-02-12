import type { PrismaClientType } from './prisma.types'
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  exists,
  findPagination,
  maxOrder,
  softDelete,
  swapField,
} from './extensions'
import { PrismaClient } from './index'

/**
 * 创建带有自定义扩展的 Prisma Client
 * 统一注入通用数据访问能力
 */
export function makePrismaClient(connectionString: string) {
  // 使用 PostgreSQL Adapter 连接数据库
  const adapter = new PrismaPg({ connectionString })
  // 注入通用扩展方法，便于模型统一复用
  return new PrismaClient({ adapter }).$extends({
    model: {
      $allModels: {
        exists,
        ...softDelete,
        findPagination,
        maxOrder,
        swapField,
      },
    },
  })
}
@Injectable()
export class PrismaService implements OnApplicationShutdown {
  public readonly client: PrismaClientType

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.client = makePrismaClient(
      this.configService.get('db.connection') as string,
    )
  }

  createPrismaClient(): PrismaClientType {
    return this.client
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect()
  }
}
