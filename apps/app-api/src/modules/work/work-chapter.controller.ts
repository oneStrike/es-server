import { ApiDoc, ApiPageDoc, Public } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseWorkChapterDto,
  ComicContentService,
  NovelContentService,
  PageWorkChapterDto,
  QueryWorkChapterDto,
  WorkChapterService,
} from '@libs/content'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品模块/章节')
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
  @Public()
  @ApiDoc({
    summary: '查询作品章节详情',
    model: BaseWorkChapterDto,
  })
  async getWorkChapterDetail(@Query() query: IdDto) {
    return this.workChapterService.getChapterDetail(query.id)
  }

  @Get('comic-content')
  @Public()
  @ApiDoc({
    summary: '查询漫画章节内容',
    model: String,
    isArray: true,
  })
  async getComicChapterContent(@Query() query: IdDto) {
    return this.comicContentService.getChapterContents(query.id)
  }

  @Get('novel-content')
  @Public()
  @ApiDoc({
    summary: '查询小说章节内容',
    model: String,
  })
  async getNovelChapterContent(@Query() query: IdDto) {
    return this.novelContentService.getChapterContent(query.id)
  }
}
