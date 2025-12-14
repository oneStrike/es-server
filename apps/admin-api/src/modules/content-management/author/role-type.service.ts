import {
  RepositoryService,
  WorkAuthorRoleTypeWhereInput,
} from '@libs/base/database'
import { IdDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  RoleTypeCreateRequestDto,
  RoleTypeFilterDto,
  RoleTypeUpdateRequestDto,
} from './dto/role-type.dto'

/**
 * 作者角色类型服务类
 * 提供角色类型的查询等业务逻辑
 */
@Injectable()
export class WorkAuthorRoleTypeService extends RepositoryService {
  get workAuthorRoleType() {
    return this.prisma.workAuthorRoleType
  }

  get workAuthor() {
    return this.prisma.workAuthor
  }

  /**
   * 查询角色类型列表
   * @param filterDto 查询参数
   * @returns 角色类型列表
   */
  async getRoleTypeList(filterDto: RoleTypeFilterDto) {
    const where: WorkAuthorRoleTypeWhereInput = {}
    if (filterDto.name) {
      where.name = {
        contains: filterDto.name,
        mode: 'insensitive',
      }
    }

    if (filterDto.code) {
      where.code = {
        contains: filterDto.code,
        mode: 'insensitive',
      }
    }

    if (filterDto.isEnabled !== undefined) {
      where.isEnabled = filterDto.isEnabled
    }

    return this.workAuthorRoleType.findMany({
      where,
      orderBy: {
        id: 'asc',
      },
    })
  }

  /**
   * 创建作者角色类型
   * @returns 角色类型列表
   */
  async createRoleType(dto: RoleTypeCreateRequestDto) {
    // 查询是否存在相同的角色类型
    const existingRoleType = await this.workAuthorRoleType.findFirst({
      where: {
        OR: [{ code: dto.code }, { name: dto.name }],
      },
    })
    if (existingRoleType) {
      throw new BadRequestException('角色类型已存在')
    }
    // 创建角色类型
    return this.workAuthorRoleType.create({
      data: dto,
    })
  }

  /**
   * 更新角色类型
   * @param dto 更新角色类型的数据
   * @returns 更新后的角色类型信息
   */
  async updateRoleType(dto: RoleTypeUpdateRequestDto) {
    // 查询是否存在相同的角色类型
    const existing = await this.workAuthorRoleType.findFirst({
      where: {
        OR: [{ code: dto.code }, { name: dto.name }],
        NOT: { id: dto.id },
      },
      select: { id: true, code: true, name: true },
    })
    if (existing?.code === dto.code) {
      throw new BadRequestException('角色类型代码已存在')
    }

    if (existing?.name === dto.name) {
      throw new BadRequestException('角色类型名称已存在')
    }
    // 更新角色类型
    return this.workAuthorRoleType.update({
      where: { id: dto.id },
      data: dto,
    })
  }

  /**
   * 删除角色类型
   * @param dto 角色类型ID
   */
  async deleteRoleType(dto: IdDto) {
    // 查询是否有关联的作者
    const associatedAuthors = await this.workAuthor.findFirst({
      where: {
        authorRoles: {
          some: {
            roleTypeId: dto.id,
          },
        },
      },
    })
    if (associatedAuthors) {
      throw new BadRequestException('角色类型已被关联，无法删除')
    }
    // 删除角色类型
    return this.workAuthorRoleType.delete({
      where: { id: dto.id },
    })
  }
}
