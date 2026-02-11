import type { JwtUserInfoInterface } from '@libs/base/types'
import type { FastifyRequest } from 'fastify'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto, IdsDto } from '@libs/base/dto'
import { extractIpAddress, parseDeviceInfo } from '@libs/base/utils'
import {
  ComicChapterDetailWithUserStatusDto,
  ComicChapterPageWithUserStatusDto,
  ComicChapterService,
  ComicChapterUserStatusDto,
  QueryComicChapterDto,
} from '@libs/content/comic/chapter'
import {
  ComicDetailWithUserStatusDto,
  ComicPageWithUserStatusDto,
  ComicService,
  ComicUserStatusDto,
  QueryComicDto,
} from '@libs/content/comic/core'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('漫画模块')
@Controller('app/comic')
export class ComicController {
  constructor(
    private readonly comicService: ComicService,
    private readonly comicChapterService: ComicChapterService,
  ) {}

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

  @Post('chapter/read')
  @ApiDoc({
    summary: '记录章节阅读',
    model: IdDto,
  })
  async readChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @Req() req: FastifyRequest,
  ) {
    const { ip, deviceId } = this.getRequestMeta(req)
    return this.comicChapterService.incrementViewCount(
      body.id,
      user.sub,
      ip,
      deviceId,
    )
  }

  @Get('chapter/detail')
  @ApiDoc({
    summary: '获取漫画章节详情',
    model: ComicChapterDetailWithUserStatusDto,
  })
  async getChapterDetail(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterService.getComicChapterDetailWithUserStatus(
      query.id,
      user.sub,
    )
  }

  @Get('chapter/page')
  @ApiPageDoc({
    summary: '分页查询漫画章节列表',
    model: ComicChapterPageWithUserStatusDto,
  })
  async getChapterPage(
    @Query() query: QueryComicChapterDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterService.getComicChapterPageWithUserStatus(
      query,
      user.sub,
    )
  }

  @Post('chapter/like')
  @ApiDoc({
    summary: '记录章节点赞',
    model: IdDto,
  })
  async likeChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @Req() req: FastifyRequest,
  ) {
    const { ip, deviceId } = this.getRequestMeta(req)
    return this.comicChapterService.incrementLikeCount(
      body.id,
      user.sub,
      ip,
      deviceId,
    )
  }

  @Get('chapter/liked')
  @ApiDoc({
    summary: '检查是否点赞章节',
    model: IdDto,
  })
  async checkChapterLiked(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterService.checkUserLiked(query.id, user.sub)
  }

  @Post('chapter/purchase')
  @ApiDoc({
    summary: '记录章节购买',
    model: IdDto,
  })
  async purchaseChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @Req() req: FastifyRequest,
  ) {
    const { ip, deviceId } = this.getRequestMeta(req)
    return this.comicChapterService.incrementPurchaseCount(
      body.id,
      user.sub,
      ip,
      deviceId,
    )
  }

  @Get('chapter/purchased')
  @ApiDoc({
    summary: '检查是否购买章节',
    model: IdDto,
  })
  async checkChapterPurchased(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterService.checkUserPurchased(query.id, user.sub)
  }

  @Post('chapter/download')
  @ApiDoc({
    summary: '记录章节下载',
    model: IdDto,
  })
  async downloadChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @Req() req: FastifyRequest,
  ) {
    const { ip, deviceId } = this.getRequestMeta(req)
    return this.comicChapterService.reportDownload(
      body.id,
      user.sub,
      ip,
      deviceId,
    )
  }

  @Get('chapter/downloaded')
  @ApiDoc({
    summary: '检查是否下载章节',
    model: IdDto,
  })
  async checkChapterDownloaded(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterService.checkUserDownloaded(query.id, user.sub)
  }

  @Post('chapter/status')
  @ApiDoc({
    summary: '批量查询章节用户状态',
    model: ComicChapterUserStatusDto,
    isArray: true,
  })
  async getChapterStatus(
    @Body() body: IdsDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.comicChapterService.getComicChapterUserStatus(
      body.ids,
      user.sub,
    )
  }
}
