import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { DragReorderDto, IdDto, IdsDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { ComicChapterService } from './comic-chapter.service'
import {
  AddChapterContentDto,
  ComicChapterDetailDto,
  ComicChapterPageResponseDto,
  CreateComicChapterDto,
  DeleteChapterContentDto,
  MoveChapterContentDto,
  QueryComicChapterDto,
  UpdateChapterContentDto,
  UpdateChapterPublishStatusDto,
  UpdateComicChapterDto,
} from './dto/comic-chapter.dto'

/**
 * 漫画章节管理控制器
 * 提供漫画章节相关的API接口
 */
@ApiTags('漫画管理模块/章节管理')
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
  async create(@Body() body: CreateComicChapterDto) {
    return this.comicChapterService.createComicChapter(body)
  }

  /**
   * 分页查询漫画章节列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询漫画章节列表',
    model: ComicChapterPageResponseDto,
  })
  async getPage(@Query() query: QueryComicChapterDto) {
    return this.comicChapterService.getComicChapterPage(query)
  }

  /**
   * 获取漫画章节详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取漫画章节详情',
    model: ComicChapterDetailDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.comicChapterService.getComicChapterDetail(query.id)
  }

  /**
   * 更新漫画章节信息
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新漫画章节信息',
    model: IdDto,
  })
  async update(@Body() body: UpdateComicChapterDto) {
    return this.comicChapterService.updateComicChapter(body)
  }

  /**
   * 批量删除章节
   */
  @Post('/batch-delete')
  @ApiDoc({
    summary: '批量删除章节',
    model: IdDto,
  })
  async delete(@Body() body: IdsDto) {
    return this.comicChapterService.workComicChapter.deleteMany({
      where: { id: { in: body.ids } },
    })
  }

  /**
   * 批量更新章节发布状态
   */
  @Post('/update-status')
  @ApiDoc({
    summary: '更新章节发布状态',
    model: IdDto,
  })
  async updatePublishStatus(@Body() body: UpdateChapterPublishStatusDto) {
    return this.comicChapterService.workComicChapter.updateMany({
      where: {
        id: { in: body.ids },
      },
      data: {
        isPublished: body.isPublished,
      },
    })
  }

  /**
   * 交换两个章节的章节号
   */
  @Post('swap-numbers')
  @ApiDoc({ summary: '交换两个章节的章节号', model: DragReorderDto })
  async swapChapterNumbers(@Body() swapChapterNumberDto: DragReorderDto) {
    return this.comicChapterService.swapChapterNumbers(swapChapterNumberDto)
  }

  /**
   * 获取章节内容详情
   */
  @Get('/contents')
  @ApiDoc({
    summary: '获取章节内容详情',
    model: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  })
  async getChapterContents(@Query() query: IdDto) {
    return this.comicChapterService.getChapterContents(query.id)
  }

  /**
   * 添加章节内容
   */
  @Post('/add-content')
  @ApiDoc({
    summary: '添加章节内容',
    model: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  })
  async addChapterContent(@Body() body: AddChapterContentDto) {
    return this.comicChapterService.addChapterContent(body)
  }

  /**
   * 更新章节内容
   */
  @Post('/update-content')
  @ApiDoc({
    summary: '更新章节内容',
    model: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  })
  async updateChapterContent(@Body() body: UpdateChapterContentDto) {
    return this.comicChapterService.updateChapterContent(body)
  }

  /**
   * 删除章节内容
   */
  @Post('/delete-content')
  @ApiDoc({
    summary: '删除章节内容',
    model: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  })
  async deleteChapterContent(@Body() body: DeleteChapterContentDto) {
    return this.comicChapterService.deleteChapterContent(body)
  }

  /**
   * 移动章节内容（排序）
   */
  @Post('/move-content')
  @ApiDoc({
    summary: '移动章节内容（排序）',
    model: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  })
  async moveChapterContent(@Body() body: MoveChapterContentDto) {
    return this.comicChapterService.moveChapterContent(body)
  }

  /**
   * 清空章节内容
   */
  @Post('/clear-contents')
  @ApiDoc({
    summary: '清空章节内容',
    model: IdDto,
  })
  async clearChapterContents(@Body() body: IdDto) {
    return this.comicChapterService.clearChapterContents(body.id)
  }
}
