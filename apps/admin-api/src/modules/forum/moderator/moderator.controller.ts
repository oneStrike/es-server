import { AssignForumModeratorSectionDto, CreateForumModeratorDto, ForumModeratorDto, QueryForumModeratorDto, UpdateForumModeratorDto } from '@libs/forum/moderator/dto/moderator.dto';
import { ForumModeratorService } from '@libs/forum/moderator/moderator.service';
import { ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditActionTypeEnum } from '../../../common/audit/audit-action.constant'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

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
  @ApiAuditDoc({
    summary: '添加版主',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createModerator(@Body() dto: CreateForumModeratorDto) {
    return this.forumModeratorService.createModerator(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新版主信息',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateModerator(@Body() dto: UpdateForumModeratorDto) {
    return this.forumModeratorService.updateModerator(dto)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '移除版主',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteModerator(@Body() dto: IdDto) {
    return this.forumModeratorService.removeModerator(dto.id)
  }

  @Post('assign-section')
  @ApiAuditDoc({
    summary: '分配版主管理的板块',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async assignModeratorSection(@Body() dto: AssignForumModeratorSectionDto) {
    return this.forumModeratorService.assignModeratorSection(dto)
  }
}
