import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'

import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumTopicDto,
  CreateForumTopicDto,
  FavoriteTopicDto,
  LikeTopicDto,
  QueryForumTopicDto,
  UpdateForumTopicDto,
} from './dto/forum-topic.dto'
import { ForumTopicService } from './forum-topic.service'

/**
 * 客户端论坛主题控制器
 * 提供客户端论坛主题相关的API接口
 */
@ApiTags('客户端/论坛/主题模块')
@Controller('client/forum/topic')
export class ForumTopicController {
  constructor(private readonly forumTopicService: ForumTopicService) {}

  /**
   * 创建论坛主题
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: IdDto,
  })
  async create(
    @Body() body: CreateForumTopicDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.forumTopicService.createForumTopic(body, userId)
  }

  /**
   * 分页查询论坛主题列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛主题列表',
    model: BaseForumTopicDto,
  })
  async getPage(@Query() query: QueryForumTopicDto) {
    return this.forumTopicService.getForumTopicPage(query)
  }

  /**
   * 获取论坛主题详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛主题详情',
    model: BaseForumTopicDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumTopicService.getForumTopicDetail(query.id)
  }

  /**
   * 更新论坛主题
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新论坛主题',
    model: IdDto,
  })
  async update(
    @Body() body: UpdateForumTopicDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.forumTopicService.updateForumTopic(body, userId)
  }

  /**
   * 删除论坛主题
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除论坛主题',
    model: IdDto,
  })
  async delete(@Body() body: IdDto, @CurrentUser('id') userId: number) {
    return this.forumTopicService.deleteForumTopic(body.id, userId)
  }

  /**
   * 点赞主题
   */
  @Post('/like')
  @ApiDoc({
    summary: '点赞主题',
    model: IdDto,
  })
  async like(@Body() body: LikeTopicDto, @CurrentUser('id') userId: number) {
    return this.forumTopicService.likeTopic(body.id, userId, body.isLike)
  }

  /**
   * 收藏主题
   */
  @Post('/favorite')
  @ApiDoc({
    summary: '收藏主题',
    model: IdDto,
  })
  async favorite(
    @Body() body: FavoriteTopicDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.forumTopicService.favoriteTopic(body.id, userId, body.isFavorite)
  }
}
