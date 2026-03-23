import { FavoriteService } from '@libs/interaction/favorite'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  FavoritePageItemDto,
  FavoritePageQueryDto,
  FavoriteStatusResponseDto,
  FavoriteTargetDto,
} from './dto/favorite.dto'

@ApiTags('收藏')
@Controller('app/favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post('favorite')
  @ApiDoc({
    summary: '收藏',
    model: Boolean,
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
    return this.favoriteService.unfavorite({
      ...body,
      userId,
    })
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

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的收藏记录',
    model: FavoritePageItemDto,
  })
  async my(
    @Query() query: FavoritePageQueryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.favoriteService.getUserFavorites({
      ...query,
      userId,
    })
  }
}
