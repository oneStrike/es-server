import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  PlatformResponseDto,
  SearchComicItemDto,
  SearchComicRequestDto,
  THIRD_PARTY_COMIC_CHAPTER_CONTENT_SCHEMA,
  THIRD_PARTY_COMIC_CHAPTER_SCHEMA,
  THIRD_PARTY_COMIC_DETAIL_SCHEMA,
} from './dto/third-party.dto'
import { ComicThirdPartyService } from './third-party-service'
import { COMIC_THIRD_PARTY_PLATFORMS } from './third-party.constant'

@ApiTags('内容管理/漫画管理/三方平台解析')
@Controller('admin/content/comic/third-party')
export class ComicThirdPartyController {
  constructor(private readonly thirdPartyService: ComicThirdPartyService) {}

  @Get('platform/list')
  @ApiDoc({
    summary: '获取第三方漫画平台列表',
    model: PlatformResponseDto,
    isArray: true,
  })
  async getPlatforms() {
    return COMIC_THIRD_PARTY_PLATFORMS
  }

  @Get('search')
  @ApiPageDoc({
    summary: '搜索第三方平台漫画',
    model: SearchComicItemDto,
  })
  async searchComic(@Query() searchDto: SearchComicRequestDto) {
    return this.thirdPartyService.searchComic(searchDto)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取第三方平台漫画详情',
    model: THIRD_PARTY_COMIC_DETAIL_SCHEMA as never,
  })
  async comicDetail(@Query() query: DetailComicRequestDto) {
    return this.thirdPartyService.detail(query)
  }

  @Get('chapter/list')
  @ApiDoc({
    summary: '获取第三方平台漫画章节列表',
    model: THIRD_PARTY_COMIC_CHAPTER_SCHEMA as never,
    isArray: true,
  })
  async getChapterList(@Query() query: DetailComicRequestDto) {
    return this.thirdPartyService.chapter(query)
  }

  @Get('chapter-content/detail')
  @ApiDoc({
    summary: '获取第三方平台漫画章节内容',
    model: THIRD_PARTY_COMIC_CHAPTER_CONTENT_SCHEMA as never,
  })
  async chapterContent(@Query() query: ChapterContentComicRequestDto) {
    return this.thirdPartyService.content(query)
  }
}
