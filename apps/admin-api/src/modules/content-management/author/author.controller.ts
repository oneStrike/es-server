import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import {
  BatchOperationResponseDto,
  IdDto,
  UpdateStatusDto,
} from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { WorkAuthorService } from './author.service'
import {
  AuthorPageResponseDto,
  BaseAuthorDto,
  CreateAuthorDto,
  QueryAuthorDto,
  UpdateAuthorDto,
  UpdateAuthorisRecommendedDto,
} from './dto/author.dto'

/**
 * 作者管理控制器
 * 提供作者相关的API接口
 */
@ApiTags('内容管理/作者管理')
@Controller('admin/work/author')
export class WorkAuthorController {
  constructor(private readonly authorService: WorkAuthorService) {}

  /**
   * 创建作者
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建作者',
    model: IdDto,
  })
  async create(@Body() body: CreateAuthorDto) {
    return this.authorService.createAuthor(body)
  }

  /**
   * 分页查询作者列表
   */
  @Get('/page')
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
  @Get('/detail')
  @ApiDoc({
    summary: '获取作者详情',
    model: BaseAuthorDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.authorService.getAuthorDetail(query.id)
  }

  /**
   * 更新作者信息
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新作者信息',
    model: IdDto,
  })
  async update(@Body() body: UpdateAuthorDto) {
    return this.authorService.updateAuthor(body)
  }

  /**
   * 批量更新作者状态
   */
  @Post('/update-status')
  @ApiDoc({
    summary: '更新作者状态',
    model: BatchOperationResponseDto,
  })
  async updateStatus(@Body() body: UpdateStatusDto) {
    return this.authorService.workAuthor.update({
      where: {
        id: body.id,
      },
      data: {
        isEnabled: body.isEnabled,
      },
    })
  }

  /**
   * 批量更新作者推荐状态
   */
  @Post('/update-isRecommended')
  @ApiDoc({
    summary: '更新作者推荐状态',
    model: BatchOperationResponseDto,
  })
  async updateisRecommended(@Body() body: UpdateAuthorisRecommendedDto) {
    return this.authorService.workAuthor.update({
      where: {
        id: body.id,
      },
      data: {
        isRecommended: body.isRecommended,
      },
    })
  }

  /**
   * 删除作者
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除作者',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.authorService.deleteAuthor(body.id)
  }
}
