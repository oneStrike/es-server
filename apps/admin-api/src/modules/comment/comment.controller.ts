import { ForumModeratorGovernanceService } from '@libs/forum/moderator/moderator-governance.service'
import { CommentService } from '@libs/interaction/comment/comment.service'
import {
  AdminCommentDetailDto,
  AdminCommentPageItemDto,
  QueryAdminCommentPageDto,
  UpdateCommentAuditStatusDto,
  UpdateCommentHiddenDto,
} from '@libs/interaction/comment/dto/comment.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容治理/评论处理')
@Controller('admin/comment')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly forumModeratorGovernanceService: ForumModeratorGovernanceService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询评论记录',
    model: AdminCommentPageItemDto,
  })
  async getPage(@Query() query: QueryAdminCommentPageDto) {
    return this.commentService.getAdminCommentPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取评论详情',
    model: AdminCommentDetailDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.commentService.getAdminCommentDetail(query.id)
  }

  @Post('update-audit-status')
  @ApiAuditDoc({
    summary: '更新评论审核状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateAuditStatus(
    @Body() body: UpdateCommentAuditStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateCommentAuditStatus(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }

  @Post('update-hidden')
  @ApiAuditDoc({
    summary: '更新评论隐藏状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateHidden(
    @Body() body: UpdateCommentHiddenDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateCommentHidden(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }
}
