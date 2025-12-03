import type { WorkAuthorWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'
import { BatchEnabledDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateAuthorDto,
  QueryAuthorDto,
  UpdateAuthorDto,
  UpdateAuthorFeaturedDto,
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
    const { roleTypeIds, ...authorData } = createAuthorDto

    // 验证社交媒体链接格式
    if (createAuthorDto.socialLinks) {
      try {
        JSON.parse(createAuthorDto.socialLinks)
      } catch {
        throw new BadRequestException(
          '社交媒体链接格式不正确，请使用有效的JSON格式',
        )
      }
    }

    // 验证角色类型ID是否有效
    if (roleTypeIds && roleTypeIds.length > 0) {
      const validRoleTypes = await this.prisma.workAuthorRoleType.findMany({
        where: {
          id: { in: roleTypeIds },
          isEnabled: true,
        },
      })

      if (validRoleTypes.length !== roleTypeIds.length) {
        throw new BadRequestException('存在无效的角色类型ID')
      }
    }

    // 创建作者及关联角色
    return this.workAuthor.create({
      data: {
        ...authorData,
        authorRoles: {
          create: roleTypeIds.map((roleTypeId, index) => ({
            roleTypeId,
            isPrimary: index === 0, // 第一个角色为主要角色
          })),
        },
      },
      include: {
        authorRoles: {
          include: {
            roleType: true,
          },
        },
      },
    })
  }

  /**
   * 分页查询作者列表
   * @param queryAuthorDto 查询条件
   * @returns 分页作者列表
   */
  async getAuthorPage(queryAuthorDto: QueryAuthorDto) {
    const {
      name,
      isEnabled,
      roleTypeIds,
      nationality,
      gender,
      featured,
      ...pageDto
    } = queryAuthorDto

    // 构建查询条件
    const where: WorkAuthorWhereInput = {}

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

    // 角色类型筛选（通过关联表查询）
    if (roleTypeIds && roleTypeIds.length > 0) {
      where.authorRoles = {
        some: {
          roleTypeId: {
            in: roleTypeIds.split(',').map(Number),
          },
        },
      }
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
    if (typeof featured === 'boolean') {
      where.featured = featured
    }

    return this.workAuthor.findPagination({
      where: {
        ...where,
        ...pageDto,
      },
      omit: {
        remark: true,
        socialLinks: true,
        nationality: true,
        description: true,
        deletedAt: true,
      },
      include: {
        authorRoles: {
          include: {
            roleType: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
          orderBy: {
            isPrimary: 'desc', // 主要角色排在前面
          },
        },
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
      include: {
        authorRoles: {
          include: {
            roleType: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
              },
            },
          },
          orderBy: {
            isPrimary: 'desc',
          },
        },
      },
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
    const { id, roleTypeIds, ...updateData } = updateAuthorDto

    // 验证作者是否存在
    const existingAuthor = await this.workAuthor.findUnique({ where: { id } })
    if (!existingAuthor) {
      throw new BadRequestException('作者不存在')
    }

    // 验证社交媒体链接格式
    if (updateData.socialLinks) {
      try {
        JSON.parse(updateData.socialLinks)
      } catch {
        throw new BadRequestException(
          '社交媒体链接格式不正确，请使用有效的JSON格式',
        )
      }
    }

    // 验证角色类型ID是否有效
    if (roleTypeIds && roleTypeIds.length > 0) {
      const validRoleTypes = await this.prisma.workAuthorRoleType.findMany({
        where: {
          id: { in: roleTypeIds },
          isEnabled: true,
        },
      })

      if (validRoleTypes.length !== roleTypeIds.length) {
        throw new BadRequestException('存在无效的角色类型ID')
      }
    }

    // 更新作者信息
    return this.workAuthor.update({
      where: { id },
      data: {
        ...updateData,
        // 如果提供了 roleTypeIds，更新角色关联
        ...(roleTypeIds !== undefined && {
          authorRoles: {
            deleteMany: {}, // 先删除所有旧关联
            create: roleTypeIds.map((roleTypeId, index) => ({
              roleTypeId,
              isPrimary: index === 0,
            })),
          },
        }),
      },
      include: {
        authorRoles: {
          include: {
            roleType: true,
          },
        },
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
