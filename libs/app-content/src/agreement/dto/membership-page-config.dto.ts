import {
  MembershipPageConfigOutputBaseDto,
  MembershipPageConfigPlansDto,
  MembershipPlanBenefitItemDto,
  MembershipPlanOutputDto,
  MembershipSubscriptionSummaryDto,
} from '@libs/interaction/membership/dto/membership.dto'
import { ArrayProperty, NestedProperty } from '@libs/platform/decorators'
import { IntersectionType } from '@nestjs/swagger'
import { AgreementListItemDto } from './agreement.dto'

export class MembershipPageConfigAgreementsDto {
  @ArrayProperty({
    description: '关联协议列表',
    itemClass: AgreementListItemDto,
    required: true,
    validation: false,
  })
  agreements!: AgreementListItemDto[]
}

export class MembershipPageConfigDisplayRelationsDto extends IntersectionType(
  MembershipPageConfigAgreementsDto,
  MembershipPageConfigPlansDto,
) {}

export class MembershipPageConfigItemDto extends IntersectionType(
  MembershipPageConfigOutputBaseDto,
  MembershipPageConfigDisplayRelationsDto,
) {}

export class VipSubscriptionPageDto {
  @NestedProperty({
    description: '页面配置',
    type: MembershipPageConfigItemDto,
    validation: false,
  })
  pageConfig!: MembershipPageConfigItemDto

  @ArrayProperty({
    description: '启用 VIP 套餐列表',
    itemClass: MembershipPlanOutputDto,
    validation: false,
  })
  plans!: MembershipPlanOutputDto[]

  @ArrayProperty({
    description: '套餐权益列表',
    itemClass: MembershipPlanBenefitItemDto,
    validation: false,
  })
  benefits!: MembershipPlanBenefitItemDto[]

  @NestedProperty({
    description: '当前用户订阅摘要',
    type: MembershipSubscriptionSummaryDto,
    validation: false,
  })
  currentSubscription!: MembershipSubscriptionSummaryDto
}
