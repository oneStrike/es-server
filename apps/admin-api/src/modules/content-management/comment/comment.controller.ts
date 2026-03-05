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

@ApiTags('���ݹ���/����ģ��')
@Controller('admin/content/comment')
export class ContentCommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly commentInteractionService: CommentInteractionService,
  ) {}

  @Get('/page')
  @ApiPageDoc({
    summary: '��ҳ��ѯ����',
    model: IdDto,
  })
  async getPage(@Query() query: QueryCommentPageDto) {
    return this.commentService.getCommentManagePage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '��ȡ��������',
    model: IdDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.commentService.getCommentDetail(query.id)
  }

  @Post('/update-audit')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '�����������״̬' })
  @ApiDoc({
    summary: '�����������״̬',
    model: IdDto,
  })
  async updateAudit(
    @Body() body: UpdateCommentAuditDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.commentService.updateCommentAudit(body, user.sub)
  }

  @Post('/update-hidden')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '������������״̬' })
  @ApiDoc({
    summary: '������������״̬',
    model: IdDto,
  })
  async updateHidden(@Body() body: UpdateCommentHiddenDto) {
    return this.commentService.updateCommentHidden(body)
  }

  @Post('/delete')
  @Audit({ actionType: ActionTypeEnum.DELETE, content: 'ɾ������' })
  @ApiDoc({
    summary: 'ɾ������',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.commentService.deleteComment(body.id)
  }

  @Post('/recalc-count')
  @ApiDoc({
    summary: '����������',
    model: RecalcCommentCountDto,
  })
  async recalcCount(@Body() body: RecalcCommentCountDto) {
    return this.commentService.recalcCommentCount(body.targetType, body.targetId)
  }

  @Get('/report/page')
  @ApiPageDoc({
    summary: '��ҳ��ѯ���۾ٱ�',
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
    summary: '�������۾ٱ�',
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
