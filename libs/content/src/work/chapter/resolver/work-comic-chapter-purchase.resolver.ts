import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { IPurchaseTargetResolver } from '@libs/interaction/purchase/interfaces/purchase-target-resolver.interface'
import { PurchaseTargetTypeEnum } from '@libs/interaction/purchase/purchase.constant'
import { PurchaseService } from '@libs/interaction/purchase/purchase.service'
import {
  BusinessErrorCode,
  ContentTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ContentPermissionService } from '../../../permission/content-permission.service'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 漫画章节购买解析器
 */
@Injectable()
export class WorkComicChapterPurchaseResolver
  implements IPurchaseTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = PurchaseTargetTypeEnum.COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = ContentTypeEnum.COMIC

  // 初始化 WorkComicChapterPurchaseResolver 依赖。
  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly drizzle: DrizzleService,
    private readonly workCounterService: WorkCounterService,
    private readonly contentPermissionService: ContentPermissionService,
  ) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取 workChapter。
  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 模块初始化时注册解析器。
  onModuleInit() {
    this.purchaseService.registerResolver(this)
  }

  // 校验是否可以购买并获取价格。
  async ensurePurchaseable(targetId: number) {
    const permission =
      await this.contentPermissionService.resolveChapterPermission(targetId)

    if (permission.workType !== this.workType) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '漫画章节不存在',
      )
    }

    if (permission.viewRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该漫画章节不支持购买',
      )
    }

    if (
      !permission.purchasePricing ||
      permission.purchasePricing.originalPrice < 0
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '漫画章节价格配置错误',
      )
    }

    return {
      originalPrice: permission.purchasePricing.originalPrice,
    }
  }

  // 更新购买计数。
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkChapterPurchaseCount(
      tx,
      targetId,
      this.workType,
      delta,
      '漫画章节不存在',
    )
  }
}
