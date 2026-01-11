import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AssignModeratorSectionDto,
  CreateModeratorDto,
  ModeratorDto,
  ModeratorService,
  QueryModeratorActionLogDto,
  QueryModeratorDto,
  UpdateModeratorDto,
} from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/moderators')
@ApiTags('论坛模块/版主管理')
export class ModeratorController {
  constructor(private readonly moderatorService: ModeratorService) {}

  @Get('list')
  @ApiPageDoc({
    summary: '查看版主列表',
    model: ModeratorDto,
  })
  async getModeratorList(@Query() query: QueryModeratorDto) {
    return this.moderatorService.getModeratorPage(query)
  }

  @Post('add')
  @ApiDoc({
    summary: '添加版主',
    model: ModeratorDto,
  })
  async addModerator(@Body() dto: CreateModeratorDto) {
    return this.moderatorService.createModerator(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新版主信息',
    model: ModeratorDto,
  })
  async updateModerator(@Body() dto: UpdateModeratorDto) {
    return this.moderatorService.updateModerator(dto)
  }

  @Post('remove')
  @ApiDoc({
    summary: '移除版主',
    model: ModeratorDto,
  })
  async removeModerator(@Body() dto: IdDto) {
    return this.moderatorService.removeModerator(dto)
  }

  @Post('section-assign')
  @ApiDoc({
    summary: '分配版主管理的板块',
    model: ModeratorDto,
  })
  async assignModeratorSection(@Body() dto: AssignModeratorSectionDto) {
    await this.moderatorService.assignModeratorSection(dto)
    return true
  }

  @Get('action-log-page')
  @ApiPageDoc({
    summary: '查看版主操作日志',
    model: ModeratorDto,
  })
  async getModeratorActionLog(@Query() query: QueryModeratorActionLogDto) {
    return this.moderatorService.getModeratorActionLogPage(query)
  }
}
