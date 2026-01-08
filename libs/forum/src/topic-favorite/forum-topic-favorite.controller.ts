import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumTopicFavoriteDto,
  CreateForumTopicFavoriteDto,
  QueryForumTopicFavoriteDto,
  ToggleTopicFavoriteDto,
} from './dto/forum-topic-favorite.dto'
import { ForumTopicFavoriteService } from './forum-topic-favorite.service'

@ApiTags('论坛管理/主题收藏模块')
@Controller('admin/forum/topic-favorite')
export class ForumTopicFavoriteController {
  constructor(
    private readonly forumTopicFavoriteService: ForumTopicFavoriteService,
  ) {}

  @Post('/add')
  @ApiDoc({
    summary: '收藏主题',
    model: BaseForumTopicFavoriteDto,
  })
  async add(@Body() body: CreateForumTopicFavoriteDto) {
    return this.forumTopicFavoriteService.addFavorite(body)
  }

  @Post('/remove')
  @ApiDoc({
    summary: '取消收藏主题',
    model: BaseDto,
  })
  async remove(@Body() body: CreateForumTopicFavoriteDto) {
    const { profileId } = body
    const topicId = body.topicId
    return this.forumTopicFavoriteService.removeFavorite(topicId, profileId)
  }

  @Post('/toggle')
  @ApiDoc({
    summary: '切换收藏状态',
    model: BaseForumTopicFavoriteDto,
  })
  async toggle(@Body() body: ToggleTopicFavoriteDto) {
    return this.forumTopicFavoriteService.toggleTopicFavorite(body)
  }

  @Get('/user-favorites')
  @ApiPageDoc({
    summary: '获取用户收藏列表',
    model: BaseForumTopicFavoriteDto,
  })
  async getUserFavorites(@Query() query: QueryForumTopicFavoriteDto) {
    return this.forumTopicFavoriteService.getUserFavorites(query)
  }

  @Get('/check-favorited')
  @ApiDoc({
    summary: '检查用户是否已收藏',
    model: { favorited: true },
  })
  async checkFavorited(@Query('topicId') topicId: number, @Query('profileId') profileId: number) {
    return this.forumTopicFavoriteService.checkUserFavorited(topicId, profileId)
  }

  @Get('/topic-favorite-count')
  @ApiDoc({
    summary: '获取主题收藏数',
    model: { topicId: 1, favoriteCount: 10 },
  })
  async getTopicFavoriteCount(@Query('topicId') topicId: number) {
    return this.forumTopicFavoriteService.getTopicFavoriteCount(topicId)
  }
}
