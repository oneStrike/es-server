import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import {
  CommentLikeService,
  CommentReportService,
  CommentService,
  CreateCommentDto,
  DeleteCommentDto,
  QueryCommentPageDto,
  QueryCommentRepliesDto,
  ReportCommentDto,
} from '@libs/interaction'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品模块/评论')
@Controller('app/work/comment')
export class WorkCommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly commentLikeService: CommentLikeService,
    private readonly commentReportService: CommentReportService,
  ) {}

  @Post('create')
  @ApiDoc({
    summary: '发表评论',
    model: CreateCommentDto,
  })
  async create(
    @Body() body: CreateCommentDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.createComment(
      body.targetType,
      body.targetId,
      userId,
      body.content,
      body.replyToId,
    )
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除评论',
    model: DeleteCommentDto,
  })
  async delete(
    @Body() body: DeleteCommentDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.deleteComment(body.commentId, userId)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询评论',
    model: QueryCommentPageDto,
  })
  async page(@Query() query: QueryCommentPageDto) {
    return this.commentService.getComments(
      query.targetType!,
      query.targetId!,
      query.pageIndex,
      query.pageSize,
    )
  }

  @Get('replies')
  @ApiPageDoc({
    summary: '分页查询评论回复',
    model: QueryCommentRepliesDto,
  })
  async replies(@Query() query: QueryCommentRepliesDto) {
    return this.commentService.getReplies(
      query.commentId,
      query.pageIndex,
      query.pageSize,
    )
  }

  @Post('like')
  @ApiDoc({
    summary: '点赞评论',
    model: DeleteCommentDto,
  })
  async like(
    @Body() body: DeleteCommentDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentLikeService.likeComment(body.commentId, userId)
  }

  @Post('unlike')
  @ApiDoc({
    summary: '取消点赞评论',
    model: DeleteCommentDto,
  })
  async unlike(
    @Body() body: DeleteCommentDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentLikeService.unlikeComment(body.commentId, userId)
  }

  @Post('report')
  @ApiDoc({
    summary: '举报评论',
    model: ReportCommentDto,
  })
  async report(
    @Body() body: ReportCommentDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentReportService.reportComment(
      body.commentId,
      userId,
      body.reason,
      body.description,
      body.evidenceUrl,
    )
  }
}
