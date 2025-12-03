import { RepositoryService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  RoleTypeCreateRequestDto,
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
}
