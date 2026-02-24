import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  HandleWorkCommentReportDto,
  QueryWorkCommentDto,
  QueryWorkCommentReportDto,
  UpdateWorkCommentAuditDto,
  UpdateWorkCommentHiddenDto,
  WorkCommentService,
} from '@libs/content/work/comment'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { ActionTypeEnum } from '../../system/audit/audit.constant'

@ApiTags('内容管理/小说章节评论模块')
@Controller('admin/work/novel-chapter-comment')
export class NovelChapterCommentController {
  constructor(private readonly workCommentService: WorkCommentService) {}

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询章节评论',
    model: IdDto,
  })
  async getPage(@Query() query: QueryWorkCommentDto) {
    return this.workCommentService.getCommentManagePage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取章节评论详情',
    model: IdDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workCommentService.getCommentDetail(query.id)
  }

  @Post('/update-audit')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '更新章节评论审核状态' })
  @ApiDoc({
    summary: '更新章节评论审核状态',
    model: IdDto,
  })
  async updateAudit(
    @Body() body: UpdateWorkCommentAuditDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workCommentService.updateCommentAudit(body, user.sub)
  }

  @Post('/audit')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '审核章节评论' })
  @ApiDoc({
    summary: '审核章节评论',
    model: IdDto,
  })
  async audit(
    @Body() body: UpdateWorkCommentAuditDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workCommentService.updateCommentAudit(body, user.sub)
  }

  @Post('/update-hidden')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '更新章节评论隐藏状态' })
  @ApiDoc({
    summary: '更新章节评论隐藏状态',
    model: IdDto,
  })
  async updateHidden(@Body() body: UpdateWorkCommentHiddenDto) {
    return this.workCommentService.updateCommentHidden(body)
  }

  @Post('/hide')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '隐藏章节评论' })
  @ApiDoc({
    summary: '隐藏章节评论',
    model: IdDto,
  })
  async hide(@Body() body: UpdateWorkCommentHiddenDto) {
    return this.workCommentService.updateCommentHidden(body)
  }

  @Post('/delete')
  @Audit({ actionType: ActionTypeEnum.DELETE, content: '删除章节评论' })
  @ApiDoc({
    summary: '删除章节评论',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.workCommentService.deleteCommentByAdmin(body.id)
  }

  @Post('/recalc-count')
  @ApiDoc({
    summary: '重算章节评论数',
    model: IdDto,
  })
  async recalcCount(@Body() body: IdDto) {
    return this.workCommentService.recalcCommentCount(body.id)
  }

  @Get('/report/page')
  @ApiPageDoc({
    summary: '分页查询章节评论举报',
    model: IdDto,
  })
  async getReportPage(@Query() query: QueryWorkCommentReportDto) {
    return this.workCommentService.getCommentReportPage(query)
  }

  @Post('/report/handle')
  @ApiDoc({
    summary: '处理章节评论举报',
    model: IdDto,
  })
  async handleReport(
    @Body() body: HandleWorkCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workCommentService.handleCommentReport(body, user.sub)
  }

  @Post('/report')
  @ApiDoc({
    summary: '处理章节评论举报',
    model: IdDto,
  })
  async report(
    @Body() body: HandleWorkCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workCommentService.handleCommentReport(body, user.sub)
  }
}
