import {
  QueryUserExperienceRecordDto,
  UserExperienceRecordDetailDto,
  UserExperienceRecordDto,
  UserExperienceStatsDto,
} from '@libs/growth/experience/dto/experience-record.dto'
import {
  BaseUserExperienceRuleDto,
  CreateUserExperienceRuleDto,
  QueryUserExperienceRuleDto,
  UpdateUserExperienceRuleDto,
} from '@libs/growth/experience/dto/experience-rule.dto'
import { UserExperienceService } from '@libs/growth/experience/experience.service'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { IdDto } from '@libs/platform/dto/base.dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { AdminAppUserGrowthRuleActionDto } from '@libs/user/dto/admin-app-user.dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { AppUserService } from '../../app-user/app-user.service'
/**
 * 用户经验规则管理控制器
 * 提供经验规则的创建、更新、删除、查询等管理接口
 *
 * @class ExperienceController
 */
@Controller('admin/growth/experience-rules')
@ApiTags('用户成长/经验管理')
export class ExperienceController {
  constructor(
    private readonly experienceService: UserExperienceService,
    private readonly appUserService: AppUserService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取用户经验规则分页',
    model: BaseUserExperienceRuleDto,
  })
  async getExperienceRules(@Query() query: QueryUserExperienceRuleDto) {
    return this.experienceService.getExperienceRulePage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取用户经验规则详情',
    model: BaseUserExperienceRuleDto,
  })
  async getExperienceRule(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRuleDetail(dto.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建用户经验规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createExperienceRule(@Body() dto: CreateUserExperienceRuleDto) {
    return this.experienceService.createExperienceRule(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新用户经验规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateExperienceRule(@Body() dto: UpdateUserExperienceRuleDto) {
    return this.experienceService.updateExperienceRule(dto)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除用户经验规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteExperienceRule(@Body() dto: IdDto) {
    return this.experienceService.deleteExperienceRule(dto.id)
  }

  @Post('grant')
  @ApiAuditDoc({
    summary: '增加用户经验',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async grantExperience(
    @Body() dto: AdminAppUserGrowthRuleActionDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.appUserService.addAppUserExperience(adminUserId, dto)
  }

  @Get('record/page')
  @ApiPageDoc({
    summary: '获取用户经验记录分页',
    model: UserExperienceRecordDto,
  })
  async getExperienceRecords(@Query() query: QueryUserExperienceRecordDto) {
    return this.experienceService.getExperienceRecordPage(query)
  }

  @Get('record/detail')
  @ApiDoc({
    summary: '获取用户经验记录详情',
    model: UserExperienceRecordDetailDto,
  })
  async getExperienceRecord(@Query() dto: IdDto) {
    return this.experienceService.getExperienceRecordDetail(dto.id)
  }

  @Get('stats')
  @ApiDoc({
    summary: '获取用户经验统计信息',
    model: UserExperienceStatsDto,
  })
  async getUserExperienceStats(@Query('userId') userId: number) {
    return this.experienceService.getUserExperienceStats(userId)
  }
}
