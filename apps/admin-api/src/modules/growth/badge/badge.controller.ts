import { AssignUserBadgeDto, BadgeUserPageItemDto, CreateUserBadgeDto, QueryBadgeUserPageDto, QueryUserBadgeDto, UpdateUserBadgeDto, UpdateUserBadgeStatusDto, UserBadgeStatisticsDto } from '@libs/growth/badge/dto/user-badge-management.dto';
import { BaseUserBadgeDto } from '@libs/growth/badge/dto/user-badge.dto';
import { UserBadgeService } from '@libs/growth/badge/user-badge.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

/**
 * 用户徽章管理控制器
 * 提供徽章的创建、更新、删除、分配等管理接口
 *
 * @class UserBadgeController
 */
@Controller('admin/growth/badges')
@ApiTags('用户成长/徽章管理')
export class UserBadgeController {
  constructor(private readonly userBadgeService: UserBadgeService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取用户徽章分页',
    model: BaseUserBadgeDto,
  })
  async getAllBadges(@Query() query: QueryUserBadgeDto) {
    return this.userBadgeService.getBadges(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取用户徽章详情',
    model: BaseUserBadgeDto,
  })
  async getBadge(@Query() dto: IdDto) {
    return this.userBadgeService.getBadgeDetail(dto)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建用户徽章',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createBadge(@Body() dto: CreateUserBadgeDto) {
    return this.userBadgeService.createBadge(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新用户徽章',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateBadge(@Body() dto: UpdateUserBadgeDto) {
    return this.userBadgeService.updateBadge(dto)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除用户徽章',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteBadge(@Body() dto: IdDto) {
    return this.userBadgeService.deleteBadge(dto)
  }

  @Post('update-status')
  @ApiAuditDoc({
    summary: '更新用户徽章状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateBadgeStatus(@Body() dto: UpdateUserBadgeStatusDto) {
    return this.userBadgeService.updateBadgeStatus(dto)
  }

  @Post('assign')
  @ApiAuditDoc({
    summary: '为用户分配用户徽章',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async assignBadge(@Body() dto: AssignUserBadgeDto) {
    return this.userBadgeService.assignBadge(dto)
  }

  @Post('revoke')
  @ApiAuditDoc({
    summary: '撤销用户徽章',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async revokeBadge(@Body() dto: AssignUserBadgeDto) {
    return this.userBadgeService.revokeBadge(dto)
  }

  @Get('user/page')
  @ApiPageDoc({
    summary: '获取拥有某个用户徽章的用户列表',
    model: BadgeUserPageItemDto,
  })
  async getBadgeUsers(@Query() query: QueryBadgeUserPageDto) {
    return this.userBadgeService.getBadgeUsers(query)
  }

  @Get('stats')
  @ApiDoc({
    summary: '获取用户徽章统计信息',
    model: UserBadgeStatisticsDto,
  })
  async getBadgeStatistics() {
    return this.userBadgeService.getBadgeStatistics()
  }
}
