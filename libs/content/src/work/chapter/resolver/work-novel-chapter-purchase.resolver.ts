import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { IPurchaseTargetResolver } from '@libs/interaction/purchase/interfaces/purchase-target-resolver.interface';
import { PurchaseTargetTypeEnum } from '@libs/interaction/purchase/purchase.constant';
import { PurchaseService } from '@libs/interaction/purchase/purchase.service';
import { ContentTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant/content.constant';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 小说章节购买解析器
 */
@Injectable()
export class WorkNovelChapterPurchaseResolver
  implements IPurchaseTargetResolver, OnModuleInit
{
  /** 目标类型：小说章节 */
  readonly targetType = PurchaseTargetTypeEnum.NOVEL_CHAPTER
  /** 作品类型：2 表示小说 */
  private readonly workType = ContentTypeEnum.NOVEL

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly drizzle: DrizzleService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.purchaseService.registerResolver(this)
  }

  /**
   * 校验是否可以购买并获取价格
   */
  async ensurePurchaseable(targetId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { price: true, viewRule: true },
    })

    if (!chapter) {
      throw new NotFoundException('小说章节不存在')
    }

    if (chapter.viewRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BadRequestException('该小说章节不支持购买')
    }

    if (chapter.price < 0) {
      throw new BadRequestException('小说章节价格配置错误')
    }

    return {
      price: chapter.price,
    }
  }

  /**
   * 更新购买计数
   */
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkChapterPurchaseCount(
      tx,
      targetId,
      this.workType,
      delta,
      '小说章节不存在',
    )
  }
}
