import { DrizzleService } from '@db/core'
// eslint-disable-next-line no-restricted-imports -- avoid circular deps via interaction barrel
import {
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '@libs/interaction/purchase/purchase.constant'
import { WorkViewPermissionEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable } from '@nestjs/common'
import { PERMISSION_ERROR_MESSAGE } from './content-permission.constant'
import {
  AccessRuleContext,
  PermissionChapterData,
  UserWithLevel,
  WorkPermissionData,
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

  private get db() {
    return this.drizzle.db
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  get work() {
    return this.drizzle.schema.work
  }

  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  private async resolveWorkPermission(
    workId: number,
  ): Promise<WorkPermissionData> {
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
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.WORK_NOT_FOUND)
    }
    return work
  }

  async resolveChapterPermission(chapterId: number) {
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
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.CHAPTER_NOT_FOUND)
    }
    const permission = await this.resolveChapterPermissionFromData(chapter)
    return {
      workType: chapter.workType,
      canDownload: permission.canDownload,
      viewRule: permission.viewRule,
      requiredExperience: permission.requiredExperience,
      isPreview: permission.isPreview,
      price: permission.price,
    }
  }

  /**
   * 获取用户及其等级信息
   */
  private async getUserWithLevel(userId: number): Promise<UserWithLevel> {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      with: {
        level: {
          columns: { requiredExperience: true },
        },
      },
    })
    if (!user) {
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.USER_NOT_FOUND)
    }
    return user
  }

  private async validateUserExists(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    if (!user) {
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.USER_NOT_FOUND)
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
      throw new BadRequestException(
        PERMISSION_ERROR_MESSAGE.MEMBER_LEVEL_INSUFFICIENT,
      )
    }

    if (requiredExperience === null) {
      throw new BadRequestException(
        PERMISSION_ERROR_MESSAGE.REQUIRED_MEMBER_LEVEL_NOT_FOUND,
      )
    }

    if (user.level.requiredExperience < requiredExperience) {
      throw new BadRequestException(
        PERMISSION_ERROR_MESSAGE.MEMBER_LEVEL_INSUFFICIENT,
      )
    }
  }

  /**
   * 检查用户是否已成功购买指定章节
   */
  async validateChapterPurchasePermission(userId: number, chapterId: number) {
    const purchased = await this.db.query.userPurchaseRecord.findFirst({
      where: {
        targetType: {
          in: [PurchaseTargetTypeEnum.COMIC_CHAPTER, PurchaseTargetTypeEnum.NOVEL_CHAPTER],
        },
        targetId: chapterId,
        userId,
        status: PurchaseStatusEnum.SUCCESS,
      },
    })
    return !!purchased
  }

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
        throw new BadRequestException(
          PERMISSION_ERROR_MESSAGE.WORK_PURCHASE_UNSUPPORTED,
        )
      }
      await this.validateUserExists(userId)
      if (!(await this.validateChapterPurchasePermission(userId, chapterId))) {
        throw new BadRequestException(
          PERMISSION_ERROR_MESSAGE.CHAPTER_PURCHASE_REQUIRED,
        )
      }
      return true
    }

    throw new BadRequestException(
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
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.CHAPTER_NOT_FOUND)
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
      throw new BadRequestException(
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
            Object.keys(select).map((key) => [key, (chapter as Record<string, unknown>)[key]]),
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
  private async resolveChapterPermissionFromData(
    chapter: PermissionChapterData,
  ) {
    if (chapter.viewRule === WorkViewPermissionEnum.INHERIT) {
      const workPermission = await this.resolveWorkPermission(chapter.workId)
      return {
        viewRule: workPermission.viewRule as WorkViewPermissionEnum,
        isPreview: chapter.isPreview,
        canDownload: chapter.canDownload,
        price: workPermission.chapterPrice,
        requiredExperience:
          workPermission.requiredViewLevel?.requiredExperience ?? null,
      }
    }

    return {
      viewRule: chapter.viewRule as WorkViewPermissionEnum,
      isPreview: chapter.isPreview,
      canDownload: chapter.canDownload,
      price: chapter.price,
      requiredExperience: chapter.requiredViewLevel?.requiredExperience ?? null,
    }
  }

  /**
   * 检查章节下载权限
   */
  async checkChapterDownload(
    userId: number,
    chapterId: number,
    resolvedPermission?: Awaited<ReturnType<ContentPermissionService['resolveChapterPermission']>>,
  ) {
    const permission =
      resolvedPermission ?? (await this.resolveChapterPermission(chapterId))
    if (!permission.canDownload) {
      throw new BadRequestException(
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
