import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  CommentInteractionService,
  CommentService,
  HandleCommentReportDto,
  QueryCommentPageDto,
  QueryCommentReportDto,
  RecalcCommentCountDto,
  UpdateCommentAuditDto,
  UpdateCommentHiddenDto,
} from '@libs/interaction'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { ActionTypeEnum } from '../../system/audit/audit.constant'

@ApiTags('内容管理/评论模块')
@Controller('admin/content/comment')
export class ContentCommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly commentInteractionService: CommentInteractionService,
  ) {}

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询评论',
    model: IdDto,
  })
  async getPage(@Query() query: QueryCommentPageDto) {
    return this.commentService.getCommentManagePage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取评论详情',
    model: IdDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.commentService.getCommentDetail(query.id)
  }

  @Post('/update-audit')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '更新评论审核状态' })
  @ApiDoc({
    summary: '更新评论审核状态',
    model: IdDto,
  })
  async updateAudit(
    @Body() body: UpdateCommentAuditDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.commentService.updateCommentAudit(body, user.sub)
  }

  @Post('/update-hidden')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '更新评论隐藏状态' })
  @ApiDoc({
    summary: '更新评论隐藏状态',
    model: IdDto,
  })
  async updateHidden(@Body() body: UpdateCommentHiddenDto) {
    return this.commentService.updateCommentHidden(body)
  }

  @Post('/delete')
  @Audit({ actionType: ActionTypeEnum.DELETE, content: '删除评论' })
  @ApiDoc({
    summary: '删除评论',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.commentService.deleteCommentByAdmin(body.id)
  }

  @Post('/recalc-count')
  @ApiDoc({
    summary: '重算评论数',
    model: RecalcCommentCountDto,
  })
  async recalcCount(@Body() body: RecalcCommentCountDto) {
    return this.commentService.recalcCommentCount(body.targetType, body.targetId)
  }

  @Get('/report/page')
  @ApiPageDoc({
    summary: '分页查询评论举报',
    model: IdDto,
  })
  async getReportPage(@Query() query: QueryCommentReportDto) {
    return this.commentInteractionService.getReports(
      query.status,
      query.pageIndex,
      query.pageSize,
    )
  }

  @Post('/report/handle')
  @ApiDoc({
    summary: '处理评论举报',
    model: IdDto,
  })
  async handleReport(
    @Body() body: HandleCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.commentInteractionService.handleReport(
      body.reportId,
      user.sub,
      body.status,
      body.handlingNote,
    )
  }
}
