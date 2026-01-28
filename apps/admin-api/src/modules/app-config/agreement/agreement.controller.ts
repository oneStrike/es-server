import {
  AgreementService,
  BaseAgreementDto,
  CreateAgreementDto,
  ListOrPageAgreementResponseDto,
  QueryAgreementDto,
  UpdateAgreementDto,
} from '@libs/app-config/agreement'
import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { Audit } from '../../../common/decorators/audit.decorator'
import { ActionTypeEnum } from '../../system/audit/audit.constant'

@ApiTags('客户端管理/协议管理')
@Controller('admin/agreement')
export class AgreementController {
  constructor(private readonly agreementService: AgreementService) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建协议',
    model: BaseAgreementDto,
  })
  @Audit({
    actionType: ActionTypeEnum.CREATE,
    content: '创建协议',
  })
  async create(@Body() dto: CreateAgreementDto) {
    return this.agreementService.create(dto)
  }

  @Post('/update')
  @ApiDoc({
    summary: '更新协议',
    model: BaseAgreementDto,
  })
  @Audit({
    actionType: ActionTypeEnum.UPDATE,
    content: '更新协议',
  })
  async update(@Body() dto: UpdateAgreementDto) {
    return this.agreementService.update(dto)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除协议',
    model: BaseAgreementDto,
  })
  @Audit({
    actionType: ActionTypeEnum.DELETE,
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
