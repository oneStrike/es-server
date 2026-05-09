import { DrizzleService } from '@db/core'
import {
  BusinessErrorCode,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { ContentEntitlementTargetTypeEnum } from './content-entitlement.constant'
import { ContentEntitlementService } from './content-entitlement.service'
import { PERMISSION_ERROR_MESSAGE } from './content-permission.constant'
import {
  AccessRuleContext,
  ChapterAccessResult,
  PermissionChapterData,
  PurchasePricingSnapshot,
  ResolvedChapterPermission,
} from './content-permission.type'
import { MembershipEntitlementService } from './membership-entitlement.service'

/**
 * 内容权限服务
 *
 * 负责作品和章节的访问权限控制，支持以下权限类型：
 * - ALL: 所有人可访问（包括未登录用户）
 * - LOGGED_IN: 仅登录用户可访问
 * - VIP: 仅 VIP 订阅用户可访问
 * - PURCHASE: 需购买后可访问（仅章节支持）
 * - INHERIT: 继承父级权限（仅章节支持，继承作品的权限配置）
 *
 * 权限优先级：
 * 1. 预览章节：直接放行（仅章节）
 * 2. ALL / INHERIT：所有人可访问
 * 3. LOGGED_IN：需要登录
 * 4. VIP：需要有效 VIP 订阅
 * 5. PURCHASE：需要购买（仅章节）
 */
@Injectable()
export class ContentPermissionService {
  // 初始化 ContentPermissionService 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly contentEntitlementService: ContentEntitlementService,
    private readonly membershipEntitlementService: MembershipEntitlementService,
  ) {}

  // 数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 用户表。
  get appUser() {
    return this.drizzle.schema.appUser
  }

  // 作品表。
  get work() {
    return this.drizzle.schema.work
  }

  // 章节表。
  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 解析作品级访问权限，仅读取未软删除作品的权限快照，缺失时直接抛出业务异常，避免下游在空对象上继续推导权限。
  private async resolveWorkPermission(workId: number) {
    const work = await this.db.query.work.findFirst({
      where: { id: workId, deletedAt: { isNull: true } },
      columns: {
        viewRule: true,
        chapterPrice: true,
        canComment: true,
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

  // 解析章节级访问权限摘要，章节权限可能继承作品配置，因此这里会统一返回“已展开”的访问规则给下载、阅读等调用方复用。
  async resolveChapterPermission(chapterId: number, _userId?: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: {
        workId: true,
        workType: true,
        viewRule: true,
        price: true,
        canDownload: true,
        canComment: true,
        isPreview: true,
      },
    })
    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.CHAPTER_NOT_FOUND,
      )
    }
    return this.resolveChapterPermissionFromData(chapter)
  }

  // 根据章节原价构建统一价格读模型，首轮不再读取等级折扣，折扣券另由购买链路写入价格快照。
  buildPurchasePricing(originalPrice: number): PurchasePricingSnapshot {
    const normalizedOriginalPrice = Math.max(0, Math.trunc(originalPrice))

    return {
      originalPrice: normalizedOriginalPrice,
      payableRate: 1,
      payablePrice: normalizedOriginalPrice,
      discountAmount: 0,
    }
  }

  // 解析指定用户在当前原价下的购买价格，该方法供章节展示、作品展示与购买扣减链路共用。
  async resolvePurchasePricing(originalPrice: number) {
    return this.buildPurchasePricing(originalPrice)
  }

  // 校验用户存在，登录态入口会先通过该方法兜底，避免后续权限错误被误判成会员不足或未购买。
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

  // 校验 VIP 权限，只读取订阅事实，不再使用成长等级。
  private async validateVipPermission(userId: number) {
    await this.validateUserExists(userId)
    if (
      !(await this.membershipEntitlementService.hasActiveSubscription(userId))
    ) {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        PERMISSION_ERROR_MESSAGE.VIP_SUBSCRIPTION_REQUIRED,
      )
    }
  }

  // 检查用户是否拥有指定章节的有效购买权益，购买记录不再直接参与 purchased 判定。
  async validateChapterPurchasePermission(userId: number, chapterId: number) {
    const permission = await this.resolveChapterPermission(chapterId)
    const targetType = this.resolveChapterEntitlementTargetType(
      permission.workType,
    )
    if (!targetType) {
      return false
    }
    return this.contentEntitlementService.hasPurchaseEntitlement({
      targetType,
      targetId: chapterId,
      userId,
    })
  }

  // 将内容作品类型映射为内容权益目标类型。
  resolveChapterEntitlementTargetType(workType: number) {
    if (workType === 1) {
      return ContentEntitlementTargetTypeEnum.COMIC_CHAPTER
    }
    if (workType === 2) {
      return ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER
    }
    return null
  }

  // 根据展开后的规则执行访问校验，该方法是作品访问、章节访问和下载校验的统一判定入口，负责把登录、会员和购买逻辑收敛到一处。
  private async checkAccessPermission(
    userId: number,
    { scope, viewRule, isPreview, chapterId }: AccessRuleContext,
  ) {
    if (isPreview) {
      return true
    }

    switch (viewRule) {
      case WorkViewPermissionEnum.ALL:
      case WorkViewPermissionEnum.INHERIT:
        return true
      case WorkViewPermissionEnum.LOGGED_IN:
        await this.validateUserExists(userId)
        return true
      case WorkViewPermissionEnum.VIP: {
        await this.validateVipPermission(userId)
        return true
      }
      case WorkViewPermissionEnum.PURCHASE:
        if (scope !== 'chapter' || !chapterId) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            PERMISSION_ERROR_MESSAGE.WORK_PURCHASE_UNSUPPORTED,
          )
        }
        await this.validateUserExists(userId)
        if (
          !(await this.contentEntitlementService.hasActiveEntitlement({
            targetType:
              await this.resolveChapterEntitlementTargetTypeById(chapterId),
            targetId: chapterId,
            userId,
          }))
        ) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            PERMISSION_ERROR_MESSAGE.CHAPTER_PURCHASE_REQUIRED,
          )
        }
        return true
      default:
        throw new InternalServerErrorException(
          PERMISSION_ERROR_MESSAGE.UNKNOWN_PERMISSION_TYPE,
        )
    }
  }

  // 检查作品访问权限（公开接口），用于业务层调用，校验用户是否有权访问指定作品。
  async checkWorkAccess(userId: number, workId: number) {
    const permission = await this.resolveWorkPermission(workId)
    return this.checkAccessPermission(userId, {
      scope: 'work',
      viewRule: permission.viewRule as WorkViewPermissionEnum,
      requiredExperience: null,
    })
  }

  // 检查章节访问权限（公开接口），用于业务层调用，校验用户是否有权访问指定章节。
  async checkChapterAccess<T extends Record<string, boolean>>(
    chapterId: number,
    userId?: number,
    select?: T,
  ): Promise<ChapterAccessResult<Record<string, unknown>>> {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
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
        : (chapter as Record<string, unknown>),
    }
  }

  // 从已查询的章节数据解析权限配置，避免重复查询（继承模式除外）。
  async resolveChapterPermissionFromData(
    chapter: PermissionChapterData,
  ): Promise<ResolvedChapterPermission> {
    let viewRule = chapter.viewRule as WorkViewPermissionEnum
    let purchasePrice = chapter.price

    if (chapter.viewRule === WorkViewPermissionEnum.INHERIT) {
      const workPermission = await this.resolveWorkPermission(chapter.workId)
      viewRule = workPermission.viewRule as WorkViewPermissionEnum
      purchasePrice = workPermission.chapterPrice
    }

    return {
      workType: chapter.workType,
      viewRule,
      isPreview: chapter.isPreview,
      canDownload: chapter.canDownload,
      requiredViewLevelId: null,
      requiredExperience: null,
      purchasePricing:
        viewRule === WorkViewPermissionEnum.PURCHASE
          ? this.buildPurchasePricing(purchasePrice)
          : null,
    }
  }

  // 按章节 ID 解析内容权益目标类型，购买和临时授权都复用同一目标 owner。
  private async resolveChapterEntitlementTargetTypeById(chapterId: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: { workType: true },
    })
    const targetType = chapter
      ? this.resolveChapterEntitlementTargetType(chapter.workType)
      : null
    if (!targetType) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        PERMISSION_ERROR_MESSAGE.CHAPTER_NOT_FOUND,
      )
    }
    return targetType
  }

  // 检查章节下载权限，下载开关通过后仍需复用同一套访问规则，避免出现“可下载但不可阅读”的权限分叉。
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
