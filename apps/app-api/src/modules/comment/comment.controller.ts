import type { FastifyRequest } from 'fastify'
import { CommentService } from '@libs/interaction/comment/comment.service'
import {
  CommentReplyItemDto,
  CreateCommentBodyDto,
  MyCommentPageItemDto,
  QueryCommentRepliesDto,
  QueryMyCommentPageDto,
  ReplyCommentBodyDto,
} from '@libs/interaction/comment/dto/comment.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { GeoService } from '@libs/platform/modules/geo/geo.service'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('评论')
@Controller('app/comment')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly geoService: GeoService,
  ) {}

  @Post('post')
  @ApiDoc({
    summary: '发表评论',
    model: IdDto,
  })
  async postComment(
    @Body() body: CreateCommentBodyDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    return this.commentService.createComment(
      {
        ...body,
        userId,
      },
      await this.geoService.buildClientRequestContext(req),
    )
  }

  @Post('reply')
  @ApiDoc({
    summary: '回复评论',
    model: IdDto,
  })
  async replyComment(
    @Body() body: ReplyCommentBodyDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    return this.commentService.replyComment(
      {
        ...body,
        userId,
      },
      await this.geoService.buildClientRequestContext(req),
    )
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
    model: MyCommentPageItemDto,
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
