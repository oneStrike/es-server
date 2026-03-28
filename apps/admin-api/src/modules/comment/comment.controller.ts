import { CommentService } from '@libs/interaction/comment'
import { AuditRoleEnum } from '@libs/platform/constant'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'
import {
  AdminCommentDetailDto,
  AdminCommentPageItemDto,
  QueryAdminCommentPageDto,
  UpdateAdminCommentAuditStatusDto,
  UpdateAdminCommentHiddenDto,
} from './dto/comment.dto'

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
  @ApiDoc({
    summary: '更新评论审核状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新评论审核状态',
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
  @ApiDoc({
    summary: '更新评论隐藏状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新评论隐藏状态',
  })
  async updateHidden(@Body() body: UpdateAdminCommentHiddenDto) {
    return this.commentService.updateCommentHidden(body)
  }
}
