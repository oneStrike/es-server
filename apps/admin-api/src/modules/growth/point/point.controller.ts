import { BaseUserPointRuleDto, CreateUserPointRuleDto, QueryUserPointRuleDto, UpdateUserPointRuleDto } from '@libs/growth/point/dto/point-rule.dto';
import { UserPointRuleService } from '@libs/growth/point/point-rule.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

/**
 * 用户积分规则管理控制器
 * 提供积分规则的创建、更新、删除、查询等管理接口
 *
 * @class PointController
 */
@Controller('admin/growth/points-rules')
@ApiTags('用户成长/积分管理')
export class PointController {
  constructor(private readonly userPointRuleService: UserPointRuleService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取积分规则分页',
    model: BaseUserPointRuleDto,
  })
  async getPointRules(@Query() query: QueryUserPointRuleDto) {
    return this.userPointRuleService.getPointRulePage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取积分规则详情',
    model: BaseUserPointRuleDto,
  })
  async getPointRule(@Query() dto: IdDto) {
    return this.userPointRuleService.getPointRuleDetail(dto.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建积分规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createPointRule(@Body() dto: CreateUserPointRuleDto) {
    return this.userPointRuleService.createPointRule(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新积分规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updatePointRule(@Body() dto: UpdateUserPointRuleDto) {
    return this.userPointRuleService.updatePointRule(dto)
  }
}
