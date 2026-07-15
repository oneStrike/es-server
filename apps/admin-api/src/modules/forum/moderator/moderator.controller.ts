import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  ForumModeratorDto,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from '@libs/forum/moderator/dto/moderator.dto'
import { ForumModeratorService } from '@libs/forum/moderator/moderator.service'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@Controller('admin/forum/moderators')
@ApiTags('论坛管理/版主管理')
export class ModeratorController {
  constructor(private readonly forumModeratorService: ForumModeratorService) {}

  @Get('page')
  @AdminPermission({
    code: 'forum:moderators:page',
    name: '查看版主列表',
    groupCode: 'forum:moderators',
  })
  @ApiPageDoc({
    summary: '查看版主列表',
    model: ForumModeratorDto,
  })
  async getModeratorList(@Query() query: QueryForumModeratorDto) {
    return this.forumModeratorService.getModeratorPage(query)
  }

  @Get('detail')
  @AdminPermission({
    code: 'forum:moderators:detail',
    name: '查看版主详情',
    groupCode: 'forum:moderators',
  })
  @ApiDoc({
    summary: '查看版主详情',
    model: ForumModeratorDto,
  })
  async getModeratorDetail(@Query() query: IdDto) {
    return this.forumModeratorService.getModeratorDetail(query.id)
  }

  @Post('create')
  @AdminPermission({
    code: 'forum:moderators:create',
    name: '添加版主',
    groupCode: 'forum:moderators',
  })
  @ApiAuditDoc({
    summary: '添加版主',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createModerator(
    @Body() dto: CreateForumModeratorDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.forumModeratorService.createModerator(dto, adminUserId)
  }

  @Post('update')
  @AdminPermission({
    code: 'forum:moderators:update',
    name: '更新版主信息',
    groupCode: 'forum:moderators',
  })
  @ApiAuditDoc({
    summary: '更新版主信息',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateModerator(
    @Body() dto: UpdateForumModeratorDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.forumModeratorService.updateModerator(dto, adminUserId)
  }

  @Post('delete')
  @AdminPermission({
    code: 'forum:moderators:delete',
    name: '移除版主',
    groupCode: 'forum:moderators',
  })
  @ApiAuditDoc({
    summary: '移除版主',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteModerator(
    @Body() dto: IdDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.forumModeratorService.removeModerator(dto.id, adminUserId)
  }

  @Post('assign-section')
  @AdminPermission({
    code: 'forum:moderators:assign:section',
    name: '分配版主管理的板块',
    groupCode: 'forum:moderators',
  })
  @ApiAuditDoc({
    summary: '分配版主管理的板块',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async assignModeratorSection(
    @Body() dto: AssignForumModeratorSectionDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.forumModeratorService.assignModeratorSection(dto, adminUserId)
  }
}
