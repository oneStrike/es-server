import { Injectable } from '@nestjs/common'
import { RepositoryService } from '@/common/services/repository.service'

/**
 * 作者角色类型服务类
 * 提供角色类型的查询等业务逻辑
 */
@Injectable()
export class WorkAuthorRoleTypeService extends RepositoryService {
  /**
   * 获取所有启用的角色类型列表
   * @returns 角色类型列表
   */
  async getRoleTypeList() {
    return this.prisma.workAuthorRoleType.findMany({
      where: {
        isEnabled: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        sortOrder: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }
}
