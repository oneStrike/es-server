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

/**
 * 购买权限配置接口
 * 用于统一处理作品和章节的购买权限校验
 */
interface PurchasePermissionConfig {
  /** 购买规则：0=所有人, 1=登录用户, 2=会员, 3=购买 */
  purchaseRule: number
  /** 购买所需价格 */
  price: number | null
  /** 要求的会员等级ID */
  requiredPurchaseLevelId: number | null
  /** 要求的会员等级信息 */
  requiredPurchaseLevel: { requiredExperience: number } | null
}

/**
 * 购买服务
 * 负责处理作品和章节的购买功能，包括权限校验、购买记录管理、支付处理、退款等
 */
@Injectable()
export class PurchaseService extends BaseService {
  constructor(private readonly userPermissionService: UserPermissionService) {
    super()
  }

  /** 作品数据访问对象 */
  get work() {
    return this.prisma.work
  }

  /** 章节数据访问对象 */
  get workChapter() {
    return this.prisma.workChapter
  }

  /** 用户数据访问对象 */
  get appUser() {
    return this.prisma.appUser
  }

  /** 用户购买记录数据访问对象 */
  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  /**
   * 购买目标（作品或章节）
   * @param dto 购买记录DTO，包含 targetType（目标类型）、targetId（目标ID）、userId（用户ID）、paymentMethod（支付方式）
   * @returns 购买记录
   * @throws BadRequestException 当目标不存在、禁止购买、已购买或支付失败时抛出
   */
  async purchaseTarget(dto: PurchaseTargetDto) {
    const { targetType, targetId, userId, paymentMethod, outTradeNo } = dto

    // 根据目标类型校验购买权限，并获取价格
    let price: number
    if (
      targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER ||
      targetType === PurchaseTargetTypeEnum.NOVEL_CHAPTER
    ) {
      price = await this.validateChapterPurchasePermission(targetId, userId)
    } else if (
      targetType === PurchaseTargetTypeEnum.COMIC ||
      targetType === PurchaseTargetTypeEnum.NOVEL
    ) {
      price = await this.validateWorkPurchasePermission(targetId, userId)
    } else {
      throw new BadRequestException('不支持的目标类型')
    }

    // 检查是否已购买（幂等性保证）
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

    // 使用事务保证一致性：扣除积分/余额 + 创建购买记录 + 增加购买次数
    return this.prisma.$transaction(async (tx) => {
      // 处理支付（扣除积分或余额）
      await this.processPayment(tx, userId, price, paymentMethod)

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

      // 更新购买计数
      await this.updatePurchaseCount(tx, targetType, targetId, 1)

      return record
    })
  }

  /**
   * 校验章节购买权限
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @returns 章节价格
   * @throws BadRequestException 当章节不存在或权限不足时抛出
   */
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

