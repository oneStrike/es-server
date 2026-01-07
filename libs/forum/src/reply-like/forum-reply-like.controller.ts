import { ApiDoc } from '@libs/base/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  CreateForumReplyLikeDto,
  DeleteForumReplyLikeDto,
} from './dto/forum-reply-like.dto'
import { ForumReplyLikeService } from './forum-reply-like.service'

@ApiTags('论坛管理/回复点赞模块')
@Controller('admin/forum/reply-like')
export class ForumReplyLikeController {
  constructor(
    private readonly forumReplyLikeService: ForumReplyLikeService,
  ) {}

  @Post('/like')
  @ApiDoc({
    summary: '点赞回复',
    model: CreateForumReplyLikeDto,
  })
  async like(@Body() body: CreateForumReplyLikeDto) {
    return this.forumReplyLikeService.likeReply(body)
  }

  @Post('/unlike')
  @ApiDoc({
    summary: '取消点赞回复',
    model: DeleteForumReplyLikeDto,
  })
  async unlike(@Body() body: DeleteForumReplyLikeDto) {
    return this.forumReplyLikeService.unlikeReply(body)
  }

  @Get('/check-liked')
  @ApiDoc({
    summary: '检查用户是否已点赞',
    model: { liked: true },
  })
  async checkLiked(@Query('replyId') replyId: number, @Query('userId') userId: number) {
    return this.forumReplyLikeService.checkUserLiked(replyId, userId)
  }
}
