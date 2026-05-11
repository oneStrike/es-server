import {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  PlatformResponseDto,
  SearchComicItemDto,
  SearchComicRequestDto,
  ThirdPartyComicChapterContentDto,
  ThirdPartyComicChapterDto,
  ThirdPartyComicDetailDto,
  ThirdPartyComicImportPreviewDto,
  ThirdPartyComicImportPreviewRequestDto,
  ThirdPartyComicImportRequestDto,
  ThirdPartyComicImportResultDto,
} from '@libs/content/work/content/dto/content.dto'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../../common/decorators/api-audit-doc.decorator'
import { ComicThirdPartyService } from './third-party-service'

@ApiTags('内容管理/漫画管理/三方平台解析')
@Controller('admin/content/comic/third-party')
export class ComicThirdPartyController {
  // 注入第三方漫画聚合服务，controller 仅负责路由协议装配。
  constructor(private readonly thirdPartyService: ComicThirdPartyService) {}

  @Get('platform/list')
  @ApiDoc({
    summary: '获取第三方漫画平台列表',
    model: PlatformResponseDto,
    isArray: true,
  })
  // 获取可用于解析和导入的第三方漫画平台。
  async getPlatforms() {
    return this.thirdPartyService.listPlatforms()
  }

  @Get('search/page')
  @ApiPageDoc({
    summary: '搜索第三方平台漫画',
    model: SearchComicItemDto,
  })
  // 搜索第三方平台漫画分页结果。
  async searchComic(@Query() searchDto: SearchComicRequestDto) {
    return this.thirdPartyService.searchComic(searchDto)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取第三方平台漫画详情',
    model: ThirdPartyComicDetailDto,
  })
  // 查询第三方平台漫画详情。
  async comicDetail(@Query() query: DetailComicRequestDto) {
    return this.thirdPartyService.detail(query)
  }

  @Get('chapter/list')
  @ApiDoc({
    summary: '获取第三方平台漫画章节列表',
    model: ThirdPartyComicChapterDto,
    isArray: true,
  })
  // 查询第三方平台漫画章节列表。
  async getChapterList(@Query() query: DetailComicRequestDto) {
    return this.thirdPartyService.chapter(query)
  }

  @Get('chapter-content/detail')
  @ApiDoc({
    summary: '获取第三方平台漫画章节内容',
    model: ThirdPartyComicChapterContentDto,
  })
  // 查询第三方平台漫画章节图片内容。
  async chapterContent(@Query() query: ChapterContentComicRequestDto) {
    return this.thirdPartyService.content(query)
  }

  @Post('import/preview')
  @ApiDoc({
    summary: '预览第三方漫画导入',
    model: ThirdPartyComicImportPreviewDto,
  })
  // 预览第三方漫画导入计划。
  async previewImport(@Body() body: ThirdPartyComicImportPreviewRequestDto) {
    return this.thirdPartyService.previewImport(body)
  }

  @Post('import/confirm')
  @ApiAuditDoc({
    summary: '确认第三方漫画导入',
    model: ThirdPartyComicImportResultDto,
    audit: {
      actionType: AuditActionTypeEnum.IMPORT,
    },
  })
  // 确认并执行第三方漫画导入。
  async confirmImport(@Body() body: ThirdPartyComicImportRequestDto) {
    return this.thirdPartyService.confirmImport(body)
  }
}
