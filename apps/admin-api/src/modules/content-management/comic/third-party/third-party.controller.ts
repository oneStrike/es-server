import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  DetailComicRequestDto,
  PlatformResponseDto,
  SearchComicItemDto,
  SearchComicRequestDto,
} from './dto/third-party.dto'
import { ComicThirdPartyService } from './third-party-service'
import { PLATFORMS } from './third-party.constant'

@ApiTags('内容管理/漫画管理模块/三方平台内容解析')
@Controller('admin/work/comic/third-party')
export class ComicThirdPartyController {
  constructor(private readonly thirdPartyService: ComicThirdPartyService) {}

  @Get('/platform')
  @ApiDoc({
    summary: '获取第三方漫画平台列表',
    model: PlatformResponseDto,
    isArray: true,
  })
  async getPlatforms() {
    return PLATFORMS
  }

  @Get('/search')
  @ApiPageDoc({
    summary: '搜索第三方平台漫画',
    model: SearchComicItemDto,
  })
  async searchComic(@Query() searchDto: SearchComicRequestDto) {
    return this.thirdPartyService.searchComic(searchDto)
  }

  @Get('/detail')
  @ApiPageDoc({
    summary: '获取第三方平台漫画详情',
    model: SearchComicItemDto,
  })
  async comicDetail(@Query() query: DetailComicRequestDto) {
    return this.thirdPartyService.detail(query)
  }

  @Get('/chapter')
  @ApiPageDoc({
    summary: '根据平台获取漫画章节',
    model: SearchComicItemDto,
  })
  async detailByPlatform(@Query() query: DetailComicRequestDto) {
    return this.thirdPartyService.chapter(query)
  }

  @Get('/chapter-content')
  @ApiPageDoc({
    summary: '根据平台获取漫画章节内容',
    model: SearchComicItemDto,
  })
  async chapterContent(@Query() query: DetailComicRequestDto) {
    return this.thirdPartyService.content(query)
  }
}
