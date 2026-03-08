import type { AppPageWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  BaseAppPageDto,
  QueryAppPageDto,
  UpdateAppPageDto,
} from './dto/page.dto'

@Injectable()
export class AppPageService extends BaseService {
  get appPage() {
    return this.prisma.appPage
  }

  constructor() {
    super()
  }

  async createPage(createPageDto: BaseAppPageDto) {
    try {
      return await this.appPage.create({ data: createPageDto })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('椤甸潰缂栫爜鎴栬矾寰勫凡瀛樺湪')
        },
      })
    }
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

  async findActivePages() {
    return this.appPage.findMany({
      where: { isEnabled: true },
    })
  }

  async updatePage(updatePageDto: UpdateAppPageDto) {
    const { id, ...updateData } = updatePageDto

    try {
      return await this.appPage.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('椤甸潰缂栫爜鎴栬矾寰勫凡瀛樺湪')
        },
      })
    }
  }
}
