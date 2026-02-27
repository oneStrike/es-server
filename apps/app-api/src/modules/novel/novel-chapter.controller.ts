import type { RequestMetaResult } from '@libs/base/decorators'
import type { JwtUserInfoInterface } from '@libs/base/types'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  RequestMeta,
} from '@libs/base/decorators'
import { IdDto, IdsDto, PageDto } from '@libs/base/dto'
import {
  QueryWorkChapterDto,
  WorkChapterDetailWithUserStatusDto,
  WorkChapterPageWithUserStatusDto,
  WorkChapterService,
  WorkChapterUserStatusDto,
} from '@libs/content/work/chapter'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('小说模块/章节')
@Controller('app/novel')
export class NovelChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

  @Post('chapter/read')
  @ApiDoc({
    summary: '记录章节阅读',
    model: IdDto,
  })
  async readChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workChapterService.incrementViewCount(
      body.id,
      user.sub,
      meta.ip,
      meta.deviceId,
    )
  }

  @Get('chapter/detail')
  @ApiDoc({
    summary: '获取小说章节详情',
    model: WorkChapterDetailWithUserStatusDto,
  })
  async getChapterDetail(
    @Query() query: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workChapterService.getChapterDetailWithUserStatus(
      query.id,
      user.sub,
    )
  }

  @Get('chapter/page')
  @ApiPageDoc({
    summary: '分页查询小说章节列表',
    model: WorkChapterPageWithUserStatusDto,
  })
  async getChapterPage(
    @Query() query: QueryWorkChapterDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workChapterService.getChapterPageWithUserStatus(query, user.sub)
  }

  @Get('chapter/my/purchases')
  @ApiPageDoc({
    summary: '分页查询我的章节购买记录',
    model: WorkChapterPageWithUserStatusDto,
  })
  async getMyChapterPurchases(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workChapterService.getMyPurchasedPage(query, user.sub)
  }

  @Get('chapter/my/downloads')
  @ApiPageDoc({
    summary: '分页查询我的章节下载记录',
    model: WorkChapterPageWithUserStatusDto,
  })
  async getMyChapterDownloads(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workChapterService.getMyDownloadedPage(query, user.sub)
  }

  @Get('chapter/my/reads')
  @ApiPageDoc({
    summary: '分页查询我的章节阅读记录',
    model: WorkChapterPageWithUserStatusDto,
  })
  async getMyChapterReads(
    @Query() query: PageDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workChapterService.getMyReadPage(query, user.sub)
  }

  @Post('chapter/like')
  @ApiDoc({
    summary: '记录章节点赞',
    model: IdDto,
  })
  async likeChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workChapterService.incrementLikeCount(
      body.id,
      user.sub,
      meta.ip,
      meta.deviceId,
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
    return this.workChapterService.checkUserLiked(query.id, user.sub)
  }

  @Post('chapter/purchase')
  @ApiDoc({
    summary: '记录章节购买',
    model: IdDto,
  })
  async purchaseChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workChapterService.incrementPurchaseCount(
      body.id,
      user.sub,
      meta.ip,
      meta.deviceId,
    )
  }

  @Post('chapter/exchange')
  @ApiDoc({
    summary: '记录章节兑换',
    model: IdDto,
  })
  async exchangeChapter(
    @Body() body: IdDto,
    @CurrentUser() user: JwtUserInfoInterface,
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workChapterService.exchangeChapter(
      body.id,
      user.sub,
      meta.ip,
      meta.deviceId,
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
    return this.workChapterService.checkUserPurchased(query.id, user.sub)
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
    return this.workChapterService.checkUserDownloaded(query.id, user.sub)
  }

  @Post('chapter/status')
  @ApiDoc({
    summary: '批量查询章节用户状态',
    model: WorkChapterUserStatusDto,
    isArray: true,
  })
  async getChapterStatus(
    @Body() body: IdsDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.workChapterService.getChapterUserStatus(body.ids, user.sub)
  }
}
