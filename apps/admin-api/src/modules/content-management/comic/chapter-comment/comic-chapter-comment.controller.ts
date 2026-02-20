import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseComicChapterCommentReportDto,
  ComicChapterCommentDto,
  ComicChapterCommentService,
  HandleComicChapterCommentReportDto,
  QueryComicChapterCommentDto,
  QueryComicChapterCommentReportDto,
  UpdateComicChapterCommentAuditDto,
  UpdateComicChapterCommentHiddenDto,
} from '@libs/content/comic/chapter-comment'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../../common/decorators/audit.decorator'
import { ActionTypeEnum } from '../../../system/audit/audit.constant'

@ApiTags('内容管理/漫画章节评论模块')
@Controller('admin/work/comic-chapter-comment')
export class ComicChapterCommentController {
  constructor(
    private readonly comicChapterCommentService: ComicChapterCommentService,
  ) {}

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询章节评论',
    model: ComicChapterCommentDto,
  })
  async getPage(@Query() query: QueryComicChapterCommentDto) {
    return this.comicChapterCommentService.getComicChapterCommentManagePage(
      query,
    )
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取章节评论详情',
    model: ComicChapterCommentDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.comicChapterCommentService.getComicChapterCommentDetail(query.id)
  }

  @Post('/update-audit')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '更新章节评论审核状态' })
  @ApiDoc({
    summary: '更新章节评论审核状态',
    model: IdDto,
  })
  async updateAudit(
    @Body() body: UpdateComicChapterCommentAuditDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.updateComicChapterCommentAudit(
      body,
      user.sub,
    )
  }

  @Post('/audit')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '审核章节评论' })
  @ApiDoc({
    summary: '审核章节评论',
    model: IdDto,
  })
  async audit(
    @Body() body: UpdateComicChapterCommentAuditDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.updateComicChapterCommentAudit(
      body,
      user.sub,
    )
  }

  @Post('/update-hidden')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '更新章节评论隐藏状态' })
  @ApiDoc({
    summary: '更新章节评论隐藏状态',
    model: IdDto,
  })
  async updateHidden(@Body() body: UpdateComicChapterCommentHiddenDto) {
    return this.comicChapterCommentService.updateComicChapterCommentHidden(body)
  }

  @Post('/hide')
  @Audit({ actionType: ActionTypeEnum.UPDATE, content: '隐藏章节评论' })
  @ApiDoc({
    summary: '隐藏章节评论',
    model: IdDto,
  })
  async hide(@Body() body: UpdateComicChapterCommentHiddenDto) {
    return this.comicChapterCommentService.updateComicChapterCommentHidden(body)
  }

  @Post('/delete')
  @Audit({ actionType: ActionTypeEnum.DELETE, content: '删除章节评论' })
  @ApiDoc({
    summary: '删除章节评论',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.comicChapterCommentService.deleteComicChapterCommentByAdmin(
      body.id,
    )
  }

  @Post('/recalc-count')
  @ApiDoc({
    summary: '重算章节评论数',
    model: IdDto,
  })
  async recalcCount(@Body() body: IdDto) {
    return this.comicChapterCommentService.recalcChapterCommentCount(body.id)
  }

  @Post('/recalc-count-by-comic')
  @ApiDoc({
    summary: '按漫画重算章节评论数',
    model: IdDto,
  })
  async recalcCountByComic(@Body() body: IdDto) {
    return this.comicChapterCommentService.recalcComicCommentCount(body.id)
  }

  @Get('/report/page')
  @ApiPageDoc({
    summary: '分页查询章节评论举报',
    model: BaseComicChapterCommentReportDto,
  })
  async getReportPage(@Query() query: QueryComicChapterCommentReportDto) {
    return this.comicChapterCommentService.getComicChapterCommentReportPage(
      query,
    )
  }

  @Post('/report/handle')
  @ApiDoc({
    summary: '处理章节评论举报',
    model: IdDto,
  })
  async handleReport(
    @Body() body: HandleComicChapterCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.handleComicChapterCommentReport(
      body,
      user.sub,
    )
  }

  @Post('/report')
  @ApiDoc({
    summary: '处理章节评论举报',
    model: IdDto,
  })
  async report(
    @Body() body: HandleComicChapterCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.handleComicChapterCommentReport(
      body,
      user.sub,
    )
  }
}
