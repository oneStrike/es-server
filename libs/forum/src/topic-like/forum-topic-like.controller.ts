import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto, UserIdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumTopicLikeDto,
  CreateForumTopicLikeDto,
  QueryForumTopicLikeDto,
  ToggleTopicLikeDto,
} from './dto/forum-topic-like.dto'
import { ForumTopicLikeService } from './forum-topic-like.service'

@ApiTags('论坛管理/主题点赞模块')
@Controller('admin/forum/topic-like')
export class ForumTopicLikeController {
  constructor(
    private readonly forumTopicLikeService: ForumTopicLikeService,
  ) {}

  @Post('/like')
  @ApiDoc({
    summary: '点赞主题',
    model: BaseForumTopicLikeDto,
  })
  async like(@Body() body: CreateForumTopicLikeDto) {
    return this.forumTopicLikeService.likeTopic(body)
  }

  @Post('/unlike')
  @ApiDoc({
    summary: '取消点赞主题',
    model: BaseDto,
  })
  async unlike(@Body() body: CreateForumTopicLikeDto) {
    const { profileId } = body
    const topicId = body.topicId
    return this.forumTopicLikeService.unlikeTopic(topicId, profileId)
  }

  @Post('/toggle')
  @ApiDoc({
    summary: '切换点赞状态',
    model: BaseForumTopicLikeDto,
  })
  async toggle(@Body() body: ToggleTopicLikeDto) {
    return this.forumTopicLikeService.toggleTopicLike(body)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询主题点赞记录',
    model: BaseForumTopicLikeDto,
  })
  async getPage(@Query() query: QueryForumTopicLikeDto) {
    return this.forumTopicLikeService.getTopicLikes(query)
  }

  @Get('/check-liked')
  @ApiDoc({
    summary: '检查用户是否已点赞',
    model: { liked: true, type: 1 },
  })
  async checkLiked(@Query('topicId') topicId: number, @Query('profileId') profileId: number) {
    return this.forumTopicLikeService.checkUserLiked(topicId, profileId)
  }
}
