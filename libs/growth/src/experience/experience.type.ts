import type { UserGrowthRuleActionDto } from '../growth/dto/growth-shared.dto'
import type { QueryUserExperienceRecordDto } from './dto/experience-record.dto'

/** 经验记录查询条件，排除分页和排序参数。 */
export type ExperienceRecordQueryConditions = Omit<
  QueryUserExperienceRecordDto,
  'pageIndex' | 'orderBy'
>

/** 手动发放经验上下文入参。 */
export type ManualAddExperienceInput = Pick<
  UserGrowthRuleActionDto,
  'operationNote'
> & {
  context?: Record<string, unknown>
  adminUserId?: number
}
