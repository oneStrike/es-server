import { CommentService } from '@libs/interaction/comment/comment.service';
import { AdminCommentDetailDto, AdminCommentPageItemDto, QueryAdminCommentPageDto, UpdateAdminCommentAuditStatusDto, UpdateAdminCommentHiddenDto } from '@libs/interaction/comment/dto/comment.dto';
import { AuditRoleEnum } from '@libs/platform/constant/audit.constant';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditActionTypeEnum } from '../../common/audit/audit-action.constant'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('内容治理/评论处理')
@Controller('admin/comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

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
    @Body() body: UpdateAdminCommentAuditStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.updateCommentAuditStatus({
      ...body,
      auditById: userId,
      auditRole: AuditRoleEnum.ADMIN,
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
  async updateHidden(@Body() body: UpdateAdminCommentHiddenDto) {
    return this.commentService.updateCommentHidden(body)
  }
}
