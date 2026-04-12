import { DrizzleService } from '@db/core'
import {
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '@libs/interaction/purchase/purchase.constant'
import type { PurchasePricingDto } from '@libs/interaction/purchase/dto/purchase-pricing.dto'
import { BusinessErrorCode } from '@libs/platform/constant'
import { WorkViewPermissionEnum } from '@libs/platform/constant/content.constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { PERMISSION_ERROR_MESSAGE } from './content-permission.constant'
import {
  AccessRuleContext,
  PermissionChapterData,
  ResolvedChapterPermission,
  UserWithLevel,
} from './content-permission.types'

/**
 * 章节权限校验结果
 */
export interface ChapterAccessResult<T = object> {
  /** 权限校验通过 */
  hasPermission: true
  /** 章节数据（包含权限信息 + 请求的额外字段） */
  chapter: T
}

/**
 * 内容权限服务
 *
 * 负责作品和章节的访问权限控制，支持以下权限类型：
 * - ALL: 所有人可访问（包括未登录用户）
 * - LOGGED_IN: 仅登录用户可访问
 * - MEMBER: 仅会员可访问（支持等级校验）
 * - PURCHASE: 需购买后可访问（仅章节支持）
 * - INHERIT: 继承父级权限（仅章节支持，继承作品的权限配置）
 *
 * 权限优先级：
 * 1. 预览章节：直接放行（仅章节）
 * 2. ALL / INHERIT：所有人可访问
 * 3. LOGGED_IN：需要登录
 * 4. MEMBER：需要会员等级
 * 5. PURCHASE：需要购买（仅章节）
 */
@Injectable()
export class ContentPermissionService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 用户表。 */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  /** 作品表。 */
  get work() {
    return this.drizzle.schema.work
  }

  /** 章节表。 */
  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  /** 购买记录表。 */
  get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  /**
   * 解析作品级访问权限。
   * 仅读取未软删除作品的权限快照，缺失时直接抛出业务异常，避免下游在空对象上继续推导权限。
   */
  private async resolveWorkPermission(workId: number) {
    const work = await this.db.query.work.findFirst({
      where: { id: workId, deletedAt: { isNull: true } },
      columns: {
        viewRule: true,
        requiredViewLevelId: true,
        chapterPrice: true,
        canComment: true,
      },
      with: {
        requiredViewLevel: {
          columns: { requiredExperience: true },
        },
      },
    })
    if (!work) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.WORK_NOT_FOUND,
      )
    }
    return work
  }

  /**
   * 解析章节级访问权限摘要。
   * 章节权限可能继承作品配置，因此这里会统一返回“已展开”的访问规则给下载、阅读等调用方复用。
   */
  async resolveChapterPermission(chapterId: number, userId?: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: {
        workId: true,
        workType: true,
        viewRule: true,
        requiredViewLevelId: true,
        price: true,
        canDownload: true,
        canComment: true,
        isPreview: true,
      },
      with: {
        requiredViewLevel: {
          columns: { requiredExperience: true },
        },
      },
    })
    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.CHAPTER_NOT_FOUND,
      )
    }
    return this.resolveChapterPermissionFromData(chapter, userId)
  }

  /**
   * 解析用户积分支付比例。
   * 用户未登录、无等级、等级失效或比例非法时统一按原价支付处理。
   */
  async resolveUserPurchasePayableRate(userId?: number) {
    if (!userId) {
      return 1
    }

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: {
        id: true,
      },
      with: {
        level: {
          columns: {
            purchasePayableRate: true,
            isEnabled: true,
          },
        },
      },
    })

    const rawRate = user?.level?.isEnabled
      ? user.level.purchasePayableRate
      : undefined
    const parsedRate = Number(rawRate ?? 1)

    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 1) {
      return 1
    }

    return Number(parsedRate.toFixed(2))
  }

  /**
   * 根据原价和支付比例构建统一价格读模型。
   * 折后价统一向上取整，避免低价章节被折扣直接降到 0 积分。
   */
  buildPurchasePricing(
    originalPrice: number,
    payableRate: number,
  ): PurchasePricingDto {
    const normalizedOriginalPrice = Math.max(0, Math.trunc(originalPrice))
    const normalizedRate = Number(payableRate.toFixed(2))
    const payablePrice = Math.ceil(normalizedOriginalPrice * normalizedRate)

    return {
      originalPrice: normalizedOriginalPrice,
      payableRate: normalizedRate,
      payablePrice,
      discountAmount: normalizedOriginalPrice - payablePrice,
    }
  }

  /**
   * 解析指定用户在当前原价下的购买价格。
   * 该方法供章节展示、作品展示与购买扣减链路共用，避免重复实现折扣公式。
   */
  async resolvePurchasePricing(
    originalPrice: number,
    userId?: number,
  ): Promise<PurchasePricingDto> {
    const payableRate = await this.resolveUserPurchasePayableRate(userId)
    return this.buildPurchasePricing(originalPrice, payableRate)
  }

  /**
   * 获取用户及其等级信息
   * 会员权限校验依赖等级快照，因此这里统一拉取用户与 level 关联，避免多处重复查询。
   */
  private async getUserWithLevel(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      with: {
        level: {
          columns: { requiredExperience: true },
        },
      },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.USER_NOT_FOUND,
      )
    }
    return user
  }

  /**
   * 校验用户存在。
   * 登录态入口会先通过该方法兜底，避免后续权限错误被误判成会员不足或未购买。
   */
  private async validateUserExists(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.USER_NOT_FOUND,
      )
    }
  }

  /**
   * 校验会员权限
   * 检查用户等级是否满足访问要求
   *
   * @param user 用户信息（含等级）
   * @param requiredExperience 访问所需的经验值
   * @throws BadRequestException 用户无等级或等级不足时抛出异常
   */
  private async validateMemberPermission(
    user: UserWithLevel,
    requiredExperience: number | null,
  ) {
    if (!user.levelId || !user.level) {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        PERMISSION_ERROR_MESSAGE.MEMBER_LEVEL_INSUFFICIENT,
      )
    }

    if (requiredExperience === null) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.REQUIRED_MEMBER_LEVEL_NOT_FOUND,
      )
    }

    if (user.level.requiredExperience < requiredExperience) {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        PERMISSION_ERROR_MESSAGE.MEMBER_LEVEL_INSUFFICIENT,
      )
    }
  }

  /**
   * 检查用户是否已成功购买指定章节
   * 仅成功支付的记录视为已购买，失败或关闭状态不会放行章节访问。
   */
  async validateChapterPurchasePermission(userId: number, chapterId: number) {
    const purchased = await this.db.query.userPurchaseRecord.findFirst({
      where: {
        targetType: {
          in: [
            PurchaseTargetTypeEnum.COMIC_CHAPTER,
            PurchaseTargetTypeEnum.NOVEL_CHAPTER,
          ],
        },
        targetId: chapterId,
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
    })
    return !!purchased
  }

  /**
   * 根据展开后的规则执行访问校验。
   * 该方法是作品访问、章节访问和下载校验的统一判定入口，负责把登录、会员和购买逻辑收敛到一处。
   */
  private async checkAccessPermission(
    userId: number,
    {
      scope,
      requiredExperience,
      viewRule,
      isPreview,
      chapterId,
    }: AccessRuleContext,
  ) {
    if (isPreview) {
      return true
    }

    if (viewRule === WorkViewPermissionEnum.ALL) {
      return true
    }

    if (viewRule === WorkViewPermissionEnum.INHERIT) {
      return true
    }

    if (viewRule === WorkViewPermissionEnum.LOGGED_IN) {
      await this.validateUserExists(userId)
      return true
    }

    if (viewRule === WorkViewPermissionEnum.MEMBER) {
      const user = await this.getUserWithLevel(userId)
      await this.validateMemberPermission(user, requiredExperience)
      return true
    }

    if (viewRule === WorkViewPermissionEnum.PURCHASE) {
      if (scope !== 'chapter' || !chapterId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          PERMISSION_ERROR_MESSAGE.WORK_PURCHASE_UNSUPPORTED,
        )
      }
      await this.validateUserExists(userId)
      if (!(await this.validateChapterPurchasePermission(userId, chapterId))) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          PERMISSION_ERROR_MESSAGE.CHAPTER_PURCHASE_REQUIRED,
        )
      }
      return true
    }

    throw new InternalServerErrorException(
      PERMISSION_ERROR_MESSAGE.UNKNOWN_PERMISSION_TYPE,
    )
  }

  /**
   * 检查作品访问权限（公开接口）
   * 用于业务层调用，校验用户是否有权访问指定作品
   */
  async checkWorkAccess(userId: number, workId: number) {
    const permission = await this.resolveWorkPermission(workId)
    return this.checkAccessPermission(userId, {
      scope: 'work',
      viewRule: permission.viewRule as WorkViewPermissionEnum,
      requiredExperience:
        permission.requiredViewLevel?.requiredExperience ?? null,
    })
  }

  /**
   * 检查章节访问权限（公开接口）
   * 用于业务层调用，校验用户是否有权访问指定章节
   */
  async checkChapterAccess<T extends Record<string, boolean>>(
    chapterId: number,
    userId?: number,
    select?: T,
  ): Promise<ChapterAccessResult<Record<string, unknown>>> {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      with: {
        requiredViewLevel: {
          columns: { requiredExperience: true },
        },
      },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.CHAPTER_NOT_FOUND,
      )
    }

    // 解析权限配置
    const permission = await this.resolveChapterPermissionFromData(
      chapter as PermissionChapterData,
    )
    if (
      !userId &&
      !permission.isPreview &&
      permission.viewRule !== WorkViewPermissionEnum.ALL
    ) {
      throw new UnauthorizedException(
        PERMISSION_ERROR_MESSAGE.CHAPTER_ACCESS_REQUIRED,
      )
    }

    // 执行权限校验
    await this.checkAccessPermission(userId!, {
      scope: 'chapter',
      viewRule: permission.viewRule,
      requiredExperience: permission.requiredExperience,
      chapterId,
      isPreview: permission.isPreview,
    })

    return {
      hasPermission: true,
      chapter: select
        ? Object.fromEntries(
            Object.keys(select).map((key) => [
              key,
              (chapter as Record<string, unknown>)[key],
            ]),
          )
        : (chapter as unknown as Record<string, unknown>),
    }
  }

  /**
   * 从已查询的章节数据解析权限配置
   * 避免重复查询（继承模式除外）
   *
   * @param chapter 已查询的章节数据
   * @returns 解析后的权限配置
   */
  async resolveChapterPermissionFromData(
    chapter: PermissionChapterData,
    userId?: number,
  ): Promise<ResolvedChapterPermission> {
    const payableRate = await this.resolveUserPurchasePayableRate(userId)

    if (chapter.viewRule === WorkViewPermissionEnum.INHERIT) {
      const workPermission = await this.resolveWorkPermission(chapter.workId)
      const viewRule = workPermission.viewRule as WorkViewPermissionEnum
      return {
        workType: chapter.workType,
        viewRule,
        isPreview: chapter.isPreview,
        canDownload: chapter.canDownload,
        requiredViewLevelId: workPermission.requiredViewLevelId ?? null,
        requiredExperience:
          workPermission.requiredViewLevel?.requiredExperience ?? null,
        purchasePricing:
          viewRule === WorkViewPermissionEnum.PURCHASE
            ? this.buildPurchasePricing(
                workPermission.chapterPrice,
                payableRate,
              )
            : null,
      }
    }

    const viewRule = chapter.viewRule as WorkViewPermissionEnum
    return {
      workType: chapter.workType,
      viewRule,
      isPreview: chapter.isPreview,
      canDownload: chapter.canDownload,
      requiredViewLevelId: chapter.requiredViewLevelId ?? null,
      requiredExperience: chapter.requiredViewLevel?.requiredExperience ?? null,
      purchasePricing:
        viewRule === WorkViewPermissionEnum.PURCHASE
          ? this.buildPurchasePricing(chapter.price, payableRate)
          : null,
    }
  }

  /**
   * 检查章节下载权限
   * 下载开关通过后仍需复用同一套访问规则，避免出现“可下载但不可阅读”的权限分叉。
   */
  async checkChapterDownload(
    userId: number,
    chapterId: number,
    resolvedPermission?: Awaited<
      ReturnType<ContentPermissionService['resolveChapterPermission']>
    >,
  ) {
    const permission =
      resolvedPermission ?? (await this.resolveChapterPermission(chapterId))
    if (!permission.canDownload) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        PERMISSION_ERROR_MESSAGE.CHAPTER_DOWNLOAD_FORBIDDEN,
      )
    }
    return this.checkAccessPermission(userId, {
      scope: 'chapter',
      viewRule: permission.viewRule,
      requiredExperience: permission.requiredExperience,
      chapterId,
      isPreview: false,
    })
  }
}