  /**
   * 校验作品购买权限
   * @param workId 作品ID
   * @param userId 用户ID
   * @returns 作品价格
   * @throws BadRequestException 当作品不存在、不支持购买或用户不存在时抛出
   */
  private async validateWorkPurchasePermission(
    workId: number,
    userId: number,
  ): Promise<number> {
    const work = await this.work.findUnique({
      where: { id: workId },
      include: {
        requiredViewLevel: true,
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    // 检查作品是否已发布
    if (!work.isPublished) {
      throw new BadRequestException('该作品暂未发布')
    }

    await this.validatePurchasePermission(
      {
        purchaseRule: work.viewRule,
        price: work.price,
        requiredPurchaseLevelId: work.requiredViewLevelId,
        requiredPurchaseLevel: work.requiredViewLevel,
      },
      userId,
      '作品',
    )

    return work.price
  }

  /**
   * 校验购买权限（通用方法）
   * 只需检查价格是否有效和用户是否存在
   * @param config 购买权限配置
   * @param userId 用户ID
   * @param targetName 目标名称（用于错误提示）
   * @throws BadRequestException 当价格无效或用户不存在时抛出
   */
  private async validatePurchasePermission(
    config: PurchasePermissionConfig,
    userId: number,
    targetName: string,
  ) {
    if (config.purchaseRule !== WorkViewPermissionEnum.POINTS) {
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

  /**
   * 处理支付
   * 根据支付方式扣除用户积分或余额
   * @param tx Prisma事务客户端
   * @param userId 用户ID
   * @param price 支付金额
   * @param paymentMethod 支付方式
   * @throws BadRequestException 当余额不足或不支持的支付方式时抛出
   */
  private async processPayment(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    userId: number,
    price: number,
    paymentMethod: PaymentMethodEnum,
  ) {
    if (paymentMethod === PaymentMethodEnum.POINTS) {
      throw new BadRequestException('暂不支持积分购买')
    }

    // 余额支付
    if (paymentMethod === PaymentMethodEnum.BALANCE) {
      const user = await tx.appUser.findUnique({
        where: { id: userId },
        select: { balance: true },
      })
      if (!user || user.balance < price) {
        throw new BadRequestException('余额不足')
      }
      await tx.appUser.update({
        where: { id: userId },
        data: { balance: { decrement: price } },
      })
    }

    // 支付宝/微信支付 - 预留接口，暂不支持
    if (
      paymentMethod === PaymentMethodEnum.ALIPAY ||
      paymentMethod === PaymentMethodEnum.WECHAT
    ) {
      throw new BadRequestException('暂不支持该支付方式')
    }
  }

  /**
   * 处理退款
   * 根据原支付方式返还用户积分或余额
   * @param tx Prisma事务客户端
   * @param userId 用户ID
   * @param price 退款金额
   * @param paymentMethod 原支付方式
   */
  private async processRefund(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    userId: number,
    price: number,
    paymentMethod: PaymentMethodEnum,
  ) {
    // 积分退款
    if (paymentMethod === PaymentMethodEnum.POINTS) {
      await tx.appUser.update({
        where: { id: userId },
        data: { points: { increment: price } },
      })
    }

    // 余额退款
    if (paymentMethod === PaymentMethodEnum.BALANCE) {
      await tx.appUser.update({
        where: { id: userId },
        data: { balance: { increment: price } },
      })
    }

    // 支付宝/微信退款 - 预留接口，待后续集成
  }

  /**
   * 更新购买计数
   * @param tx Prisma事务客户端
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param increment 增量（正数增加，负数减少）
   */
  private async updatePurchaseCount(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
    increment: number,
  ) {
    if (
      targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER ||
      targetType === PurchaseTargetTypeEnum.NOVEL_CHAPTER
    ) {
      await tx.workChapter.update({
        where: { id: targetId },
        data: { purchaseCount: { increment } },
      })
    } else if (
      targetType === PurchaseTargetTypeEnum.COMIC ||
      targetType === PurchaseTargetTypeEnum.NOVEL
    ) {
      await tx.work.update({
        where: { id: targetId },
        data: { purchaseCount: { increment } },
      })
    }
  }

  /**
   * 检查用户是否已购买指定目标
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param userId 用户ID
   * @returns 是否已购买
   */
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

  /**
   * 批量检查用户购买状态
   * @param targetType 目标类型
   * @param targetIds 目标ID数组
   * @param userId 用户ID
   * @returns Map<targetId, 是否已购买>
   */
  async checkStatusBatch(
    targetType: PurchaseTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    // 查询已购买的目标ID
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

    // 构建结果Map
    const purchasedIds = new Set(purchases.map((p) => p.targetId))
    const result = new Map<number, boolean>()

    for (const id of targetIds) {
      result.set(id, purchasedIds.has(id))
    }

    return result
  }

  /**
   * 获取用户购买列表（DTO方式）
   * @param dto 查询DTO
   * @returns 分页购买记录列表
   */
  async getUserPurchases(dto: QueryUserPurchaseRecordDto) {
    return this.prisma.userPurchaseRecord.findPagination({
      where: dto,
    })
  }

  /**
   * 退款
   * @param dto 退款请求DTO，包含 purchaseId（购买记录ID）、userId（用户ID）、reason（退款原因，可选）
   * @returns 更新后的购买记录
   * @throws BadRequestException 当购买记录不存在、不属于当前用户或状态不允许退款时抛出
   */
  async refundPurchase(dto: RefundPurchaseDto) {
    const { purchaseId, userId } = dto

    // 查询购买记录
    const purchase = await this.userPurchaseRecord.findUnique({
      where: { id: purchaseId },
    })

    if (!purchase) {
      throw new BadRequestException('购买记录不存在')
    }

    // 校验记录归属用户
    if (purchase.userId !== userId) {
      throw new BadRequestException('无权操作此记录')
    }

    // 校验状态（仅成功状态可退款）
    if (purchase.status !== PurchaseStatusEnum.SUCCESS) {
      throw new BadRequestException('该记录不支持退款')
    }

    // 使用事务保证一致性：更新记录状态 + 返还积分/余额 + 减少购买次数
    return this.prisma.$transaction(async (tx) => {
      // 更新记录状态为已退款
      const updated = await tx.userPurchaseRecord.update({
        where: { id: purchaseId },
        data: {
          status: PurchaseStatusEnum.REFUNDED,
        },
      })

      // 返还积分/余额
      await this.processRefund(
        tx,
        userId,
        purchase.price,
        purchase.paymentMethod,
      )

      // 更新购买计数（减少）
      await this.updatePurchaseCount(
        tx,
        purchase.targetType,
        purchase.targetId,
        -1,
      )

      return updated
    })
  }
}
