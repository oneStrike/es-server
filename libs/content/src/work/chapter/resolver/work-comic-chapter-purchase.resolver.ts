import { DrizzleService } from '@db/core'
import {
  InteractionTx,
  IPurchaseTargetResolver,
  PurchaseService,
  PurchaseTargetTypeEnum,
} from '@libs/interaction'
import { ContentTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

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

  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly drizzle: DrizzleService,
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
      throw new BadRequestException('漫画章节不存在')
    }

    if (chapter.viewRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BadRequestException('该漫画章节不支持购买')
    }

    if (chapter.price < 0) {
      throw new BadRequestException('漫画章节价格配置错误')
    }

    return {
      price: chapter.price,
    }
  }

  /**
   * 更新购买计数
   */
  async applyCountDelta(
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await tx
      .update(this.workChapter)
      .set({
        purchaseCount: sql`${this.workChapter.purchaseCount} + ${delta}`,
      })
      .where(
        and(
          eq(this.workChapter.id, targetId),
          eq(this.workChapter.workType, this.workType),
          isNull(this.workChapter.deletedAt),
        ),
      )
  }
}
