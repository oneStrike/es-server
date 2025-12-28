import { ApiDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { ChapterContentService } from './chapter-content.service'
import {
  AddChapterContentDto,
  DeleteChapterContentDto,
  MoveChapterContentDto,
  UpdateChapterContentDto,
} from './dto/chapter-content.dto'

/**
 * 漫画章节内容管理控制器
 * 提供漫画章节内容相关的API接口
 */
@ApiTags('内容管理/漫画管理模块/章节内容管理')
@Controller('admin/work/comic-chapter')
export class ChapterContentController {
  constructor(private readonly chapterContentService: ChapterContentService) {}

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
    return this.chapterContentService.getChapterContents(query.id)
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
    return this.chapterContentService.addChapterContent(body)
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
    return this.chapterContentService.updateChapterContent(body)
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
    return this.chapterContentService.deleteChapterContent(body)
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
    return this.chapterContentService.moveChapterContent(body)
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
    return this.chapterContentService.clearChapterContents(body.id)
  }
}
