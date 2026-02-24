import { WorkTypeEnum } from '@libs/base/constant'
import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { DragReorderDto, IdDto } from '@libs/base/dto'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
  WorkChapterService,
} from '@libs/content/work/chapter'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('内容管理/小说章节模块')
@Controller('admin/work/novel-chapter')
export class NovelChapterController {
  constructor(private readonly workChapterService: WorkChapterService) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建小说章节',
    model: IdDto,
  })
  async create(@Body() body: CreateWorkChapterDto) {
    return this.workChapterService.createChapter({
      ...body,
      workType: WorkTypeEnum.NOVEL,
    })
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询小说章节列表',
    model: IdDto,
  })
  async getPage(@Query() query: QueryWorkChapterDto) {
    return this.workChapterService.getChapterPage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取小说章节详情',
    model: IdDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.workChapterService.getChapterDetail(query.id)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新小说章节',
    model: IdDto,
  })
  async update(@Body() body: UpdateWorkChapterDto) {
    return this.workChapterService.updateChapter(body)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除小说章节',
    model: IdDto,
  })
  async delete(@Body() query: IdDto) {
    return this.workChapterService.deleteChapter(query.id)
  }

  @Post('/swap-sort-order')
  @ApiDoc({
    summary: '交换章节序号',
    model: DragReorderDto,
  })
  async swapSortOrder(@Body() body: DragReorderDto) {
    return this.workChapterService.swapChapterNumbers(body)
  }
}
