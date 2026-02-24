import type { JwtUserInfoInterface } from '@libs/base/types'
import { WorkTypeEnum } from '@libs/base/constant'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  CreateWorkCommentDto,
  CreateWorkCommentReportDto,
  QueryWorkCommentDto,
  QueryWorkCommentReportDto,
  WorkCommentService,
} from '@libs/content/work/comment'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('漫画模块/章节评论')
@Controller('app/comic')
export class ComicChapterCommentController {
  constructor(private readonly workCommentService: WorkCommentService) {}

  @Post('chapter/comment/create')
  @ApiDoc({
    summary: '创建章节评论',
    model: IdDto,
  })
  async createChapterComment(
    @Body() body: CreateWorkCommentDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workCommentService.createComment(
      { ...body, workType: WorkTypeEnum.COMIC },
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
    return this.workCommentService.deleteComment(body.id, user.sub)
  }

  @Get('chapter/comment/page')
  @ApiPageDoc({
    summary: '分页查询章节评论',
    model: IdDto,
  })
  async getChapterCommentPage(@Query() query: QueryWorkCommentDto) {
    return this.workCommentService.getCommentPage(query)
  }

  @Get('chapter/comment/detail')
  @ApiDoc({
    summary: '获取章节评论详情',
    model: IdDto,
  })
  async getChapterCommentDetail(@Query() query: IdDto) {
    return this.workCommentService.getCommentDetail(query.id)
  }

  @Post('chapter/comment/report')
  @ApiDoc({
    summary: '举报章节评论',
    model: IdDto,
  })
  async reportChapterComment(
    @Body() body: CreateWorkCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workCommentService.createCommentReport(body, user.sub)
  }

  @Get('chapter/comment/report/page')
  @ApiPageDoc({
    summary: '分页查询我的章节评论举报',
    model: IdDto,
  })
  async getChapterCommentReportPage(
    @Query() query: QueryWorkCommentReportDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workCommentService.getCommentReportPage({
      ...query,
      reporterId: user.sub,
    })
  }
}
