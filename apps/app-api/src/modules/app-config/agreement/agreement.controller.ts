import {
  AgreementService,
  BaseAgreementDto,
  ListOrPageAgreementResponseDto,
  QueryPublishedAgreementDto,
} from '@libs/app-config/agreement'
import { ApiDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('客户端/协议管理')
@Controller('app/agreement')
export class AgreementController {
  constructor(private readonly agreementService: AgreementService) {}

  @Get('/allLatest')
  @ApiDoc({
    summary: '获取所有已发布的协议列表',
    model: ListOrPageAgreementResponseDto,
    isArray: true,
  })
  async getAllLatest(@Query() query: QueryPublishedAgreementDto) {
    return this.agreementService.getAllLatest(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取协议详情',
    model: BaseAgreementDto,
  })
  async findOne(@Query() query: IdDto) {
    return this.agreementService.findOne(query)
  }
}
