import { CommentService } from '@libs/interaction'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  CommentItemDto,
  CreateCommentBodyDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentBodyDto,
} from './dto/comment.dto'

@ApiTags('评论模块')
@Controller('app/comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

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
    model: CommentItemDto,
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
    model: CommentItemDto,
  })
  async replies(@Query() query: QueryCommentRepliesDto) {
    return this.commentService.getReplies(query)
  }
}
