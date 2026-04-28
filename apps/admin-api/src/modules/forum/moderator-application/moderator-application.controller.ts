import { AuditForumModeratorApplicationDto, ForumModeratorApplicationDto, QueryForumModeratorApplicationDto } from '@libs/forum/moderator/dto/moderator-application.dto';
import { ForumModeratorApplicationService } from '@libs/forum/moderator/moderator-application.service';
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators';

import { IdDto } from '@libs/platform/dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('论坛管理/版主申请')
@Controller('admin/forum/moderator-application')
export class ForumModeratorApplicationController {
  constructor(
    private readonly forumModeratorApplicationService: ForumModeratorApplicationService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询版主申请',
    model: ForumModeratorApplicationDto,
  })
  async getPage(@Query() query: QueryForumModeratorApplicationDto) {
    return this.forumModeratorApplicationService.getApplicationPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取版主申请详情',
    model: ForumModeratorApplicationDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumModeratorApplicationService.getApplicationDetail(query.id)
  }

  @Post('audit')
  @ApiAuditDoc({
    summary: '审核版主申请',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async audit(
    @Body() body: AuditForumModeratorApplicationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorApplicationService.auditApplication(userId, body)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除版主申请',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.forumModeratorApplicationService.deleteApplication(body.id)
  }
}
