import {
  AgreementService,
  BaseAgreementDto,
} from '@libs/app-content'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'

import { AuditActionTypeEnum } from '../../system/audit/audit.constant'
import {
  CreateAgreementDto,
  ListOrPageAgreementResponseDto,
  QueryAgreementDto,
  UpdateAgreementDto,
} from './dto/agreement.dto'

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

  @Post('/create')
  @ApiDoc({
    summary: '创建协议',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '创建协议',
  })
  async create(@Body() dto: CreateAgreementDto) {
    return this.agreementService.create(dto)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新协议',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新协议',
  })
  async update(@Body() dto: UpdateAgreementDto) {
    return this.agreementService.update(dto)
  }

  @Post('/update-status')
  @ApiDoc({
    summary: '更新协议状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新协议状态',
  })
  async updateStatus(@Body() dto: UpdatePublishedStatusDto) {
    return this.agreementService.updatePublishStatus(dto)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除协议',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除协议',
  })
  async delete(@Body() dto: IdDto) {
    return this.agreementService.delete(dto)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '查询协议分页',
    model: ListOrPageAgreementResponseDto,
  })
  async list(@Query() query: QueryAgreementDto) {
    return this.agreementService.findPage(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取协议详情',
    model: BaseAgreementDto,
  })
  async detail(@Query() query: IdDto) {
    return this.agreementService.findOne(query)
  }
}
