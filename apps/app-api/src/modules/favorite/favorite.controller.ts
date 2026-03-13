import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import {
  FavoritePageItemDto,
  FavoritePageQueryDto,
  FavoriteService,
  FavoriteTargetDto,
} from '@libs/interaction'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('收藏模块')
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
    return this.favoriteService.favorite(body.targetType, body.targetId, userId)
  }

  @Post('cancel')
  @ApiDoc({
    summary: '取消收藏',
    model: IdDto,
  })
  async unfavorite(
    @Body() body: FavoriteTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    await this.favoriteService.unfavorite(
      body.targetType,
      body.targetId,
      userId,
    )
    return { id: body.targetId }
  }

  @Get('status')
  @ApiDoc({
    summary: '查询收藏状态（作品详情接口可复用）',
    model: Boolean,
  })
  async status(
    @Query() query: FavoriteTargetDto,
    @CurrentUser('sub') userId: number,
  ) {
    return {
      isFavorited: await this.favoriteService.checkFavoriteStatus(
        query.targetType,
        query.targetId,
        userId,
      ),
    }
  }

  @Get('my')
  @ApiPageDoc({
    summary: '分页查询我的收藏记录',
    model: FavoritePageItemDto,
  })
  async my(
    @Query() query: FavoritePageQueryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.favoriteService.getUserFavorites(query, userId)
  }
}
