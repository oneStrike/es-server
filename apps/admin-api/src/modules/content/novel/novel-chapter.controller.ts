import {
  WorkChapterService,
} from '@libs/content'
import { ContentTypeEnum } from '@libs/platform/constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { DragReorderDto, IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/novel-chapter.dto'

@ApiTags('内容管理/小说章节')
@Controller('admin/content/novel-chapter')
export class NovelChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建小说章节',
    model: Boolean,
  })
  async create(@Body() body: CreateWorkChapterDto) {
    return this.workChapterService.createChapter({
      ...body,
      workType: ContentTypeEnum.NOVEL,
    })
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询小说章节列表',
    model: IdDto,
  })
  async getPage(@Query() query: QueryWorkChapterDto) {
    return this.workChapterService.getChapterPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取小说章节详情',
    model: IdDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workChapterService.getChapterDetail(query.id)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新小说章节',
    model: Boolean,
  })
  async update(@Body() body: UpdateWorkChapterDto) {
    return this.workChapterService.updateChapter(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除小说章节',
    model: Boolean,
  })
  async delete(@Body() query: IdDto) {
    return this.workChapterService.deleteChapter(query.id)
  }

  @Post('swap-sort-order')
  @ApiDoc({
    summary: '交换章节序号',
    model: Boolean,
  })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.workChapterService.swapChapterNumbers(body)
  }
}
