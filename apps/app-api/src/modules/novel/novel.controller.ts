import type { RequestMetaResult } from '@libs/base/decorators'
import type { JwtUserInfoInterface } from '@libs/base/types'
import { WorkTypeEnum } from '@libs/base/constant'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  RequestMeta,
} from '@libs/base/decorators'
import { IdDto, IdsDto, PageDto } from '@libs/base/dto'
import {
  QueryWorkDto,
  WorkDetailWithUserStatusDto,
  WorkPageWithUserStatusDto,
  WorkService,
  WorkUserStatusDto,
} from '@libs/content/work/core'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('小说模块/小说')
@Controller('app/novel')
export class NovelController {
  constructor(private readonly workService: WorkService) {}

  @Post('view')
  @ApiDoc({
    summary: '记录小说浏览',
    model: IdDto,
  })
  async viewNovel(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workService.incrementViewCount(body.id, user.sub, meta.ip, meta.deviceId)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取小说详情',
    model: WorkDetailWithUserStatusDto,
  })
  async getNovelDetail(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getWorkDetailWithUserStatus(query.id, user.sub)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询小说列表',
    model: WorkPageWithUserStatusDto,
  })
  async getNovelPage(
    @Query() query: QueryWorkDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getWorkPageWithUserStatus(
      { ...query, type: WorkTypeEnum.NOVEL },
      user.sub,
    )
  }

  @Post('like')
  @ApiDoc({
    summary: '记录小说点赞',
    model: IdDto,
  })
  async likeNovel(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workService.incrementLikeCount(body.id, user.sub, meta.ip, meta.deviceId)
  }

  @Get('liked')
  @ApiDoc({
    summary: '检查是否点赞小说',
    model: IdDto,
  })
  async checkNovelLiked(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.checkUserLiked(query.id, user.sub)
  }

  @Post('favorite')
  @ApiDoc({
    summary: '记录小说收藏',
    model: IdDto,
  })
  async favoriteNovel(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workService.incrementFavoriteCount(
      body.id,
      user.sub,
      meta.ip,
      meta.deviceId,
    )
  }

  @Get('favorited')
  @ApiDoc({
    summary: '检查是否收藏小说',
    model: IdDto,
  })
  async checkNovelFavorited(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.checkUserFavorited(query.id, user.sub)
  }

  @Post('status')
  @ApiDoc({
    summary: '批量查询小说用户状态',
    model: WorkUserStatusDto,
    isArray: true,
  })
  async getNovelStatus(
    @Body() body: IdsDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getWorkUserStatus(body.ids, user.sub)
  }

  @Get('my/favorites')
  @ApiPageDoc({
    summary: '分页查询我的小说收藏',
    model: WorkPageWithUserStatusDto,
  })
  async getMyFavoriteNovels(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getMyFavoritePage(query, user.sub)
  }

  @Get('my/likes')
  @ApiPageDoc({
    summary: '分页查询我的小说点赞',
    model: WorkPageWithUserStatusDto,
  })
  async getMyLikedNovels(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getMyLikedPage(query, user.sub)
  }
}
