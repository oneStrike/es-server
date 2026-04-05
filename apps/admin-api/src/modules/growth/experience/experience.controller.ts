import {
  AddUserExperienceDto,
  BaseUserExperienceRuleDto,
  CreateUserExperienceRuleDto,
  QueryUserExperienceRecordDto,
  QueryUserExperienceRuleDto,
  UpdateUserExperienceRuleDto,
  UserExperienceRecordDto,
  UserExperienceService,
} from '@libs/growth/experience'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'
import {
  UserExperienceRecordDetailDto,
  UserExperienceStatsDto,
} from './dto/experience-response.dto'

/**
 * 用户经验规则管理控制器
 * 提供经验规则的创建、更新、删除、查询等管理接口
 *
 * @class ExperienceController
 */
@Controller('admin/growth/experience-rules')
@ApiTags('用户成长/经验管理')
export class ExperienceController {
  constructor(private readonly experienceService: UserExperienceService) {}

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
  @ApiDoc({
    summary: '创建用户经验规则',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '创建用户经验规则',
  })
  async createExperienceRule(@Body() dto: CreateUserExperienceRuleDto) {
    return this.experienceService.createExperienceRule(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新用户经验规则',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新用户经验规则',
  })
  async updateExperienceRule(@Body() dto: UpdateUserExperienceRuleDto) {
    return this.experienceService.updateExperienceRule(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除用户经验规则',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除用户经验规则',
  })
  async deleteExperienceRule(@Body() dto: IdDto) {
    return this.experienceService.deleteExperienceRule(dto.id)
  }

  @Post('grant')
  @ApiDoc({
    summary: '增加用户经验',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '增加用户经验',
  })
  async grantExperience(@Body() dto: AddUserExperienceDto) {
    return this.experienceService.addExperience(dto)
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
