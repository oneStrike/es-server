/**
 * 用户积分相关 DTO 定义
 */
import { PageDto } from '@libs/base/dto'
import { BaseUserPointRecordDto } from '@libs/user/point'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 查询我的积分记录 DTO
 *
 * 继承分页参数，并支持按规则ID、目标类型、目标ID筛选
 */
export class QueryMyPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserPointRecordDto, ['ruleId', 'targetType', 'targetId'])),
) {}
