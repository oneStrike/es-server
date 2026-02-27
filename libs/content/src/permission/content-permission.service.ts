import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  WORK_PERMISSION_SELECT,
  CHAPTER_PERMISSION_SELECT,
} from './content-permission.select'
import { PurchaseStatusEnum } from '@libs/interaction/purchase'

/** 用户等级信息接口 */
interface UserWithLevel {
  id: number
  levelId: number | null
  level: { requiredExperience: number } | null
}

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

  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  /**
   * 解析作品的有效权限
   */
  async resolveWorkPermission(workId: number) {
    const work = await this.work.findUnique({
      where: { id: workId },
      select: WORK_PERMISSION_SELECT,
    })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    return {
      ...work,
      viewRule: work.viewRule as WorkViewPermissionEnum,
      requiredExperience: work.requiredViewLevel?.requiredExperience ?? null,
    }
  }

  /**
   * 解析章节的有效权限
   */
  async resolveChapterPermission(chapterId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
      select: CHAPTER_PERMISSION_SELECT,
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    // 判断是否继承作品权限
    if (chapter.viewRule === WorkViewPermissionEnum.INHERIT) {
      const workPermission = await this.resolveWorkPermission(chapter.workId)
      return {
        ...workPermission,
        exchangePoints: workPermission.chapterExchangePoints,
        price: workPermission.chapterPrice,
        isPreview: chapter.isPreview,
      }
    }

    // 章节有独立权限配置
    return {
      ...chapter,
      viewRule: chapter.viewRule as WorkViewPermissionEnum,
      requiredExperience: chapter.requiredViewLevel?.requiredExperience ?? null,
    }
  }

  /**
   * 获取用户及其等级信息
   */
  private async getUserWithLevel(userId: number) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
      include: {
        level: {
          select: { requiredExperience: true },
        },
      },
    })
    if (!user) {
      throw new BadRequestException('用户不存在')
    }
    return user
  }

  /**
   * 验证会员等级权限
   */
  private async validateMemberPermission(
    user: UserWithLevel,
    requiredViewLevelId: number | null,
  ) {
    if (!user.levelId || !user.level) {
      throw new BadRequestException('会员等级不足')
    }

    if (requiredViewLevelId) {
      const requiredLevel = await this.userLevelRule.findUnique({
        where: { id: requiredViewLevelId },
      })
      if (!requiredLevel) {
        throw new BadRequestException('指定的阅读会员等级不存在')
      }
      if (user.level.requiredExperience < requiredLevel.requiredExperience) {
        throw new BadRequestException('会员等级不足')
      }
    }
  }

  /**
   * 验证购买权限
   */
  private async validatePurchasePermission(
    userId: number,
    targetId: number,
    targetType: 'work' | 'chapter',
  ) {
    const purchased = await this.userPurchaseRecord.findFirst({
      where: {
        targetId,
        userId,
        status: PurchaseStatusEnum.SUCCESS, // 购买成功状态
      },
    })
    if (!purchased) {
      throw new BadRequestException(
        targetType === 'work' ? '请先购买该作品' : '请先购买该章节',
      )
    }
  }

  /**
   * 核心权限检查逻辑
   */
  private async checkAccessPermission(
    viewRule: WorkViewPermissionEnum,
    userId: number,
    requiredViewLevelId: number | null,
    purchaseCheck?: { targetId: number; targetType: 'work' | 'chapter' },
  ) {
    // 所有人可见或继承权限时，直接放行
    if (
      viewRule === WorkViewPermissionEnum.ALL ||
      viewRule === WorkViewPermissionEnum.INHERIT
    ) {
      return true
    }

    const user = await this.getUserWithLevel(userId)

    // 仅需登录即可访问
    if (viewRule === WorkViewPermissionEnum.LOGGED_IN) {
      return true
    }

    // 需要会员身份
    if (viewRule === WorkViewPermissionEnum.MEMBER) {
      await this.validateMemberPermission(user, requiredViewLevelId)
      return true
    }

    // 需要购买
    if (viewRule === WorkViewPermissionEnum.PURCHASE && purchaseCheck) {
      await this.validatePurchasePermission(
        userId,
        purchaseCheck.targetId,
        purchaseCheck.targetType,
      )
      return true
    }

    return true
  }

  /**
   * 检查用户对作品的访问权限
   */
  async checkWorkAccess(userId: number, workId: number) {
    const { viewRule, requiredViewLevelId } =
      await this.resolveWorkPermission(workId)
    return this.checkAccessPermission(viewRule, userId, requiredViewLevelId, {
      targetId: workId,
      targetType: 'work',
    })
  }

  /**
   * 检查用户对章节的访问权限
   */
  async checkChapterAccess(userId: number, chapterId: number) {
    const { viewRule, requiredViewLevelId, isPreview } =
      await this.resolveChapterPermission(chapterId)
    if (isPreview) {
      return true
    }
    return this.checkAccessPermission(viewRule, userId, requiredViewLevelId, {
      targetId: chapterId,
      targetType: 'chapter',
    })
  }

  /**
   * 检查用户对作品的下载权限
   */
  async checkWorkDownload(userId: number, workId: number) {
    const { viewRule, requiredViewLevelId, canDownload } =
      await this.resolveWorkPermission(workId)
    if (!canDownload) {
      throw new BadRequestException('作品禁止下载')
    }
    return this.checkAccessPermission(viewRule, userId, requiredViewLevelId, {
      targetId: workId,
      targetType: 'work',
    })
  }

  /**
   * 检查用户对章节的下载权限
   */
  async checkChapterDownload(userId: number, chapterId: number) {
    const { viewRule, requiredViewLevelId, canDownload } =
      await this.resolveChapterPermission(chapterId)

    if (!canDownload) {
      throw new BadRequestException('章节禁止下载')
    }
    return this.checkAccessPermission(viewRule, userId, requiredViewLevelId, {
      targetId: chapterId,
      targetType: 'chapter',
    })
  }
}
