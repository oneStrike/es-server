import { AgreementService } from '@libs/app-content/agreement/agreement.service'
import {
  AgreementListItemDto,
  BaseAgreementDto,
  CreateAgreementDto,
  QueryAgreementDto,
  UpdateAgreementDto,
} from '@libs/app-content/agreement/dto/agreement.dto'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto/base.dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { Audit } from '../../../common/decorators/audit.decorator'

/**
 * 协议管理控制器
 * 提供协议的创建、更新、删除、查询等管理接口
 *
 * @class AgreementController
 */
@ApiTags('APP管理/协议管理')
@Controller('admin/agreement')
export class AgreementController {
  constructor(private readonly agreementService: AgreementService) {}

  @Post('create')
  @ApiAuditDoc({
    summary: '创建协议',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() dto: CreateAgreementDto) {
    return this.agreementService.create(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新协议',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() dto: UpdateAgreementDto) {
    return this.agreementService.update(dto)
  }

  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新协议状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateStatus(@Body() dto: UpdatePublishedStatusDto) {
    return this.agreementService.updatePublishStatus(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '下线协议',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除协议',
  })
  async delete(@Body() dto: IdDto) {
    return this.agreementService.delete(dto)
  }

  @Get('page')
  @ApiPageDoc({
    summary: '查询协议分页',
    model: AgreementListItemDto,
  })
  async list(@Query() query: QueryAgreementDto) {
    return this.agreementService.findPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取协议详情',
    model: BaseAgreementDto,
  })
  async detail(@Query() query: IdDto) {
    return this.agreementService.findOne(query)
  }
}
