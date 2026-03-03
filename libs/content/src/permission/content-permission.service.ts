import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import {
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '@libs/interaction/purchase'
import { BadRequestException, Injectable } from '@nestjs/common'
import { PERMISSION_ERROR_MESSAGE } from './content-permission.constant'
import {
  CHAPTER_PERMISSION_SELECT,
  WORK_PERMISSION_SELECT,
} from './content-permission.select'
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
export class ContentPermissionService extends BaseService {
  get appUser() {
    return this.prisma.appUser
  }

  get work() {
    return this.prisma.work
  }

  get workChapter() {
    return this.prisma.workChapter
  }

  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  private async resolveWorkPermission(
    workId: number,
  ): Promise<WorkPermissionData> {
    const work = await this.work.findUnique({
      where: { id: workId },
      select: WORK_PERMISSION_SELECT,
    })
    if (!work) {
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.WORK_NOT_FOUND)
    }
    return work
  }

  async resolveChapterPermission(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: CHAPTER_PERMISSION_SELECT,
    })
    if (!chapter) {
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.CHAPTER_NOT_FOUND)
    }
    const permission = await this.resolveChapterPermissionFromData(chapter)
    return {
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
    const user = await this.appUser.findUnique({
      where: { id: userId },
      include: {
        level: {
          select: { requiredExperience: true },
        },
      },
    })
    if (!user) {
      throw new BadRequestException(PERMISSION_ERROR_MESSAGE.USER_NOT_FOUND)
    }
    return user
  }

  private async validateUserExists(userId: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
      select: { id: true },
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
   * @param requiredViewLevelId 访问所需的等级ID
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
  private async validateChapterPurchasePermission(
    userId: number,
    chapterId: number,
  ) {
    const purchased = await this.userPurchaseRecord.findFirst({
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
    if (!purchased) {
      throw new BadRequestException(
        PERMISSION_ERROR_MESSAGE.CHAPTER_PURCHASE_REQUIRED,
      )
    }
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
      await this.validateChapterPurchasePermission(userId, chapterId)
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
  async checkChapterAccess<T extends Prisma.WorkChapterSelect>(
    chapterId: number,
    userId?: number,
    select?: T,
  ): Promise<ChapterAccessResult<Prisma.WorkChapterGetPayload<{ select: T }>>> {
    type ChapterPayload = Prisma.WorkChapterGetPayload<{ select: T }>
    // 合并权限字段和额外请求的字段
    const mergedSelect = {
      ...CHAPTER_PERMISSION_SELECT,
      ...select,
    }

    // 单次查询获取章节数据
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: mergedSelect,
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
      chapter: chapter as unknown as ChapterPayload,
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
  async checkChapterDownload(userId: number, chapterId: number) {
    const permission = await this.resolveChapterPermission(chapterId)
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
