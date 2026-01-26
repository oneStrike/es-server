import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { DragReorderDto, IdDto } from '@libs/base/dto'
import {
  ComicChapterDetailDto,
  ComicChapterPageResponseDto,
  ComicChapterService,
  CreateComicChapterDto,
  QueryComicChapterDto,
  UpdateComicChapterDto,
} from '@libs/content/comic/chapter'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

/**
 * 漫画章节管理控制器
 * 提供漫画章节的增删改查等接口
 */
@ApiTags('内容管理/漫画章节模块')
@Controller('admin/work/comic-chapter')
export class ComicChapterController {
  constructor(private readonly comicChapterService: ComicChapterService) {}

  /**
   * 创建漫画章节
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建漫画章节',
    model: IdDto,
  })
  async create(@Body() createComicChapterDto: CreateComicChapterDto) {
    return this.comicChapterService.createComicChapter(createComicChapterDto)
  }

  /**
   * 分页查询漫画章节列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询漫画章节列表',
    model: ComicChapterPageResponseDto,
  })
  async getPage(@Query() queryComicChapterDto: QueryComicChapterDto) {
    return this.comicChapterService.getComicChapterPage(queryComicChapterDto)
  }

  /**
   * 获取漫画章节详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取漫画章节详情',
    model: ComicChapterDetailDto,
  })
  async getDetail(@Query() idDto: IdDto) {
    return this.comicChapterService.getComicChapterDetail(idDto.id)
  }

  /**
   * 更新漫画章节
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新漫画章节',
    model: IdDto,
  })
  async update(@Body() updateComicChapterDto: UpdateComicChapterDto) {
    return this.comicChapterService.updateComicChapter(updateComicChapterDto)
  }

  /**
   * 删除漫画章节
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除漫画章节',
    model: IdDto,
  })
  async delete(@Body() idDto: IdDto) {
    return this.comicChapterService.deleteComicChapter(idDto.id)
  }

  /**
   * 交换章节序号
   */
  @Post('/swap-sort-order')
  @ApiDoc({
    summary: '交换章节序号',
    model: DragReorderDto,
  })
  async swapSortOrder(@Body() swapChapterNumberDto: DragReorderDto) {
    return this.comicChapterService.swapChapterNumbers(swapChapterNumberDto)
  }
}
