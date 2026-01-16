import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from './dto/moderator.dto'
import { ForumModeratorService } from './moderator.service'

/**
 * 论坛版主管理控制器
 * 提供论坛版主相关的API接口
 */
@ApiTags('论坛管理/版主管理模块')
@Controller('forum/moderator')
export class ModeratorController {
  constructor(private readonly moderatorService: ForumModeratorService) {}

  /**
   * 添加版主
   * @param createDto - 创建版主的数据传输对象
   * @returns 创建的版主信息
   */
  @Post('add')
  @ApiDoc({
    summary: '添加版主',
  })
  async addModerator(@Body() createDto: CreateModeratorDto) {
    return this.moderatorService.createModerator(createDto)
  }

  /**
   * 移除版主
   * @param removeDto - 包含版主ID的对象
   * @returns 操作结果
   */
  @Post('remove')
  @ApiDoc({
    summary: '移除版主',
    model: IdDto,
  })
  async removeModerator(@Body() removeDto: IdDto) {
    return this.moderatorService.removeModerator(removeDto)
  }

  /**
   * 分配版主管理的板块
   * @param assignDto - 分配板块的数据传输对象
   * @returns 操作成功返回true
   */
  @Post('section/assign')
  @ApiDoc({
    summary: '分配版主管理的板块',
  })
  async assignModeratorSection(@Body() assignDto: AssignModeratorSectionDto) {
    await this.moderatorService.assignModeratorSection(assignDto)
    return true
  }

  /**
   * 查看版主列表
   * @param queryDto - 查询参数
   * @returns 分页的版主列表
   */
  @Get('list')
  @ApiPageDoc({
    summary: '查看版主列表',
  })
  async getModeratorList(@Query() queryDto: QueryForumModeratorDto) {
    return this.moderatorService.getModeratorPage(queryDto)
  }

  /**
   * 更新版主信息
   * @param updateDto - 更新版主信息的数据传输对象
   * @returns 更新后的版主信息
   */
  @Post('update')
  @ApiDoc({
    summary: '更新版主信息',
  })
  async updateModerator(@Body() updateDto: UpdateModeratorDto) {
    return this.moderatorService.updateModerator(updateDto)
  }
}
