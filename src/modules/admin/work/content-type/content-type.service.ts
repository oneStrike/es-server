import { BadRequestException, Injectable } from '@nestjs/common'
import { BaseRepositoryService } from '@/global/services/base-repository.service'
import { PrismaService } from '@/global/services/prisma.service'
import {
  CreateContentTypeDto,
  QueryContentTypeDto,
  UpdateContentTypeDto,
} from './dto/content-type.dto'

/**
 * 内容类型服务
 */
@Injectable()
export class ContentTypeService extends BaseRepositoryService<'WorkContentType'> {
  protected readonly modelName = 'WorkContentType' as const

  constructor(protected readonly prisma: PrismaService) {
    super(prisma)
  }

  /**
   * 创建内容类型
   */
  async createContentType(body: CreateContentTypeDto) {
    const { code, name, isEnabled = true } = body
    const exists = await this.findByUnique({ where: { code } })
    if (exists) {
      throw new BadRequestException('内容类型编码已存在')
    }
    return this.prisma.workContentType.create({
      data: { code, name, isEnabled },
    })
  }

  /**
   * 分页查询
   */
  async getContentTypePage(query?: QueryContentTypeDto) {
    const { code, name, isEnabled } = query as any
    const where: any = {}
    if (code) {
      where.code = { contains: code }
    }
    if (name) {
      where.name = { contains: name }
    }
    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }
    return this.findPagination({ where, orderBy: { id: 'desc' } })
  }

  /**
   * 更新
   */
  async updateContentType(body: UpdateContentTypeDto) {
    const { id, code, ...rest } = body as any
    const exists = await this.findById({ id })
    if (!exists) {
      throw new BadRequestException('内容类型不存在')
    }

    if (code && code !== exists.code) {
      const dup = await this.findByUnique({ where: { code } })
      if (dup) {
        throw new BadRequestException('内容类型编码已存在')
      }
    }
    return this.update({ where: { id }, data: { code, ...rest } })
  }
}
