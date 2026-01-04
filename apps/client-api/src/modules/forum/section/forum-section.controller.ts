import { ApiDoc, ApiPageDoc, Public } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  BaseForumSectionDto,
  QueryForumSectionDto,
} from './dto/forum-section.dto'
import { ForumSectionService } from './forum-section.service'

/**
 * 客户端论坛板块控制器
 * 提供客户端论坛板块查询API接口
 */
@ApiTags('客户端论坛/板块模块')
@Controller('client/forum/section')
export class ForumSectionController {
  constructor(private readonly forumSectionService: ForumSectionService) {}

  /**
   * 分页查询论坛板块列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛板块列表',
    model: BaseForumSectionDto,
  })
  @Public()
  async getPage(@Query() query: QueryForumSectionDto) {
    return this.forumSectionService.getForumSectionPage(query)
  }

  /**
   * 获取论坛板块详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛板块详情',
    model: BaseForumSectionDto,
  })
  @Public()
  async getDetail(@Query() query: IdDto) {
    return this.forumSectionService.getForumSectionDetail(query.id)
  }
}
