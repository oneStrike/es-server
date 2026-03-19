import {
  ComicChapterContentDto,
  ComicContentService,
  NovelChapterContentDto,
  NovelContentService,
  PageWorkChapterDto,
  QueryWorkChapterDto,
  WorkChapterDetailWithUserStatusDto,
  WorkChapterService,
} from '@libs/content'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
  Public,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'

import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品')
@Controller('app/work/chapter')
export class WorkChapterController {
  constructor(
    private readonly workChapterService: WorkChapterService,
    private readonly comicContentService: ComicContentService,
    private readonly novelContentService: NovelContentService,
  ) {}

  @Get('page')
  @Public()
  @ApiPageDoc({
    summary: '分页查询作品章节',
    model: PageWorkChapterDto,
  })
  async getWorkChapterPage(@Query() query: QueryWorkChapterDto) {
    return this.workChapterService.getChapterPage(query)
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询作品章节详情',
    model: WorkChapterDetailWithUserStatusDto,
  })
  async getWorkChapterDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.workChapterService.getChapterDetail(query.id, userId)
  }

  @Get('previous/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询上一章节详情',
    model: WorkChapterDetailWithUserStatusDto,
  })
  async getPreviousWorkChapterDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.workChapterService.getPreviousChapterDetail(query.id, userId)
  }

  @Get('next/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询下一章节详情',
    model: WorkChapterDetailWithUserStatusDto,
  })
  async getNextWorkChapterDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.workChapterService.getNextChapterDetail(query.id, userId)
  }

  @Get('comic-content/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询漫画章节内容（内容可复用详情接口）',
    model: ComicChapterContentDto,
  })
  async getComicChapterContent(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.comicContentService.getChapterContentsWithPermission(
      query.id,
      userId,
    )
  }

  @Get('novel-content/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询小说章节内容（内容可复用详情接口）',
    model: NovelChapterContentDto,
  })
  async getNovelChapterContent(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.novelContentService.getChapterContentWithPermission(
      query.id,
      userId,
    )
  }
}
