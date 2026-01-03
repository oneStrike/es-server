import { ApiDoc } from '@libs/base/decorators'
import { ApiPageDoc } from '@libs/base/decorators/api-page-doc.decorator'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ModeratorService } from './moderator.service'
import {
  AssignModeratorSectionDto,
  CreateModeratorDto,
  ModeratorActionLogPageDto,
  ModeratorPageDto,
  QueryModeratorActionLogDto,
  QueryModeratorDto,
  RemoveModeratorDto,
  UpdateModeratorDto,
} from './dto/moderator.dto'

@Controller('forum/moderator')
export class ModeratorController {
  constructor(private readonly moderatorService: ModeratorService) {}

  /**
   * 添加版主
   */
  @Post('add')
  @ApiDoc({
    summary: '添加版主',
    description: '添加新的版主',
    response: 'ModeratorDto',
  })
  async addModerator(@Body() createDto: CreateModeratorDto) {
    return this.moderatorService.createModerator(createDto)
  }

  /**
   * 移除版主
   */
  @Post('remove')
  @ApiDoc({
    summary: '移除版主',
    description: '移除指定的版主',
    response: 'Boolean',
  })
  async removeModerator(@Body() removeDto: RemoveModeratorDto) {
    await this.moderatorService.removeModerator(removeDto)
    return true
  }

  /**
   * 分配版主管理的板块
   */
  @Post('section/assign')
  @ApiDoc({
    summary: '分配版主管理的板块',
    description: '为版主分配管理的板块',
    response: 'Boolean',
  })
  async assignModeratorSection(@Body() assignDto: AssignModeratorSectionDto) {
    await this.moderatorService.assignModeratorSection(assignDto)
    return true
  }

  /**
   * 查看版主列表
   */
  @Get('list')
  @ApiDoc({
    summary: '查看版主列表',
    description: '分页查询版主列表',
    response: 'ModeratorPageDto',
  })
  @ApiPageDoc()
  async getModeratorList(@Query() queryDto: QueryModeratorDto) {
    return this.moderatorService.getModeratorPage(queryDto)
  }

  /**
   * 更新版主信息
   */
  @Post('update')
  @ApiDoc({
    summary: '更新版主信息',
    description: '更新版主的权限、状态等信息',
    response: 'ModeratorDto',
  })
  async updateModerator(@Body() updateDto: UpdateModeratorDto) {
    return this.moderatorService.updateModerator(updateDto)
  }

  /**
   * 查看版主操作日志
   */
  @Get('action/log')
  @ApiDoc({
    summary: '查看版主操作日志',
    description: '分页查询版主操作日志',
    response: 'ModeratorActionLogPageDto',
  })
  @ApiPageDoc()
  async getModeratorActionLog(@Query() queryDto: QueryModeratorActionLogDto) {
    return this.moderatorService.getModeratorActionLogPage(queryDto)
  }
}
