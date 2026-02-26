import { ApiDoc, ApiPageDoc, Public } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseWorkChapterDto,
  PageWorkChapterDto,
  QueryWorkChapterDto,
  WorkChapterService,
} from '@libs/content'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品模块/章节')
@Controller('app/work/chapter')
export class WorkChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

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
}
