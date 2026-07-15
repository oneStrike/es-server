import { AppAnnouncementService } from '@libs/app-content/announcement/announcement.service'
import {
  AnnouncementDetailDto,
  AnnouncementPageItemDto,
  CreateAnnouncementDto,
  QueryAnnouncementDto,
  UpdateAnnouncementDto,
} from '@libs/app-content/announcement/dto/announcement.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * 系统公告管理控制器
 * 提供公告的创建、更新、删除、查询等管理接口
 *
 * @class AppAnnouncementController
 */
@ApiTags('APP管理/系统公告')
@Controller('admin/announcement')
export class AppAnnouncementController {
  constructor(
    private readonly libAppAnnouncementService: AppAnnouncementService,
  ) {}

  @Post('create')
  @AdminPermission({
    code: 'announcement:create',
    name: '创建公告',
    groupCode: 'announcement',
  })
  @ApiAuditDoc({
    summary: '创建公告',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateAnnouncementDto) {
    return this.libAppAnnouncementService.createAnnouncement(body)
  }

  @Get('page')
  @AdminPermission({
    code: 'announcement:page',
    name: '分页查询公告列表',
    groupCode: 'announcement',
  })
  @ApiPageDoc({
    summary: '分页查询公告列表',
    model: AnnouncementPageItemDto,
  })
  async getPage(@Query() query: QueryAnnouncementDto) {
    return this.libAppAnnouncementService.findAnnouncementPage(query)
  }

  @Get('detail')
  @AdminPermission({
    code: 'announcement:detail',
    name: '公告详情',
    groupCode: 'announcement',
  })
  @ApiDoc({
    summary: '公告详情',
    model: AnnouncementDetailDto,
  })
  async findOne(@Query() query: IdDto) {
    return this.libAppAnnouncementService.findAnnouncementDetail(query)
  }

  @Post('update')
  @AdminPermission({
    code: 'announcement:update',
    name: '更新公告',
    groupCode: 'announcement',
  })
  @ApiAuditDoc({
    summary: '更新公告',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateAnnouncementDto) {
    return this.libAppAnnouncementService.updateAnnouncement(body)
  }

  @Post('update-status')
  @AdminPermission({
    code: 'announcement:update:status',
    name: '更新公告状态',
    groupCode: 'announcement',
  })
  @ApiAuditDoc({
    summary: '更新公告状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() body: UpdatePublishedStatusDto) {
    return this.libAppAnnouncementService.updateAnnouncementStatus(body)
  }

  @Post('delete')
  @AdminPermission({
    code: 'announcement:delete',
    name: '下线公告',
    groupCode: 'announcement',
  })
  @ApiAuditDoc({
    summary: '下线公告',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async remove(@Body() body: IdDto) {
    return this.libAppAnnouncementService.deleteAnnouncement(body)
  }

  @Post('retry-fanout')
  @AdminPermission({
    code: 'announcement:retry:fanout',
    name: '重试公告消息中心通知',
    groupCode: 'announcement',
  })
  @ApiAuditDoc({
    summary: '重试公告消息中心通知',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryFanout(@Body() body: IdDto) {
    return this.libAppAnnouncementService.retryAnnouncementFanout(body)
  }
}
