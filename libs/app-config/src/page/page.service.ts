import type { AppPageWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  BaseAppPageDto,
  QueryAppPageDto,
  UpdateAppPageDto,
} from './dto/page.dto'

/**
 * 应用页面服务
 * 负责页面配置的创建、查询与更新
 */
@Injectable()
export class AppPageService extends BaseService {
  get appPage() {
    return this.prisma.appPage
  }

  constructor() {
    super()
  }

  /**
   * 创建应用页面配置
   * @param createPageDto 页面数据
   * @returns 创建后的页面记录
   */
  async createPage(createPageDto: BaseAppPageDto) {
    const existingByCode = await this.appPage.findUnique({
      where: { code: createPageDto.code },
      select: { code: true, path: true },
    })
    if (existingByCode) {
      throw new BadRequestException(`页面编码 "${createPageDto.code}" 已存在`)
    }

    const existingByPath = await this.appPage.findFirst({
      where: { path: createPageDto.path },
    })
    if (existingByPath) {
      throw new BadRequestException(`页面路径 "${createPageDto.path}" 已存在`)
    }

    return this.appPage.create({ data: createPageDto })
  }

  /**
   * 分页查询页面配置
   * @param queryPageDto 查询条件
   * @returns 分页结果
   */
  async findPage(queryPageDto: QueryAppPageDto) {
    const { name, code, accessLevel, isEnabled, enablePlatform, ...other } =
      queryPageDto

    const where: AppPageWhereInput = {}

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

    if (enablePlatform && enablePlatform !== '[]') {
      where.enablePlatform = {
        hasSome: JSON.parse(enablePlatform).map((item: string) => Number(item)),
      }
    }

    return this.appPage.findPagination({
      where: { ...where, ...other },
      omit: {
        description: true,
      },
    })
  }

  /**
   * 获取启用状态的页面列表
   * @returns 页面列表
   */
  async findActivePages() {
    return this.appPage.findMany({
      where: { isEnabled: true },
    })
  }

  /**
   * 更新页面配置
   * @param updatePageDto 更新数据
   * @returns 更新后的页面记录
   */
  async updatePage(updatePageDto: UpdateAppPageDto) {
    const { id, ...updateData } = updatePageDto

    if (updateData.code) {
      const existingByCode = await this.appPage.findFirst({
        where: {
          code: updateData.code,
          id: { not: id },
        },
      })
      if (existingByCode) {
        throw new BadRequestException(`页面编码 "${updateData.code}" 已存在`)
      }
    }

    if (updateData.path) {
      const existingByPath = await this.appPage.findFirst({
        where: {
          path: updateData.path,
          id: { not: id },
        },
      })
      if (existingByPath) {
        throw new BadRequestException(`页面路径 "${updateData.path}" 已存在`)
      }
    }
    return this.appPage.update({
      where: { id },
      data: updateData,
    })
  }
}
