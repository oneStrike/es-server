import {
  BaseAppPageDto,
  CreateAppPageDto,
  QueryAppPageDto,
  QueryPageByCodeDto,
  UpdateAppPageDto,
} from '@libs/app-content/page/dto/page.dto'
import { AppPageService } from '@libs/app-content/page/page.service'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, IdsDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditActionTypeEnum } from '../../../common/audit/audit-action.constant'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * APP页面配置管理控制器
 * 提供页面配置的创建、更新、删除、查询等管理接口
 *
 * @class AppPageController
 */
@ApiTags('APP管理/页面管理')
@Controller('admin/app-page')
export class AppPageController {
  constructor(private readonly libAppPageService: AppPageService) {}

  @Post('create')
  @ApiAuditDoc({
    summary: '创建页面配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateAppPageDto) {
    return this.libAppPageService.createPage(body)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询页面配置列表',
    model: BaseAppPageDto,
  })
  async findPage(@Query() query: QueryAppPageDto) {
    return this.libAppPageService.findPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '根据ID查询页面配置详情',
    model: BaseAppPageDto,
  })
  async findDetail(@Query() query: IdDto) {
    return this.libAppPageService.findById(query)
  }

  // 兼容历史 `detail/code` 路由，同时提供更符合规范的 `code/detail` 入口。
  @Get('code/detail')
  @ApiDoc({
    summary: '根据页面编码查询页面配置详情',
    model: BaseAppPageDto,
  })
  async findByCode(@Query() query: QueryPageByCodeDto) {
    return this.libAppPageService.findByCode(query)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新页面配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateAppPageDto) {
    return this.libAppPageService.updatePage(body)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '批量下线页面配置',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async batchDelete(@Body() body: IdsDto) {
    return this.libAppPageService.batchDelete(body)
  }
}
