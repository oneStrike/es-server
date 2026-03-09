import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  FavoriteDto,
  FavoriteListQueryDto,
  FavoriteService,
  FavoriteStatusQueryDto,
  UnfavoriteDto,
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
    @Body() body: FavoriteDto,
    @CurrentUser('sub') userId: number,
  ) {
    await this.favoriteService.favorite(body.targetType, body.targetId, userId)
    return { id: body.targetId }
  }

  @Post('cancel')
  @ApiDoc({
    summary: '取消收藏',
    model: IdDto,
  })
  async unfavorite(
    @Body() body: UnfavoriteDto,
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
    @Query() query: FavoriteStatusQueryDto,
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
    model: IdDto,
  })
  async my(
    @Query() query: FavoriteListQueryDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.favoriteService.getUserFavorites(
      userId,
      query.targetType,
      query.pageIndex,
      query.pageSize,
    )
  }
}
