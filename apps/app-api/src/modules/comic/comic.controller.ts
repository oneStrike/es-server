import type { JwtUserInfoInterface } from '@libs/base/types'
import type { FastifyRequest } from 'fastify'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto, IdsDto, PageDto } from '@libs/base/dto'
import { extractIpAddress, parseDeviceInfo } from '@libs/base/utils'
import {
  ComicDetailWithUserStatusDto,
  ComicPageWithUserStatusDto,
  ComicService,
  ComicUserStatusDto,
  QueryComicDto,
} from '@libs/content/comic/core'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('漫画模块/漫画')
@Controller('app/comic')
export class ComicController {
  constructor(private readonly comicService: ComicService) {}

  private getRequestMeta(req: FastifyRequest) {
    return {
      ip: extractIpAddress(req),
      deviceId: parseDeviceInfo(req.headers['user-agent']),
    }
  }

  @Post('view')
  @ApiDoc({
    summary: '记录漫画浏览',
    model: IdDto,
  })
  async viewComic(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @Req() req: FastifyRequest,
  ) {
    const { ip, deviceId } = this.getRequestMeta(req)
    return this.comicService.incrementViewCount(body.id, user.sub, ip, deviceId)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取漫画详情',
    model: ComicDetailWithUserStatusDto,
  })
  async getComicDetail(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicService.getComicDetailWithUserStatus(query.id, user.sub)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询漫画列表',
    model: ComicPageWithUserStatusDto,
  })
  async getComicPage(
    @Query() query: QueryComicDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicService.getComicPageWithUserStatus(query, user.sub)
  }

  @Post('like')
  @ApiDoc({
    summary: '记录漫画点赞',
    model: IdDto,
  })
  async likeComic(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @Req() req: FastifyRequest,
  ) {
    const { ip, deviceId } = this.getRequestMeta(req)
    return this.comicService.incrementLikeCount(body.id, user.sub, ip, deviceId)
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
    return this.comicService.checkUserLiked(query.id, user.sub)
  }

  @Post('favorite')
  @ApiDoc({
    summary: '记录漫画收藏',
    model: IdDto,
  })
  async favoriteComic(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @Req() req: FastifyRequest,
  ) {
    const { ip, deviceId } = this.getRequestMeta(req)
    return this.comicService.incrementFavoriteCount(
      body.id,
      user.sub,
      ip,
      deviceId,
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
    return this.comicService.checkUserFavorited(query.id, user.sub)
  }

  @Post('status')
  @ApiDoc({
    summary: '批量查询漫画用户状态',
    model: ComicUserStatusDto,
    isArray: true,
  })
  async getComicStatus(
    @Body() body: IdsDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicService.getComicUserStatus(body.ids, user.sub)
  }

  @Get('my/favorites')
  @ApiPageDoc({
    summary: '分页查询我的漫画收藏',
    model: ComicPageWithUserStatusDto,
  })
  async getMyFavoriteComics(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicService.getMyFavoriteComicPage(query, user.sub)
  }

  @Get('my/likes')
  @ApiPageDoc({
    summary: '分页查询我的漫画点赞',
    model: ComicPageWithUserStatusDto,
  })
  async getMyLikedComics(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicService.getMyLikedComicPage(query, user.sub)
  }
}
