import {
  FavoritePageQueryDto,
  FavoriteService,
  FavoriteTargetDto,
} from '@libs/interaction/favorite'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  FavoriteStatusResponseDto,
  FavoriteTopicPageItemDto,
  FavoriteWorkPageItemDto,
} from './dto/favorite.dto'

@ApiTags('收藏')
@Controller('app/favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post('favorite')
  @ApiDoc({
    summary: '收藏',
    model: IdDto,
  })
  async favorite(
    @Body() body: FavoriteTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.favoriteService.favorite({
      ...body,
      userId,
    })
  }

  @Post('cancel')
  @ApiDoc({
    summary: '取消收藏',
    model: Boolean,
  })
  async unfavorite(
    @Body() body: FavoriteTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    await this.favoriteService.unfavorite({
      ...body,
      userId,
    })
    return true
  }

  @Get('status')
  @ApiDoc({
    summary: '查询收藏状态（作品详情接口可复用）',
    model: FavoriteStatusResponseDto,
  })
  async status(
    @Query() query: FavoriteTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return {
      isFavorited: await this.favoriteService.checkFavoriteStatus({
        ...query,
        userId,
      }),
    }
  }

  @Get('work/page')
  @ApiPageDoc({
    summary: '分页查询我收藏的作品',
    model: FavoriteWorkPageItemDto,
  })
  async workPage(
    @Query() query: FavoritePageQueryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.favoriteService.getUserWorkFavorites({
      ...query,
      userId,
    })
  }

  @Get('topic/page')
  @ApiPageDoc({
    summary: '分页查询我收藏的论坛主题',
    model: FavoriteTopicPageItemDto,
  })
  async topicPage(
    @Query() query: FavoritePageQueryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.favoriteService.getUserTopicFavorites({
      ...query,
      userId,
    })
  }
}
