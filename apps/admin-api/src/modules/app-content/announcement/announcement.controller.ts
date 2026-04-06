import { AppAnnouncementService } from '@libs/app-content/announcement/announcement.service';
import { AnnouncementDetailDto, BaseAnnouncementDto, CreateAnnouncementDto, QueryAnnouncementDto, UpdateAnnouncementDto } from '@libs/app-content/announcement/dto/announcement.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

/**
 * 系统公告管理控制器
 * 提供公告的创建、更新、删除、查询等管理接口
 *
 * @class AppAnnouncementController
 */
@ApiTags('APP管理/系统公告')
@Controller('admin/announcement')
export class AppAnnouncementController {
  constructor(private readonly libAppAnnouncementService: AppAnnouncementService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建公告',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '创建公告',
  })
  async create(@Body() body: CreateAnnouncementDto) {
    return this.libAppAnnouncementService.createAnnouncement(body)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询公告列表',
    model: BaseAnnouncementDto,
  })
  async getPage(@Query() query: QueryAnnouncementDto) {
    return this.libAppAnnouncementService.findAnnouncementPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '公告详情',
    model: AnnouncementDetailDto,
  })
  async findOne(@Query() query: IdDto) {
    return this.libAppAnnouncementService.findAnnouncementDetail(query)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新公告',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新公告',
  })
  async update(@Body() body: UpdateAnnouncementDto) {
    return this.libAppAnnouncementService.updateAnnouncement(body)
  }

  @Post('update-status')
  @ApiDoc({
    summary: '更新公告状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新公告状态',
  })
  async updateStatus(@Body() body: UpdatePublishedStatusDto) {
    return this.libAppAnnouncementService.updateAnnouncementStatus(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '下线公告',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '下线公告',
  })
  async remove(@Body() body: IdDto) {
    return this.libAppAnnouncementService.deleteAnnouncement(body)
  }
}
