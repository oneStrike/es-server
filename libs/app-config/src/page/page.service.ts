import type { AppPageWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  BaseAppPageDto,
  QueryAppPageDto,
  UpdateAppPageDto,
} from './dto/page.dto'

@Injectable()
export class LibAppPageService extends BaseService {
  get appPage() {
    return this.prisma.appPage
  }

  constructor() {
    super()
  }

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
        hasEvery: JSON.parse(enablePlatform).map((item: string) =>
          Number(item),
        ),
      }
    }

    return this.appPage.findPagination({
      where: { ...where, ...other },
    })
  }

  async findActivePages(accessLevel?: string) {
    const where: AppPageWhereInput = {
      isEnabled: true,
    }

    if (accessLevel) {
      where.accessLevel = accessLevel as any
    }

    return this.appPage.findMany({
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
