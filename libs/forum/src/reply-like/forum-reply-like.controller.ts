import { ApiDoc } from '@libs/base/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  CreateForumReplyLikeDto,
  DeleteForumReplyLikeDto,
} from './dto/forum-reply-like.dto'
import { ForumReplyLikeService } from './forum-reply-like.service'

/**
 * 论坛回复点赞管理控制器
 * 提供论坛回复点赞相关的API接口
 */
@ApiTags('论坛管理/回复点赞模块')
@Controller('admin/forum/reply-like')
export class ForumReplyLikeController {
  constructor(
    private readonly forumReplyLikeService: ForumReplyLikeService,
  ) {}

  /**
   * 点赞回复
   * @param body - 创建点赞记录的数据传输对象
   * @returns 创建的点赞记录
   */
  @Post('/like')
  @ApiDoc({
    summary: '点赞回复',
    model: CreateForumReplyLikeDto,
  })
  async like(@Body() body: CreateForumReplyLikeDto) {
    return this.forumReplyLikeService.likeReply(body)
  }

  /**
   * 取消点赞回复
   * @param body - 删除点赞记录的数据传输对象
   * @returns 被删除的点赞记录
   */
  @Post('/unlike')
  @ApiDoc({
    summary: '取消点赞回复',
    model: DeleteForumReplyLikeDto,
  })
  async unlike(@Body() body: DeleteForumReplyLikeDto) {
    return this.forumReplyLikeService.unlikeReply(body)
  }

  /**
   * 检查用户是否已点赞回复
   * @param replyId - 回复ID
   * @param userId - 用户ID
   * @returns 包含点赞状态的对象
   */
  @Get('/check-liked')
  @ApiDoc({
    summary: '检查用户是否已点赞',
    model: { liked: true },
  })
  async checkLiked(@Query('replyId') replyId: number, @Query('userId') userId: number) {
    return this.forumReplyLikeService.checkUserLiked(replyId, userId)
  }
}
