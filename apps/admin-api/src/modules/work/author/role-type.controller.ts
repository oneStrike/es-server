import { ApiDoc } from '@libs/base/decorators'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RoleTypeListResponseDto } from './dto/role-type.dto'
import { WorkAuthorRoleTypeService } from './role-type.service'

/**
 * 作者角色类型管理控制器
 * 提供角色类型相关的API接口
 */
@ApiTags('作者角色类型管理模块')
@Controller('admin/work/author/role-type')
export class WorkAuthorRoleTypeController {
  constructor(private readonly roleTypeService: WorkAuthorRoleTypeService) {}

  /**
   * 获取所有启用的角色类型列表
   */
  @Get('/list')
  @ApiDoc({
    summary: '获取角色类型列表',
    model: RoleTypeListResponseDto,
    isArray: true,
  })
  async getList() {
    return this.roleTypeService.getRoleTypeList()
  }
}
