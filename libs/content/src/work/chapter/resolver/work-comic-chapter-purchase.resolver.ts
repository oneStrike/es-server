import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  IPurchaseTargetResolver,
  PurchaseService,
  PurchaseTargetTypeEnum,
} from '@libs/interaction'
import { ContentTypeEnum, WorkViewPermissionEnum } from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 漫画章节购买解析器
 */
@Injectable()
export class WorkComicChapterPurchaseResolver
  extends PlatformService
  implements IPurchaseTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = PurchaseTargetTypeEnum.COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = ContentTypeEnum.COMIC

  constructor(private readonly purchaseService: PurchaseService) {
    super()
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
    const chapter = await this.prisma.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      select: { price: true, viewRule: true },
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
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await tx.workChapter.applyCountDelta(
      {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      'purchaseCount',
      delta,
    )
  }
}
