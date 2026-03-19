import type { FastifyRequest } from 'fastify'
import { ComicContentService } from '@libs/content'
import { ApiDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { FileUploadResponseDto } from '@libs/platform/modules/upload'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  DeleteComicContentDto,
  MoveComicContentDto,
  UpdateComicContentDto,
  UploadContentDto,
} from './dto/chapter-content.dto'

@ApiTags('内容管理/漫画章节内容')
@Controller('admin/content/comic-chapter-content')
export class ChapterContentController {
  constructor(private readonly comicContentService: ComicContentService) {}

  @Get('list')
  @ApiDoc({
    summary: '获取章节内容',
    model: String,
    isArray: true,
  })
  async getContents(@Query() query: IdDto) {
    return this.comicContentService.getChapterContents(query.id)
  }

  @Post('upload')
  @ApiDoc({
    summary: '上传章节内容',
    model: FileUploadResponseDto,
  })
  async upload(@Req() req: FastifyRequest, @Query() query: UploadContentDto) {
    return this.comicContentService.addChapterContent(req, query)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新章节内容',
    model: IdDto,
  })
  async update(@Body() body: UpdateComicContentDto) {
    return this.comicContentService.updateChapterContent(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除章节内容',
    model: String,
    isArray: true,
  })
  async delete(@Body() body: DeleteComicContentDto) {
    return this.comicContentService.deleteChapterContent(body)
  }

  @Post('move')
  @ApiDoc({
    summary: '移动章节内容',
    model: String,
    isArray: true,
  })
  async move(@Body() body: MoveComicContentDto) {
    return this.comicContentService.moveChapterContent(body)
  }

  @Post('clear')
  @ApiDoc({
    summary: '清空章节内容',
    model: IdDto,
  })
  async clear(@Body() body: IdDto) {
    return this.comicContentService.clearChapterContents(body.id)
  }
}
