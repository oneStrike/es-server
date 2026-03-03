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
 * 定义章节或作品的购买相关权限属性
 */
interface PurchasePermissionConfig {
  /** 购买规则（继承/购买/免费等） */
  purchaseRule: number
  /** 价格（null 表示免费或不可购买） */
  price: number | null
  /** 要求的会员等级ID */
  requiredPurchaseLevelId: number | null
  /** 要求的会员等级信息（包含所需经验值） */
  requiredPurchaseLevel: { requiredExperience: number } | null
}

/**
 * 购买服务
 * 处理用户购买章节的核心逻辑，包括购买验证、支付处理、退款等
 */
@Injectable()
export class PurchaseService extends BaseService {
  constructor(private readonly userPermissionService: UserPermissionService) {
    super()
  }

  /** 获取作品数据访问对象 */
  get work() {
    return this.prisma.work
  }

  /** 获取作品章节数据访问对象 */
  get workChapter() {
    return this.prisma.workChapter
  }

  /** 获取APP用户数据访问对象 */
  get appUser() {
    return this.prisma.appUser
  }

  /** 获取用户购买记录数据访问对象 */
  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  /**
   * 检查当前目标是否需要购买
   */
  async checkNeedPurchase() {
    return 1
  }

  /**
   * 购买目标内容（章节）
   * @param dto - 购买请求参数
   * @returns 购买记录
   * @throws BadRequestException 目标类型不支持或购买验证失败
   */
  async purchaseTarget(dto: PurchaseTargetDto) {
    const { targetType, targetId, userId, paymentMethod, outTradeNo } = dto

    // 验证章节购买权限并获取价格
    const price = await this.validateChapterPurchasePermission(targetId, userId)

    // 检查是否已购买（防止重复购买）
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

    // 开启事务：创建购买记录、处理支付、更新购买计数
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

      // 增加章节购买计数
      await tx.workChapter.update({
        where: { id: targetId },
        data: { purchaseCount: { increment: 1 } },
      })

      return record
    })
  }

  /**
   * 验证章节购买权限
   * 检查章节是否存在、是否已发布、购买规则和价格
   * @param chapterId - 章节ID
   * @param userId - 用户ID
   * @returns 章节价格
   * @throws BadRequestException 章节不存在、未发布或不支持购买
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

    // 如果章节继承作品的权限设置，则从作品获取价格和权限
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

    // 使用章节自身的权限设置
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
   * 验证购买权限
   * 检查购买规则、价格、用户登录状态和会员等级要求
   * @param config - 购买权限配置
   * @param userId - 用户ID
   * @param targetName - 目标名称（用于错误提示）
   * @throws BadRequestException 权限验证失败
   */
  private async validatePurchasePermission(
    config: PurchasePermissionConfig,
    userId: number,
    targetName: string,
  ) {
    // 验证购买规则是否为"需要购买"
    if (config.purchaseRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BadRequestException(`该${targetName}暂不支持购买`)
    }

    // 验证价格有效性
    if (!config.price || config.price <= 0) {
      throw new BadRequestException(`该${targetName}暂不支持购买`)
    }

    // 验证用户登录状态
    await this.userPermissionService.validateViewPermission(
      WorkViewPermissionEnum.LOGGED_IN,
      userId,
    )

    // 如有会员等级要求，验证用户等级
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
   * 目前支持积分支付，后续可扩展其他支付方式
   * @param tx - 事务对象
   * @param userId - 用户ID
   * @param price - 价格
   * @param paymentMethod - 支付方式
   * @param purchaseId - 购买记录ID（用于关联积分流水）
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @throws BadRequestException 积分不足
   */
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
      // 查询用户当前积分
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

  /**
   * 处理退款
   * 退还用户支付的费用（目前仅支持积分退款）
   * @param tx - 事务对象
   * @param userId - 用户ID
   * @param price - 退款金额
   * @param paymentMethod - 支付方式
   * @param purchaseId - 购买记录ID
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   */
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
      // 查询用户当前积分
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

  /**
   * 检查购买状态
   * 查询用户是否已成功购买指定目标
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @returns true-已购买，false-未购买
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
   * 批量检查购买状态
   * 查询用户是否已成功购买多个目标
   * @param targetType - 目标类型
   * @param targetIds - 目标ID数组
   * @param userId - 用户ID
   * @returns Map<目标ID, 是否已购买>
   */
  async checkStatusBatch(
    targetType: PurchaseTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    // 批量查询购买记录
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

    // 构建购买状态映射
    const purchasedIds = new Set(purchases.map((p) => p.targetId))
    const result = new Map<number, boolean>()

    for (const id of targetIds) {
      result.set(id, purchasedIds.has(id))
    }

    return result
  }

  /**
   * 获取用户购买记录列表
   * 支持分页查询
   * @param dto - 查询参数
   * @returns 分页购买记录
   */
  async getUserPurchases(dto: QueryUserPurchaseRecordDto) {
    return this.prisma.userPurchaseRecord.findPagination({
      where: dto,
    })
  }

  /**
   * 退款
   * 处理用户退款请求，验证权限后执行退款逻辑
   * @param dto - 退款请求参数
   * @returns 更新后的购买记录
   * @throws BadRequestException 记录不存在、无权操作或状态不支持退款
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

    // 验证用户权限
    if (purchase.userId !== userId) {
      throw new BadRequestException('无权操作此记录')
    }

    // 验证退款条件：只有成功状态的记录才能退款
    if (purchase.status !== PurchaseStatusEnum.SUCCESS) {
      throw new BadRequestException('该记录不支持退款')
    }

    // 开启事务：更新购买状态、处理退款、减少购买计数
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

      // 减少章节购买计数
      await tx.workChapter.update({
        where: { id: purchase.targetId },
        data: { purchaseCount: { increment: -1 } },
      })

      return updated
    })
  }
}
