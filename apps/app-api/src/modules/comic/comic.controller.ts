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

@ApiTags('漫画模块/漫画')
@Controller('app/comic')
export class ComicController {
  constructor(private readonly workService: WorkService) {}

  @Post('view')
  @ApiDoc({
    summary: '记录漫画浏览',
    model: IdDto,
  })
  async viewComic(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workService.incrementViewCount(
      body.id,
      user.sub,
      meta.ip,
      meta.deviceId,
    )
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取漫画详情',
    model: WorkDetailWithUserStatusDto,
  })
  async getComicDetail(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getWorkDetailWithUserStatus(query.id, user.sub)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询漫画列表',
    model: WorkPageWithUserStatusDto,
  })
  async getComicPage(
    @Query() query: QueryWorkDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getWorkPageWithUserStatus(
      { ...query, type: WorkTypeEnum.COMIC },
      user.sub,
    )
  }

  @Post('like')
  @ApiDoc({
    summary: '记录漫画点赞',
    model: IdDto,
  })
  async likeComic(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workService.incrementLikeCount(
      body.id,
      user.sub,
      meta.ip,
      meta.deviceId,
    )
  }

  @Get('liked')
  @ApiDoc({
    summary: '检查是否点赞漫画',
    model: IdDto,
  })
  async checkComicLiked(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.checkUserLiked(query.id, user.sub)
  }

  @Post('favorite')
  @ApiDoc({
    summary: '记录漫画收藏',
    model: IdDto,
  })
  async favoriteComic(
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
    summary: '检查是否收藏漫画',
    model: IdDto,
  })
  async checkComicFavorited(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.checkUserFavorited(query.id, user.sub)
  }

  @Post('status')
  @ApiDoc({
    summary: '批量查询漫画用户状态',
    model: WorkUserStatusDto,
    isArray: true,
  })
  async getComicStatus(
    @Body() body: IdsDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getWorkUserStatus(body.ids, user.sub)
  }

  @Get('my/favorites')
  @ApiPageDoc({
    summary: '分页查询我的漫画收藏',
    model: WorkPageWithUserStatusDto,
  })
  async getMyFavoriteComics(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getMyFavoritePage(query, user.sub)
  }

  @Get('my/likes')
  @ApiPageDoc({
    summary: '分页查询我的漫画点赞',
    model: WorkPageWithUserStatusDto,
  })
  async getMyLikedComics(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workService.getMyLikedPage(query, user.sub)
  }
}
