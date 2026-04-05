import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  ForumModeratorDto,
  ForumModeratorService,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from '@libs/forum/moderator'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

@Controller('admin/forum/moderators')
@ApiTags('论坛管理/版主管理')
export class ModeratorController {
  constructor(private readonly forumModeratorService: ForumModeratorService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '查看版主列表',
    model: ForumModeratorDto,
  })
  async getModeratorList(@Query() query: QueryForumModeratorDto) {
    return this.forumModeratorService.getModeratorPage(query)
  }

  @Post('create')
  @ApiDoc({
    summary: '添加版主',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '添加版主',
  })
  async createModerator(@Body() dto: CreateForumModeratorDto) {
    return this.forumModeratorService.createModerator(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新版主信息',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新版主信息',
  })
  async updateModerator(@Body() dto: UpdateForumModeratorDto) {
    return this.forumModeratorService.updateModerator(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '移除版主',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '移除版主',
  })
  async deleteModerator(@Body() dto: IdDto) {
    return this.forumModeratorService.removeModerator(dto.id)
  }

  @Post('assign-section')
  @ApiDoc({
    summary: '分配版主管理的板块',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '分配版主管理的板块',
  })
  async assignModeratorSection(@Body() dto: AssignForumModeratorSectionDto) {
    return this.forumModeratorService.assignModeratorSection(dto)
  }
}
