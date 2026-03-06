import { InteractionTargetTypeEnum, UserStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class CommentPermissionService extends BaseService {
  /**
   * 验证用户和目标是否可以评论
   * 组合调用 ensureUserCanComment 和 ensureTargetCanComment
   * @param userId - 用户ID
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @throws BadRequestException 用户或目标无评论权限时抛出
   */
  async ensureCanComment(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    await Promise.all([
      this.ensureTargetCanComment(targetType, targetId),
      this.ensureUserCanComment(userId),
    ])
  }

  /**
   * 校验用户是否允许发表评论
   * 检查用户是否存在、是否被禁用、是否被禁言或封禁
   * @param userId - 用户ID
   * @throws BadRequestException 用户无评论权限时抛出
   */
  async ensureUserCanComment(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { isEnabled: true, status: true },
    })

    if (!user || !user.isEnabled) {
      throw new BadRequestException('用户不存在或已被禁用')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法评论')
    }
  }

  /**
   * 校验目标是否支持评论，并校验目标类型是否匹配
   * 根据目标类型（作品/章节/论坛主题）进行不同的校验逻辑
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @throws BadRequestException 目标不存在、类型不匹配或不允许评论时抛出
   */
  async ensureTargetCanComment(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    const validators: Record<
      InteractionTargetTypeEnum,
      (id: number) => Promise<void>
    > = {
      [InteractionTargetTypeEnum.COMIC]: async (id) => this.validateWork(id, 1),
      [InteractionTargetTypeEnum.NOVEL]: async (id) => this.validateWork(id, 2),
      [InteractionTargetTypeEnum.COMIC_CHAPTER]: async (id) =>
        this.validateChapter(id, 1),
      [InteractionTargetTypeEnum.NOVEL_CHAPTER]: async (id) =>
        this.validateChapter(id, 2),
      [InteractionTargetTypeEnum.FORUM_TOPIC]: async (id) =>
        this.validateForumTopic(id),
    }

    const validator = validators[targetType]
    if (!validator) {
      throw new BadRequestException('不支持的目标类型')
    }

    await validator(targetId)
  }

  /**
   * 校验作品是否允许评论
   * @param workId - 作品ID
   * @param expectedType - 期望的作品类型（1=漫画，2=小说）
   * @throws BadRequestException 作品不存在、类型不匹配或不允许评论时抛出
   */
  private async validateWork(
    workId: number,
    expectedType: number,
  ): Promise<void> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { type: true, canComment: true, deletedAt: true },
    })

    this.ensureExists(work, '作品不存在')
    this.ensureTypeMatch(work!.type, expectedType, '作品类型不匹配')

    if (!work!.canComment) {
      throw new BadRequestException('该作品不允许评论')
    }
  }

  /**
   * 校验章节是否允许评论
   * @param chapterId - 章节ID
   * @param expectedWorkType - 期望的作品类型（1=漫画，2=小说）
   * @throws BadRequestException 章节不存在、类型不匹配或不允许评论时抛出
   */
  private async validateChapter(
    chapterId: number,
    expectedWorkType: number,
  ): Promise<void> {
    const chapter = await this.prisma.workChapter.findUnique({
      where: { id: chapterId },
      select: { workType: true, canComment: true, deletedAt: true },
    })

    this.ensureExists(chapter, '章节不存在')
    this.ensureTypeMatch(chapter!.workType, expectedWorkType, '章节类型不匹配')

    if (!chapter!.canComment) {
      throw new BadRequestException('章节不允许评论')
    }
  }

  /**
   * 校验论坛主题是否允许评论
   * @param topicId - 主题ID
   * @throws BadRequestException 主题不存在或已被锁定时抛出
   */
  private async validateForumTopic(topicId: number): Promise<void> {
    const topic = await this.prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { isLocked: true, deletedAt: true },
    })

    this.ensureExists(topic, '帖子不存在')

    if (topic!.isLocked) {
      throw new BadRequestException('帖子已被锁定，无法评论')
    }
  }

  /**
   * 确保目标存在（未删除）
   * @param target - 目标对象
   * @param message - 不存在时的错误消息
   * @throws BadRequestException 目标不存在时抛出
   */
  private ensureExists<T extends { deletedAt: Date | null }>(
    target: T | null,
    message: string,
  ): void {
    if (!target || target.deletedAt !== null) {
      throw new BadRequestException(message)
    }
  }

  /**
   * 确保类型匹配
   * @param actualType - 实际类型
   * @param expectedType - 期望类型
   * @param message - 不匹配时的错误消息
   * @throws BadRequestException 类型不匹配时抛出
   */
  private ensureTypeMatch(
    actualType: number,
    expectedType: number,
    message: string,
  ): void {
    if (actualType !== expectedType) {
      throw new BadRequestException(message)
    }
  }
}
