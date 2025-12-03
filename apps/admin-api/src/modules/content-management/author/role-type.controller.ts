import { ApiDoc } from '@libs/base/decorators'
import { IdDto, UpdateStatusDto } from '@libs/base/dto'
import { Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  RoleTypeCreateRequestDto,
  RoleTypeListResponseDto,
  RoleTypeUpdateRequestDto,
} from './dto/role-type.dto'
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
    return this.roleTypeService.workAuthorRoleType.findMany()
  }

  /**
   * 创建角色类型
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建角色类型',
    model: IdDto,
  })
  async createRoleType(createRoleTypeDto: RoleTypeCreateRequestDto) {
    return this.roleTypeService.createRoleType(createRoleTypeDto)
  }

  /**
   * 删除作者角色类型
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除角色类型',
    model: IdDto,
  })
  async deleteRoleType(deleteRoleTypeDto: IdDto) {
    return this.roleTypeService.workAuthorRoleType.delete({
      where: { id: deleteRoleTypeDto.id },
    })
  }

  /**
   * 更新角色类型
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新角色类型',
    model: IdDto,
  })
  async updateRoleType(updateRoleTypeDto: RoleTypeUpdateRequestDto) {
    return this.roleTypeService.updateRoleType(updateRoleTypeDto)
  }

  /**
   * 调整角色类型状态
   */
  @Post('/change-status')
  @ApiDoc({
    summary: '调整角色类型状态',
    model: IdDto,
  })
  async enableRoleType(enableRoleTypeDto: UpdateStatusDto) {
    return this.roleTypeService.workAuthorRoleType.update({
      where: { id: enableRoleTypeDto.id },
      data: { isEnabled: enableRoleTypeDto.isEnabled },
    })
  }
}
