import { BaseAuthorDto, WorkAuthorService } from '@libs/content/author'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AuthorFollowCountRepairResultDto,
  AuthorPageResponseDto,
  AuthorWorkCountRepairResultDto,
  CreateAuthorDto,
  QueryAuthorDto,
  UpdateAuthorDto,
  UpdateAuthorRecommendedDto,
  UpdateAuthorStatusDto,
} from './dto/author.dto'

/**
 * 作者管理控制器
 * 提供作者相关的API接口
 */
@ApiTags('内容管理/作者管理')
@Controller('admin/content/author')
export class ContentAuthorController {
  constructor(private readonly authorService: WorkAuthorService) {}

  /**
   * 创建作者
   */
  @Post('create')
  @ApiDoc({
    summary: '创建作者',
    model: Boolean,
  })
  async create(@Body() body: CreateAuthorDto) {
    return this.authorService.createAuthor(body)
  }

  /**
   * 分页查询作者列表
   */
  @Get('page')
  @ApiPageDoc({
    summary: '分页查询作者列表',
    model: AuthorPageResponseDto,
  })
  async getPage(@Query() query: QueryAuthorDto) {
    return this.authorService.getAuthorPage(query)
  }

  /**
   * 获取作者详情
   */
  @Get('detail')
  @ApiDoc({
    summary: '获取作者详情',
    model: BaseAuthorDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.authorService.getAuthorDetail(query)
  }

  /**
   * 更新作者信息
   */
  @Post('update')
  @ApiDoc({
    summary: '更新作者信息',
    model: Boolean,
  })
  async update(@Body() body: UpdateAuthorDto) {
    return this.authorService.updateAuthor(body)
  }

  /**
   * 更新作者状态
   */
  @Post('update-status')
  @ApiDoc({
    summary: '更新作者状态',
    model: Boolean,
  })
  async updateStatus(@Body() body: UpdateAuthorStatusDto) {
    return this.authorService.updateAuthorStatus(body)
  }

  /**
   * 批量更新作者推荐状态
   */
  @Post('update-recommended')
  @ApiDoc({
    summary: '更新作者推荐状态',
    model: Boolean,
  })
  async updateRecommended(@Body() body: UpdateAuthorRecommendedDto) {
    return this.authorService.updateAuthorRecommended(body)
  }

  @Post('rebuild-follow-count')
  @ApiDoc({
    summary: '重建作者关注计数',
    model: AuthorFollowCountRepairResultDto,
  })
  async rebuildFollowCount(@Body() body: IdDto) {
    return this.authorService.rebuildAuthorFollowersCountById(body.id)
  }

  @Post('rebuild-follow-count-all')
  @ApiDoc({
    summary: '全量重建作者关注计数',
    model: Boolean,
  })
  async rebuildFollowCountAll() {
    return this.authorService.rebuildAllAuthorFollowersCount()
  }

  @Post('rebuild-work-count')
  @ApiDoc({
    summary: '重建作者作品计数',
    model: AuthorWorkCountRepairResultDto,
  })
  async rebuildWorkCount(@Body() body: IdDto) {
    return this.authorService.rebuildAuthorWorkCountById(body.id)
  }

  @Post('rebuild-work-count-all')
  @ApiDoc({
    summary: '全量重建作者作品计数',
    model: Boolean,
  })
  async rebuildWorkCountAll() {
    return this.authorService.rebuildAllAuthorWorkCount()
  }

  /**
   * 删除作者
   */
  @Post('delete')
  @ApiDoc({
    summary: '删除作者',
    model: Boolean,
  })
  async delete(@Body() body: IdDto) {
    return this.authorService.deleteAuthor(body)
  }
}
