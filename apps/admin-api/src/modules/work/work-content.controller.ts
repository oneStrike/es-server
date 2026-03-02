import type { FastifyRequest } from 'fastify'
import { ApiDoc, NumberProperty } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { FileUploadResponseDto } from '@libs/base/modules/upload'
import {
  ChapterIdDto,
  ComicContentService,
  DeleteComicContentDto,
  MoveComicContentDto,
  NovelContentService,
  UpdateComicContentDto,
  UploadContentDto,
} from '@libs/content'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/// 章节ID查询DTO
class ChapterIdQueryDto {
  @NumberProperty({
    description: '章节ID',
    example: 1,
    required: true,
  })
  chapterId!: number
}

/// 漫画内容管理控制器
@ApiTags('内容管理/作品管理/章节/内容/漫画')
@Controller('admin/work/content/comic-content')
export class ComicContentController {
  constructor(private readonly comicContentService: ComicContentService) {}

  @Get('/list')
  @ApiDoc({
    summary: '获取漫画章节内容',
    model: String,
    isArray: true,
  })
  async getContents(@Query() query: ChapterIdQueryDto) {
    return this.comicContentService.getChapterContents(query.chapterId)
  }

  @Post('/add')
  @ApiDoc({
    summary: '上传漫画章节图片',
    model: FileUploadResponseDto,
  })
  async add(@Req() req: FastifyRequest, @Query() query: UploadContentDto) {
    return this.comicContentService.addChapterContent(req, query)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新漫画章节图片',
    model: ChapterIdQueryDto,
  })
  async update(@Body() body: UpdateComicContentDto) {
    return this.comicContentService.updateChapterContent(body)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除漫画章节图片',
    model: String,
    isArray: true,
  })
  async delete(@Body() body: DeleteComicContentDto) {
    return this.comicContentService.deleteChapterContent(body)
  }

  @Post('/move')
  @ApiDoc({
    summary: '移动漫画章节图片',
    model: String,
    isArray: true,
  })
  async move(@Body() body: MoveComicContentDto) {
    return this.comicContentService.moveChapterContent(body)
  }

  @Post('/clear')
  @ApiDoc({
    summary: '清空漫画章节所有图片',
    model: ChapterIdQueryDto,
  })
  async clear(@Body() body: ChapterIdQueryDto) {
    return this.comicContentService.clearChapterContents(body.chapterId)
  }
}

/// 小说内容管理控制器
@ApiTags('内容管理/作品管理/章节/内容/小说')
@Controller('admin/work/content/novel-content')
export class NovelContentController {
  constructor(private readonly novelContentService: NovelContentService) {}

  @Get('/list')
  @ApiDoc({
    summary: '获取小说章节内容',
    model: String,
  })
  async getContents(@Query() query: ChapterIdQueryDto) {
    return this.novelContentService.getChapterContent(query.chapterId)
  }

  @Post('/add')
  @ApiDoc({
    summary: '上传小说章节文本文件',
    model: FileUploadResponseDto,
  })
  async add(@Req() req: FastifyRequest, @Query() query: UploadContentDto) {
    return this.novelContentService.uploadChapterContent(req, query)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除小说章节内容',
    model: IdDto,
  })
  async delete(@Body() body: ChapterIdDto) {
    return this.novelContentService.deleteChapterContent(body.chapterId)
  }
}
