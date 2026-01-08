import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumTopicLikeDto,
  CreateForumTopicLikeDto,
  QueryForumTopicLikeDto,
  ToggleTopicLikeDto,
} from './dto/forum-topic-like.dto'
import { ForumTopicLikeService } from './forum-topic-like.service'

/**
 * 论坛主题点赞管理控制器
 * 提供论坛主题点赞相关的API接口
 */
@ApiTags('论坛管理/主题点赞模块')
@Controller('admin/forum/topic-like')
export class ForumTopicLikeController {
  constructor(
    private readonly forumTopicLikeService: ForumTopicLikeService,
  ) {}

  /**
   * 点赞主题
   * @param body - 创建点赞记录的数据传输对象
   * @returns 创建的点赞记录
   */
  @Post('/like')
  @ApiDoc({
    summary: '点赞主题',
    model: BaseForumTopicLikeDto,
  })
  async like(@Body() body: CreateForumTopicLikeDto) {
    return this.forumTopicLikeService.likeTopic(body)
  }

  /**
   * 取消点赞主题
   * @param body - 删除点赞记录的数据传输对象
   * @returns 操作结果
   */
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

  /**
   * 切换点赞状态
   * @param body - 切换点赞状态的数据传输对象
   * @returns 操作结果
   */
  @Post('/toggle')
  @ApiDoc({
    summary: '切换点赞状态',
    model: BaseForumTopicLikeDto,
  })
  async toggle(@Body() body: ToggleTopicLikeDto) {
    return this.forumTopicLikeService.toggleTopicLike(body)
  }

  /**
   * 分页查询主题点赞记录
   * @param query - 查询参数
   * @returns 分页的点赞记录列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询主题点赞记录',
    model: BaseForumTopicLikeDto,
  })
  async getPage(@Query() query: QueryForumTopicLikeDto) {
    return this.forumTopicLikeService.getTopicLikes(query)
  }

  /**
   * 检查用户是否已点赞主题
   * @param topicId - 主题ID
   * @param profileId - 用户资料ID
   * @returns 包含点赞状态和类型的对象
   */
  @Get('/check-liked')
  @ApiDoc({
    summary: '检查用户是否已点赞',
    model: { liked: true, type: 1 },
  })
  async checkLiked(@Query('topicId') topicId: number, @Query('profileId') profileId: number) {
    return this.forumTopicLikeService.checkUserLiked(topicId, profileId)
  }
}
