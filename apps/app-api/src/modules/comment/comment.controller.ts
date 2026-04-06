import { CommentService } from '@libs/interaction/comment/comment.service';
import { BaseCommentDto, CommentReplyItemDto, CreateCommentBodyDto, QueryCommentRepliesDto, QueryMyCommentPageDto, ReplyCommentBodyDto } from '@libs/interaction/comment/dto/comment.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('评论')
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
    model: Boolean,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.commentService.deleteComment(body.id, userId)
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的评论',
    model: BaseCommentDto,
  })
  async page(
    @Query() query: QueryMyCommentPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.getUserComments(query, userId)
  }

  @Get('reply/page')
  @ApiPageDoc({
    summary: '分页查询评论回复',
    model: CommentReplyItemDto,
  })
  async replies(
    @Query() query: QueryCommentRepliesDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.commentService.getReplies({ ...query, userId })
  }
}
