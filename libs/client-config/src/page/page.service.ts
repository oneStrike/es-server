import { RepositoryService } from '@libs/base/database'
import { ClientPageWhereInput } from '@libs/base/database/prisma-client/models'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  BaseClientPageDto,
  QueryClientPageDto,
  UpdateClientPageDto,
} from './dto/page.dto'

/**
 * 页面配置服务类
 * 提供页面配置的增删改查等核心业务逻辑
 */
@Injectable()
export class LibClientPageService extends RepositoryService {
  get clientPage() {
    return this.prisma.clientPage
  }

  constructor() {
    super()
  }

  /**
   * 创建页面配置
   * @param createPageDto 创建页面配置的数据
   * @returns 创建的页面配置信息
   */
  async createPage(createPageDto: BaseClientPageDto) {
    // 验证页面编码是否已存在
    const existingByCode = await this.clientPage.findFirst({
      where: { code: createPageDto.code },
    })
    if (existingByCode) {
      throw new BadRequestException(`页面编码 "${createPageDto.code}" 已存在`)
    }

    // 验证页面路径是否已存在
    const existingByPath = await this.clientPage.findFirst({
      where: { path: createPageDto.path },
    })
    if (existingByPath) {
      throw new BadRequestException(`页面路径 "${createPageDto.path}" 已存在`)
    }

    return this.clientPage.create({ data: createPageDto })
  }

  /**
   * 分页查询页面配置列表
   * @param queryPageDto 查询条件
   * @returns 分页的页面配置列表
   */
  async findPage(queryPageDto: QueryClientPageDto) {
    const { name, code, accessLevel, isEnabled, ...other } = queryPageDto

    const where: ClientPageWhereInput = {}

    if (name) {
      where.name = { contains: name, mode: 'insensitive' }
    }
    if (code) {
      where.code = code
    }
    if (accessLevel !== undefined) {
      where.accessLevel = accessLevel
    }
    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }

    return this.clientPage.findPagination({
      where: { ...where, ...other },
    })
  }

  /**
   * 获取启用的页面配置列表（客户端使用）
   * @param accessLevel 页面权限级别过滤
   * @returns 启用的页面配置列表
   */
  async findActivePages(accessLevel?: string) {
    const where: ClientPageWhereInput = {
      isEnabled: true, // 只返回启用的页面
    }

    if (accessLevel) {
      where.accessLevel = accessLevel as any
    }

    return this.clientPage.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        code: true,
        path: true,
        name: true,
        title: true,
        accessLevel: true,
        description: true,
      },
    })
  }

  /**
   * 更新页面配置
   * @param updatePageDto 更新数据
   * @returns 更新后的页面配置信息
   */
  async updatePage(updatePageDto: UpdateClientPageDto) {
    const { id, ...updateData } = updatePageDto

    // 如果更新页面编码，验证是否已存在
    if (updateData.code) {
      const existingByCode = await this.clientPage.findFirst({
        where: {
          code: updateData.code,
          id: { not: id },
        },
      })
      if (existingByCode) {
        throw new BadRequestException(`页面编码 "${updateData.code}" 已存在`)
      }
    }

    // 如果更新页面路径，验证是否已存在
    if (updateData.path) {
      const existingByPath = await this.clientPage.findFirst({
        where: {
          path: updateData.path,
          id: { not: id },
        },
      })
      if (existingByPath) {
        throw new BadRequestException(`页面路径 "${updateData.path}" 已存在`)
      }
    }
    return this.clientPage.update({
      where: { id },
      data: updateData,
    })
  }
}
