import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  CommentInteractionService,
  CommentService,
  CreateCommentBodyDto,
  QueryCommentPageDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentBodyDto,
  ReportCommentBodyDto,
} from '@libs/interaction'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('评论模块')
@Controller('app/comment')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly commentInteractionService: CommentInteractionService,
  ) {}

  @Post('post')
  @ApiDoc({
    summary: '发表评论',
    model: IdDto,
  })
  async postComment(
    @Body() body: CreateCommentBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.createComment({
      ...body,
      userId,
    })
  }

  @Post('reply')
  @ApiDoc({
    summary: '回复评论',
    model: IdDto,
  })
  async replyComment(
    @Body() body: ReplyCommentBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.replyComment({
      ...body,
      userId,
    })
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除我的评论',
    model: IdDto,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.commentService.deleteComment(body.id, userId)
  }

  @Get('my')
  @ApiPageDoc({
    summary: '分页查询我的评论',
    model: QueryCommentPageDto,
  })
  async page(
    @Query() query: QueryMyCommentPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.getUserComments(query, userId)
  }

  @Get('replies')
  @ApiPageDoc({
    summary: '分页查询评论回复',
    model: QueryCommentRepliesDto,
  })
  async replies(@Query() query: QueryCommentRepliesDto) {
    return this.commentService.getReplies(query)
  }

  @Post('like')
  @ApiDoc({
    summary: '点赞评论',
    model: IdDto,
  })
  async likeComment(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.commentInteractionService.likeComment(body.id, userId)
  }

  @Post('unlike')
  @ApiDoc({
    summary: '取消点赞评论',
    model: IdDto,
  })
  async unlikeComment(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.commentInteractionService.unlikeComment(body.id, userId)
  }

  @Post('report')
  @ApiDoc({
    summary: '举报评论',
  })
  async reportComment(
    @Body() body: ReportCommentBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentInteractionService.reportComment({
      ...body,
      reporterId: userId,
    })
  }
}
