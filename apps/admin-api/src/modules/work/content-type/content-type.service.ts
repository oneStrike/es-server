import { RepositoryService } from '@libs/database'
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
    const exists = await this.contentType.findUnique({ where: { code } })
    if (exists) {
      throw new BadRequestException('内容类型编码已存在')
    }
    return this.prisma.workContentType.create({
      data: { code, name, isEnabled },
    })
  }

  /**
   * 列表查询
   */
  async getContentTypeList(query?: QueryContentTypeDto) {
    const { code, name, isEnabled } = query as any
    const where: any = {}
    if (code) {
      where.code = { contains: code }
    }
    if (name) {
      where.name = { contains: name }
    }
    where.isEnabled = isEnabled || true

    return this.contentType.findMany({ where })
  }

  /**
   * 更新
   */
  async updateContentType(body: UpdateContentTypeDto) {
    const { id, code, ...rest } = body as any
    const exists = await this.contentType.findUnique({ where: { id } })
    if (!exists) {
      throw new BadRequestException('内容类型不存在')
    }

    if (code && code !== exists.code) {
      const dup = await this.contentType.findUnique({ where: { code } })
      if (dup) {
        throw new BadRequestException('内容类型编码已存在')
      }
    }
    return this.contentType.update({ where: { id }, data: { code, ...rest } })
  }
}
