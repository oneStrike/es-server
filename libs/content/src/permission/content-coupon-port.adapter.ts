import type { DbTransaction } from '@db/core'
import type {
  CouponContentPort,
  GrantCouponReadingEntitlementInput,
} from '@libs/interaction/coupon/types/coupon-content-port.type'
import { CouponRedemptionTargetTypeEnum } from '@libs/interaction/coupon/coupon.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementTargetTypeEnum,
} from './content-entitlement.constant'
import { ContentEntitlementService } from './content-entitlement.service'

/** 内容域对阅读券内容端口的具体实现。 */
@Injectable()
export class ContentCouponPortAdapter implements CouponContentPort {
  // 初始化内容权益 owner。
  constructor(
    private readonly contentEntitlementService: ContentEntitlementService,
  ) {}

  // 在券核销事务中写入阅读券的内容权益事实。
  async grantReadingEntitlement(
    tx: DbTransaction,
    input: GrantCouponReadingEntitlementInput,
  ): Promise<void> {
    await this.contentEntitlementService.grantEntitlement(tx, {
      userId: input.userId,
      targetType: this.toContentTargetType(input.targetType),
      targetId: input.targetId,
      grantSource: ContentEntitlementGrantSourceEnum.COUPON,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      expiresAt: input.expiresAt,
      grantSnapshot: input.grantSnapshot,
    })
  }

  // 将券核销的章节目标收窄为内容权益闭集，保留历史错误语义。
  private toContentTargetType(targetType: CouponRedemptionTargetTypeEnum) {
    if (targetType === CouponRedemptionTargetTypeEnum.COMIC_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.COMIC_CHAPTER
    }
    if (targetType === CouponRedemptionTargetTypeEnum.NOVEL_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '目标类型不支持内容权益',
    )
  }
}
