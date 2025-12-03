import { RepositoryService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateContentTypeDto,
  QueryContentTypeDto,
  UpdateContentTypeDto,
} from './dto/content-type.dto'

/**
 * 内容类型服务
 */
@Injectable()
export class ContentTypeService extends RepositoryService {
  get contentType() {
    return this.prisma.workContentType
  }

  /**
   * 创建内容类型
   */
  async createContentType(body: CreateContentTypeDto) {
    const { code, name, isEnabled = true } = body
    if (await this.contentType.exists({ code })) {
      throw new BadRequestException('内容类型编码已存在')
    }
    return this.prisma.workContentType.create({
      data: { code, name, isEnabled },
    })
  }

  /**
   * 列表查询
   */
  async getContentTypeList(query: QueryContentTypeDto) {
    const { code, name, isEnabled } = query
    const where: any = {}
    if (code) {
      where.code = { contains: code }
    }
    if (name) {
      where.name = { contains: name }
    }
    if (typeof isEnabled === 'boolean') {
      where.isEnabled = isEnabled
    }

    return this.contentType.findMany({ where })
  }

  /**
   * 更新
   */
  async updateContentType(dto: UpdateContentTypeDto) {
    const { id, code, ...rest } = dto
    const exists = await this.contentType.findFirst({
      where: {
        OR: [{ code: dto.code }, { name: dto.name }],
        NOT: { id: dto.id },
      },
      select: { id: true, code: true, name: true },
    })

    if (exists?.code === dto.code) {
      throw new BadRequestException('内容类型代码已存在')
    }

    if (exists?.name === dto.name) {
      throw new BadRequestException('内容类型名称已存在')
    }

    return this.contentType.update({ where: { id }, data: { code, ...rest } })
  }
}
