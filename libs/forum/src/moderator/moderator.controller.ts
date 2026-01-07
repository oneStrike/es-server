import { ApiDoc, ApiPageDoc} from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import {
  AssignModeratorSectionDto,
  CreateModeratorDto,
  QueryModeratorActionLogDto,
  QueryModeratorDto,
  UpdateModeratorDto,
} from './dto/moderator.dto'
import { ModeratorService } from './moderator.service'

@Controller('forum/moderator')
export class ModeratorController {
  constructor(private readonly moderatorService: ModeratorService) {}

  /**
   * 添加版主
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
   */
  @Get('list')
  @ApiPageDoc({
    summary: '查看版主列表',
  })
  async getModeratorList(@Query() queryDto: QueryModeratorDto) {
    return this.moderatorService.getModeratorPage(queryDto)
  }

  /**
   * 更新版主信息
   */
  @Post('update')
  @ApiDoc({
    summary: '更新版主信息',
  })
  async updateModerator(@Body() updateDto: UpdateModeratorDto) {
    return this.moderatorService.updateModerator(updateDto)
  }

  /**
   * 查看版主操作日志
   */
  @Get('action/log')
  @ApiPageDoc({
    summary: '查看版主操作日志',
  })
  async getModeratorActionLog(@Query() queryDto: QueryModeratorActionLogDto) {
    return this.moderatorService.getModeratorActionLogPage(queryDto)
  }
}
