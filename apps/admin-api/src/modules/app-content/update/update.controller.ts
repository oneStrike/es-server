import {
  AppUpdateReleaseDetailDto,
  AppUpdateReleaseListItemDto,
  CreateAppUpdateReleaseDto,
  QueryAppUpdateReleaseDto,
  UpdateAppUpdateReleaseDto,
} from '@libs/app-content/update/dto/update.dto'
import { AppUpdateService } from '@libs/app-content/update/update.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * App 更新管理控制器。
 * 负责后台版本发布草稿的读写与发布状态切换。
 */
@ApiTags('APP管理/版本更新')
@Controller('admin/app-update')
export class AppUpdateController {
  constructor(private readonly appUpdateService: AppUpdateService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询更新版本列表',
    model: AppUpdateReleaseListItemDto,
  })
  async getPage(@Query() query: QueryAppUpdateReleaseDto) {
    return this.appUpdateService.findPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取更新版本详情',
    model: AppUpdateReleaseDetailDto,
  })
  async detail(@Query() query: IdDto) {
    return this.appUpdateService.findDetail(query)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建更新版本草稿',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(
    @Body() body: CreateAppUpdateReleaseDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUpdateService.create(body, userId)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新更新版本草稿',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(
    @Body() body: UpdateAppUpdateReleaseDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUpdateService.update(body, userId)
  }

  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新更新版本发布状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(
    @Body() body: UpdatePublishedStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.appUpdateService.updatePublishStatus(body, userId)
  }
}
