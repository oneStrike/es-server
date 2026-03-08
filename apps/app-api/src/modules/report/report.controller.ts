import { ReportTargetTypeEnum } from '@libs/base/constant'
import { ApiDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  ReportChapterBodyDto,
  ReportCommentBodyDto,
  ReportForumReplyBodyDto,
  ReportForumTopicBodyDto,
  ReportService,
  ReportUserBodyDto,
  ReportWorkBodyDto,
} from '@libs/interaction'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('举报模块')
@Controller('app/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // ============ 作品场景 ============

  @Post('work')
  @ApiDoc({
    summary: '举报作品',
    model: IdDto,
  })
  async reportWork(
    @Body() body: ReportWorkBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.createWorkReport({
      ...body,
      reporterId: userId,
      targetType: ReportTargetTypeEnum.WORK,
    })
  }

  @Post('chapter')
  @ApiDoc({
    summary: '举报章节',
    model: IdDto,
  })
  async reportChapter(
    @Body() body: ReportChapterBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.createWorkReport({
      ...body,
      reporterId: userId,
      targetType: ReportTargetTypeEnum.WORK_CHAPTER,
    })
  }

  // ============ 评论场景 ============

  @Post('comment')
  @ApiDoc({
    summary: '举报评论',
    model: IdDto,
  })
  async reportComment(
    @Body() body: ReportCommentBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.createReport({
      ...body,
      targetId: body.commentId,
      reporterId: userId,
      targetType: ReportTargetTypeEnum.COMMENT,
    })
  }

  // ============ 用户场景 ============

  @Post('user')
  @ApiDoc({
    summary: '举报用户',
    model: IdDto,
  })
  async reportUser(
    @Body() body: ReportUserBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.createForumReport({
      ...body,
      reporterId: userId,
      targetType: ReportTargetTypeEnum.USER,
    })
  }

  // ============ 论坛场景 ============

  @Post('topic')
  @ApiDoc({
    summary: '举报论坛主题',
    model: IdDto,
  })
  async reportTopic(
    @Body() body: ReportForumTopicBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.createForumReport({
      ...body,
      reporterId: userId,
      targetType: ReportTargetTypeEnum.FORUM_TOPIC,
    })
  }

  @Post('reply')
  @ApiDoc({
    summary: '举报论坛回复',
    model: IdDto,
  })
  async reportReply(
    @Body() body: ReportForumReplyBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.createForumReport({
      ...body,
      reporterId: userId,
      targetType: ReportTargetTypeEnum.FORUM_REPLY,
    })
  }
}
