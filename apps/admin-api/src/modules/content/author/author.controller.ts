import { WorkAuthorService } from '@libs/content/author/author.service'
import {
  AuthorFollowCountRepairResultDto,
  AuthorOutputBaseDto,
  AuthorPageResponseDto,
  AuthorWorkCountRepairResultDto,
  CreateAuthorDto,
  QueryAuthorDto,
  UpdateAuthorDto,
  UpdateAuthorRecommendedDto,
  UpdateAuthorStatusDto,
} from '@libs/content/author/dto/author.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

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
  @AdminPermission({
    code: 'content:author:create',
    name: '创建作者',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '创建作者',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateAuthorDto) {
    return this.authorService.createAuthor(body)
  }

  /**
   * 分页查询作者列表
   */
  @Get('page')
  @AdminPermission({
    code: 'content:author:page',
    name: '分页查询作者列表',
    groupCode: 'content:author',
  })
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
  @AdminPermission({
    code: 'content:author:detail',
    name: '获取作者详情',
    groupCode: 'content:author',
  })
  @ApiDoc({
    summary: '获取作者详情',
    model: AuthorOutputBaseDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.authorService.getAuthorDetail(query)
  }

  /**
   * 更新作者信息
   */
  @Post('update')
  @AdminPermission({
    code: 'content:author:update',
    name: '更新作者信息',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '更新作者信息',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateAuthorDto) {
    return this.authorService.updateAuthor(body)
  }

  /**
   * 更新作者状态
   */
  @Post('update-status')
  @AdminPermission({
    code: 'content:author:update:status',
    name: '更新作者状态',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '更新作者状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() body: UpdateAuthorStatusDto) {
    return this.authorService.updateAuthorStatus(body)
  }

  /**
   * 批量更新作者推荐状态
   */
  @Post('update-recommended')
  @AdminPermission({
    code: 'content:author:update:recommended',
    name: '更新作者推荐状态',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '更新作者推荐状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateRecommended(@Body() body: UpdateAuthorRecommendedDto) {
    return this.authorService.updateAuthorRecommended(body)
  }

  @Post('rebuild-follow-count')
  @AdminPermission({
    code: 'content:author:rebuild:follow:count',
    name: '重建作者关注计数',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '重建作者关注计数',
    model: AuthorFollowCountRepairResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildFollowCount(@Body() body: IdDto) {
    return this.authorService.rebuildAuthorFollowersCountById(body)
  }

  @Post('rebuild-follow-count-all')
  @AdminPermission({
    code: 'content:author:rebuild:follow:count:all',
    name: '全量重建作者关注计数',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '全量重建作者关注计数',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildFollowCountAll() {
    return this.authorService.rebuildAllAuthorFollowersCount()
  }

  @Post('rebuild-work-count')
  @AdminPermission({
    code: 'content:author:rebuild:work:count',
    name: '重建作者作品计数',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '重建作者作品计数',
    model: AuthorWorkCountRepairResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildWorkCount(@Body() body: IdDto) {
    return this.authorService.rebuildAuthorWorkCountById(body)
  }

  @Post('rebuild-work-count-all')
  @AdminPermission({
    code: 'content:author:rebuild:work:count:all',
    name: '全量重建作者作品计数',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '全量重建作者作品计数',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildWorkCountAll() {
    return this.authorService.rebuildAllAuthorWorkCount()
  }

  /**
   * 删除作者
   */
  @Post('delete')
  @AdminPermission({
    code: 'content:author:delete',
    name: '删除作者',
    groupCode: 'content:author',
  })
  @ApiAuditDoc({
    summary: '删除作者',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(@Body() body: IdDto) {
    return this.authorService.deleteAuthor(body)
  }
}
