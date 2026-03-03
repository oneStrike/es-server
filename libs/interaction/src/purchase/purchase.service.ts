import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { UserPermissionService } from '@libs/user/permission'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  PurchaseTargetDto,
  QueryUserPurchaseRecordDto,
  RefundPurchaseDto,
} from './dto/purchase.dto'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from './purchase.constant'

interface PurchasePermissionConfig {
  purchaseRule: number
  price: number | null
  requiredPurchaseLevelId: number | null
  requiredPurchaseLevel: { requiredExperience: number } | null
}

@Injectable()
export class PurchaseService extends BaseService {
  constructor(private readonly userPermissionService: UserPermissionService) {
    super()
  }

  get work() {
    return this.prisma.work
  }

  get workChapter() {
    return this.prisma.workChapter
  }

  get appUser() {
    return this.prisma.appUser
  }

  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  async purchaseTarget(dto: PurchaseTargetDto) {
    const { targetType, targetId, userId, paymentMethod, outTradeNo } = dto

    if (
      targetType !== PurchaseTargetTypeEnum.COMIC_CHAPTER &&
      targetType !== PurchaseTargetTypeEnum.NOVEL_CHAPTER
    ) {
      throw new BadRequestException('不支持的目标类型')
    }

    const price = await this.validateChapterPurchasePermission(targetId, userId)

    const existingPurchase = await this.userPurchaseRecord.findFirst({
      where: {
        targetType,
        targetId,
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
    })
    if (existingPurchase) {
      return existingPurchase
    }

    return this.prisma.$transaction(async (tx) => {
      // 创建购买记录
      const record = await tx.userPurchaseRecord.create({
        data: {
          targetType,
          targetId,
          userId,
          price,
          status: PurchaseStatusEnum.SUCCESS,
          paymentMethod,
          outTradeNo,
        },
      })

      // 处理支付，积分流水通过 purchaseId 关联到购买记录
      await this.processPayment(
        tx,
        userId,
        price,
        paymentMethod,
        record.id,
        targetType,
        targetId,
      )

      await tx.workChapter.update({
        where: { id: targetId },
        data: { purchaseCount: { increment: 1 } },
      })

      return record
    })
  }

  private async validateChapterPurchasePermission(
    chapterId: number,
    userId: number,
  ) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      include: {
        requiredViewLevel: true,
      },
    })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!chapter.isPublished) {
      throw new BadRequestException('该章节暂未发布')
    }

    if (chapter.viewRule === WorkViewPermissionEnum.INHERIT) {
      const work = await this.work.findUnique({
        where: { id: chapter.workId },
        include: {
          requiredViewLevel: true,
        },
      })

      if (!work) {
        throw new BadRequestException('作品不存在')
      }

      await this.validatePurchasePermission(
        {
          purchaseRule: work.viewRule,
          price: work.chapterPrice,
          requiredPurchaseLevelId: work.requiredViewLevelId,
          requiredPurchaseLevel: work.requiredViewLevel,
        },
        userId,
        '章节',
      )

      return work.chapterPrice
    }

    await this.validatePurchasePermission(
      {
        purchaseRule: chapter.viewRule,
        price: chapter.price,
        requiredPurchaseLevelId: chapter.requiredViewLevelId,
        requiredPurchaseLevel: chapter.requiredViewLevel,
      },
      userId,
      '章节',
    )

    return chapter.price
  }

  private async validatePurchasePermission(
    config: PurchasePermissionConfig,
    userId: number,
    targetName: string,
  ) {
    if (config.purchaseRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BadRequestException(`该${targetName}暂不支持购买`)
    }

    if (!config.price || config.price <= 0) {
      throw new BadRequestException(`该${targetName}暂不支持购买`)
    }

    await this.userPermissionService.validateViewPermission(
      WorkViewPermissionEnum.LOGGED_IN,
      userId,
    )

    if (config.requiredPurchaseLevelId) {
      await this.userPermissionService.validateViewPermission(
        WorkViewPermissionEnum.MEMBER,
        userId,
        config.requiredPurchaseLevelId,
      )
    }
  }

  private async processPayment(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    userId: number,
    price: number,
    paymentMethod: PaymentMethodEnum,
    purchaseId: number,
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
  ): Promise<void> {
    if (paymentMethod === PaymentMethodEnum.POINTS) {
      const user = await tx.appUser.findUnique({
        where: { id: userId },
        select: { points: true },
      })
      if (!user || user.points < price) {
        throw new BadRequestException('积分不足')
      }

      const beforePoints = user.points
      const afterPoints = beforePoints - price

      // 扣减积分
      await tx.appUser.update({
        where: { id: userId },
        data: { points: afterPoints },
      })

      // 创建积分流水记录，通过 purchaseId 关联购买记录
      await tx.userPointRecord.create({
        data: {
          userId,
          points: -price,
          beforePoints,
          afterPoints,
          purchaseId,
          targetType,
          targetId,
          remark: '购买章节',
        },
      })
    }
  }

  private async processRefund(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    userId: number,
    price: number,
    paymentMethod: PaymentMethodEnum,
    purchaseId: number,
    targetType: number,
    targetId: number,
  ): Promise<void> {
    if (paymentMethod === PaymentMethodEnum.POINTS) {
      const user = await tx.appUser.findUnique({
        where: { id: userId },
        select: { points: true },
      })

      const beforePoints = user?.points ?? 0
      const afterPoints = beforePoints + price

      // 退还积分
      await tx.appUser.update({
        where: { id: userId },
        data: { points: afterPoints },
      })

      // 创建积分流水记录，通过 purchaseId 关联购买记录
      await tx.userPointRecord.create({
        data: {
          userId,
          points: price, // 正数表示获得
          beforePoints,
          afterPoints,
          purchaseId,
          targetType,
          targetId,
          remark: '退款返还',
        },
      })
    }
  }

  async checkPurchaseStatus(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    const purchase = await this.userPurchaseRecord.findFirst({
      where: {
        targetType,
        targetId,
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
    })
    return !!purchase
  }

  async checkStatusBatch(
    targetType: PurchaseTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const purchases = await this.userPurchaseRecord.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
      select: {
        targetId: true,
      },
    })

    const purchasedIds = new Set(purchases.map((p) => p.targetId))
    const result = new Map<number, boolean>()

    for (const id of targetIds) {
      result.set(id, purchasedIds.has(id))
    }

    return result
  }

  async getUserPurchases(dto: QueryUserPurchaseRecordDto) {
    return this.prisma.userPurchaseRecord.findPagination({
      where: dto,
    })
  }

  async refundPurchase(dto: RefundPurchaseDto) {
    const { purchaseId, userId } = dto

    const purchase = await this.userPurchaseRecord.findUnique({
      where: { id: purchaseId },
    })

    if (!purchase) {
      throw new BadRequestException('购买记录不存在')
    }

    if (purchase.userId !== userId) {
      throw new BadRequestException('无权操作此记录')
    }

    if (purchase.status !== PurchaseStatusEnum.SUCCESS) {
      throw new BadRequestException('该记录不支持退款')
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.userPurchaseRecord.update({
        where: { id: purchaseId },
        data: {
          status: PurchaseStatusEnum.REFUNDED,
        },
      })

      // 处理退款，积分流水通过 purchaseId 关联到购买记录
      await this.processRefund(
        tx,
        userId,
        purchase.price,
        purchase.paymentMethod,
        purchaseId,
        purchase.targetType,
        purchase.targetId,
      )

      await tx.workChapter.update({
        where: { id: purchase.targetId },
        data: { purchaseCount: { increment: -1 } },
      })

      return updated
    })
  }
}
