import { WorkAuthorService } from '@libs/content/author/author.service';
import { AuthorFollowCountRepairResultDto, AuthorPageResponseDto, AuthorWorkCountRepairResultDto, BaseAuthorDto, CreateAuthorDto, QueryAuthorDto, UpdateAuthorDto, UpdateAuthorRecommendedDto, UpdateAuthorStatusDto } from '@libs/content/author/dto/author.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
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
