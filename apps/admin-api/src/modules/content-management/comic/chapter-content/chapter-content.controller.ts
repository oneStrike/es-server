import type { FastifyRequest } from 'fastify'
import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { FileUploadResponseDto } from '@libs/base/modules/upload'
import {
  AddChapterContentDto,
  BatchUpdateChapterContentsDto,
  ChapterContentService,
  DeleteChapterContentDto,
  MoveChapterContentDto,
  UpdateChapterContentDto,
} from '@libs/content/comic/chapter-content'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 漫画章节内容管理控制器
 * 提供漫画章节内容的增删改查等接口
 */
@ApiTags('内容管理/漫画章节内容模块')
@Controller('admin/work/chapter-content')
export class ChapterContentController {
  constructor(private readonly chapterContentService: ChapterContentService) {}

  /**
   * 获取章节内容
   */
  @Get('/list')
  @ApiPageDoc({
    summary: '获取章节内容',
    model: String,
    isArray: true,
  })
  async getContents(@Query() idDto: IdDto) {
    return this.chapterContentService.getChapterContents(idDto.id)
  }

  /**
   * 添加章节内容（上传图片）
   */
  @Post('/add')
  @ApiDoc({
    summary: '添加章节内容',
    model: FileUploadResponseDto,
  })
  async add(@Req() req: FastifyRequest, @Query() query: AddChapterContentDto) {
    return this.chapterContentService.addChapterContent(req, query)
  }

  /**
   * 更新章节内容
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新章节内容',
    model: IdDto,
  })
  async update(@Body() body: UpdateChapterContentDto) {
    return this.chapterContentService.updateChapterContent(body)
  }

  /**
   * 删除章节内容
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除章节内容',
    model: String,
    isArray: true,
  })
  async delete(@Body() dto: DeleteChapterContentDto) {
    return this.chapterContentService.deleteChapterContent(dto)
  }

  /**
   * 移动章节内容（排序）
   */
  @Post('/move')
  @ApiDoc({
    summary: '移动章节内容',
    model: String,
    isArray: true,
  })
  async move(@Body() body: MoveChapterContentDto) {
    return this.chapterContentService.moveChapterContent(body)
  }

  /**
   * 批量更新章节内容
   */
  @Post('/batch-update')
  @ApiDoc({
    summary: '批量更新章节内容',
    model: IdDto,
  })
  async batchUpdate(@Body() body: BatchUpdateChapterContentsDto) {
    return this.chapterContentService.workComicChapter.update({
      where: { id: body.id },
      data: { contents: body.contents as any },
    })
  }

  /**
   * 清空章节内容
   */
  @Post('/clear')
  @ApiDoc({
    summary: '清空章节内容',
    model: IdDto,
  })
  async clear(@Body() idDto: IdDto) {
    return this.chapterContentService.clearChapterContents(idDto.id)
  }
}
