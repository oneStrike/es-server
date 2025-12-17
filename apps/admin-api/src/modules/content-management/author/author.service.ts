import type { WorkAuthorWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateAuthorDto,
  QueryAuthorDto,
  UpdateAuthorDto,
} from './dto/author.dto'

/**
 * 作者服务类
 * 提供作者的增删改查等核心业务逻辑
 */
@Injectable()
export class WorkAuthorService extends RepositoryService {
  get workAuthor() {
    return this.prisma.workAuthor
  }

  /**
   * 创建作者
   * @param createAuthorDto 创建作者的数据
   * @returns 创建的作者信息
   */
  async createAuthor(createAuthorDto: CreateAuthorDto) {
    // 创建作者
    return this.workAuthor.create({
      data: createAuthorDto,
    })
  }

  /**
   * 分页查询作者列表
   * @param queryAuthorDto 查询条件
   * @returns 分页作者列表
   */
  async getAuthorPage(queryAuthorDto: QueryAuthorDto) {
    const { name, isEnabled, nationality, gender, isRecommended, ...pageDto } =
      queryAuthorDto

    // 构建查询条件
    const where: WorkAuthorWhereInput = {
      deletedAt: null,
    }

    // 姓名模糊搜索
    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }

    // 启用状态筛选
    if (typeof isEnabled === 'boolean') {
      where.isEnabled = isEnabled
    }

    // 国籍筛选
    if (nationality) {
      where.nationality = nationality
    }

    // 性别筛选
    if (gender !== undefined) {
      where.gender = gender
    }

    // 推荐状态筛选
    if (typeof isRecommended === 'boolean') {
      where.isRecommended = isRecommended
    }
    return this.workAuthor.findPagination({
      where: {
        ...where,
        ...pageDto,
      },
      omit: {
        remark: true,
        description: true,
        deletedAt: true,
      },
    })
  }

  /**
   * 获取作者详情
   * @param id 作者ID
   * @returns 作者详情信息
   */
  async getAuthorDetail(id: number) {
    const author = await this.workAuthor.findUnique({
      where: { id },
    })

    if (!author) {
      throw new BadRequestException('作者不存在')
    }

    return author
  }

  /**
   * 更新作者信息
   * @param updateAuthorDto 更新作者的数据
   * @returns 更新后的作者信息
   */
  async updateAuthor(updateAuthorDto: UpdateAuthorDto) {
    const { id, ...updateData } = updateAuthorDto

    // 验证作者是否存在
    const existingAuthor = await this.workAuthor.findUnique({ where: { id } })
    if (!existingAuthor) {
      throw new BadRequestException('作者不存在')
    }

    // 更新作者信息
    return this.workAuthor.update({
      where: { id },
      data: {
        ...updateData,
      },
    })
  }

  /**
   * 软删除作者
   * @param id 作者ID
   * @returns 删除结果
   */
  async deleteAuthor(id: number) {
    // 验证作者是否存在
    const existingAuthor = await this.workAuthor.findUnique({ where: { id } })
    if (!existingAuthor) {
      throw new BadRequestException('作者不存在')
    }
    if (existingAuthor.worksCount && existingAuthor.worksCount > 0) {
      throw new BadRequestException(
        `该作者还有 ${existingAuthor.worksCount} 个关联作品，无法删除`,
      )
    }

    return this.workAuthor.softDelete({ id })
  }
}
