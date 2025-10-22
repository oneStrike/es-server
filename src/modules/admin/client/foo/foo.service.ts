import { Inject, Injectable } from '@nestjs/common'
import { CustomPrismaService } from 'nestjs-prisma/dist/custom'
import { PrismaClientType } from '@/prisma/prisma.connect'

/**
 * 通知服务类
 * 提供通知的增删改查等核心业务逻辑
 */
@Injectable()
export class FooService {
  get dbClient() {
    return this.prismaService.client.clientNotice
  }

  constructor(
    @Inject('PrismaService')
    private prismaService: CustomPrismaService<PrismaClientType>,
  ) {}

  /**
   * 创建通知
   * @param createNoticeDto 创建通知的数据
   * @returns 创建的通知信息
   */
  async createNotice() {
    return this.dbClient.exists({ id: 1 })
  }
}
