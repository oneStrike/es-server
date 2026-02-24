import type { FastifyRequest } from 'fastify'
import { ApiDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { FileUploadResponseDto } from '@libs/base/modules/upload'
import {
  AddChapterContentDto,
  ComicContentService,
  DeleteChapterContentDto,
  MoveChapterContentDto,
  UpdateChapterContentDto,
} from '@libs/content/work/content'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('内容管理/漫画章节内容模块')
@Controller('admin/work/chapter-content')
export class ChapterContentController {
  constructor(private readonly comicContentService: ComicContentService) {}

  @Get('/list')
  @ApiDoc({
    summary: '获取章节内容',
    model: String,
    isArray: true,
  })
  async getContents(@Query() query: IdDto) {
    return this.comicContentService.getChapterContents(query.id)
  }

  @Post('/add')
  @ApiDoc({
    summary: '添加章节内容',
    model: FileUploadResponseDto,
  })
  async add(@Req() req: FastifyRequest, @Query() query: AddChapterContentDto) {
    return this.comicContentService.addChapterContent(req, query)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新章节内容',
    model: IdDto,
  })
  async update(@Body() body: UpdateChapterContentDto) {
    return this.comicContentService.updateChapterContent(body)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除章节内容',
    model: String,
    isArray: true,
  })
  async delete(@Body() body: DeleteChapterContentDto) {
    return this.comicContentService.deleteChapterContent(body)
  }

  @Post('/move')
  @ApiDoc({
    summary: '移动章节内容',
    model: String,
    isArray: true,
  })
  async move(@Body() body: MoveChapterContentDto) {
    return this.comicContentService.moveChapterContent(body)
  }

  @Post('/clear')
  @ApiDoc({
    summary: '清空章节内容',
    model: IdDto,
  })
  async clear(@Body() body: IdDto) {
    return this.comicContentService.clearChapterContents(body.id)
  }
}
