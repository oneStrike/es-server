import type { JwtUserInfoInterface } from '@libs/base/types'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseComicChapterCommentReportDto,
  ComicChapterCommentDto,
  ComicChapterCommentService,
  CreateComicChapterCommentDto,
  CreateComicChapterCommentReportDto,
  QueryComicChapterCommentDto,
  QueryComicChapterCommentReportDto,
} from '@libs/content/comic/chapter-comment'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('漫画模块/章节评论')
@Controller('app/comic')
export class ComicChapterCommentController {
  constructor(
    private readonly comicChapterCommentService: ComicChapterCommentService,
  ) {}

  @Post('chapter/comment/create')
  @ApiDoc({
    summary: '创建章节评论',
    model: ComicChapterCommentDto,
  })
  async createChapterComment(
    @Body() body: CreateComicChapterCommentDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.createComicChapterComment(
      body,
      user.sub,
    )
  }

  @Post('chapter/comment/delete')
  @ApiDoc({
    summary: '删除章节评论',
    model: IdDto,
  })
  async deleteChapterComment(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.deleteComicChapterComment(
      body.id,
      user.sub,
    )
  }

  @Get('chapter/comment/page')
  @ApiPageDoc({
    summary: '分页查询章节评论',
    model: ComicChapterCommentDto,
  })
  async getChapterCommentPage(@Query() query: QueryComicChapterCommentDto) {
    return this.comicChapterCommentService.getComicChapterCommentPage(query)
  }

  @Get('chapter/comment/detail')
  @ApiDoc({
    summary: '获取章节评论详情',
    model: ComicChapterCommentDto,
  })
  async getChapterCommentDetail(@Query() query: IdDto) {
    return this.comicChapterCommentService.getComicChapterCommentDetail(query.id)
  }

  @Post('chapter/comment/report')
  @ApiDoc({
    summary: '举报章节评论',
    model: BaseComicChapterCommentReportDto,
  })
  async reportChapterComment(
    @Body() body: CreateComicChapterCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.createComicChapterCommentReport(
      { ...body, reporterId: user.sub },
      user.sub,
    )
  }

  @Get('chapter/comment/report/page')
  @ApiPageDoc({
    summary: '分页查询我的章节评论举报',
    model: BaseComicChapterCommentReportDto,
  })
  async getChapterCommentReportPage(
    @Query() query: QueryComicChapterCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterCommentService.getComicChapterCommentReportPage({
      ...query,
      reporterId: user.sub,
    })
  }
}
