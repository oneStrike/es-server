import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'

/**
 * 论坛计数服务类
 * 负责管理论坛相关的计数器，包括版块、主题和用户档案的各种计数
 * 提供统一的计数更新接口，确保计数数据的一致性
 */
@Injectable()
export class ForumCounterService extends BaseService {
  constructor() {
    super()
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 更新版块的主题数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param sectionId - 版块ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的版块信息
   */
  async updateSectionTopicCount(
    tx: any,
    sectionId: number,
    delta: number,
  ) {
    const prisma = tx || this.prisma
    return prisma.forumSection.update({
      where: { id: sectionId },
      data: {
        topicCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新版块的回复数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param sectionId - 版块ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的版块信息
   */
  async updateSectionReplyCount(
    tx: any,
    sectionId: number,
    delta: number,
  ) {
    const prisma = tx || this.prisma
    return prisma.forumSection.update({
      where: { id: sectionId },
      data: {
        replyCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新主题的回复数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param topicId - 主题ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的主题信息
   */
  async updateTopicReplyCount(tx: any, topicId: number, delta: number) {
    const prisma = tx || this.prisma
    return prisma.forumTopic.update({
      where: { id: topicId },
      data: {
        replyCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新主题的点赞数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param topicId - 主题ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的主题信息
   */
  async updateTopicLikeCount(tx: any, topicId: number, delta: number) {
    const prisma = tx || this.prisma
    return prisma.forumTopic.update({
      where: { id: topicId },
      data: {
        likeCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新主题的收藏数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param topicId - 主题ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的主题信息
   */
  async updateTopicFavoriteCount(tx: any, topicId: number, delta: number) {
    const prisma = tx || this.prisma
    return prisma.forumTopic.update({
      where: { id: topicId },
      data: {
        favoriteCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新用户档案的主题数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param profileId - 用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileTopicCount(tx: any, profileId: number, delta: number) {
    const prisma = tx || this.prisma
    return prisma.forumProfile.update({
      where: { id: profileId },
      data: {
        topicCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新用户档案的回复数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param profileId - 用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileReplyCount(tx: any, profileId: number, delta: number) {
    const prisma = tx || this.prisma
    return prisma.forumProfile.update({
      where: { id: profileId },
      data: {
        replyCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新用户档案的点赞数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param profileId - 用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileLikeCount(tx: any, profileId: number, delta: number) {
    const prisma = tx || this.prisma
    return prisma.forumProfile.update({
      where: { id: profileId },
      data: {
        likeCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 更新用户档案的收藏数量
   * @param tx - Prisma 事务对象，如果在事务中调用则传入，否则使用默认 prisma 客户端
   * @param profileId - 用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileFavoriteCount(tx: any, profileId: number, delta: number) {
    const prisma = tx || this.prisma
    return prisma.forumProfile.update({
      where: { id: profileId },
      data: {
        favoriteCount: {
          increment: delta,
        },
      },
    })
  }

  /**
   * 批量更新回复相关的所有计数
   * 包括主题回复数、版块回复数、用户档案回复数
   * @param tx - Prisma 事务对象
   * @param topicId - 主题ID
   * @param sectionId - 版块ID
   * @param profileId - 用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateReplyRelatedCounts(
    tx: any,
    topicId: number,
    sectionId: number,
    profileId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicReplyCount(tx, topicId, delta),
      this.updateSectionReplyCount(tx, sectionId, delta),
      this.updateProfileReplyCount(tx, profileId, delta),
    ])
  }

  /**
   * 批量更新主题相关的所有计数
   * 包括版块主题数、用户档案主题数
   * @param tx - Prisma 事务对象
   * @param sectionId - 版块ID
   * @param profileId - 用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateTopicRelatedCounts(
    tx: any,
    sectionId: number,
    profileId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateSectionTopicCount(tx, sectionId, delta),
      this.updateProfileTopicCount(tx, profileId, delta),
    ])
  }

  /**
   * 批量更新主题点赞相关的所有计数
   * 包括主题点赞数、主题作者的用户档案点赞数
   * @param tx - Prisma 事务对象
   * @param topicId - 主题ID
   * @param authorProfileId - 主题作者的用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateTopicLikeRelatedCounts(
    tx: any,
    topicId: number,
    authorProfileId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicLikeCount(tx, topicId, delta),
      this.updateProfileLikeCount(tx, authorProfileId, delta),
    ])
  }

  /**
   * 批量更新主题收藏相关的所有计数
   * 包括主题收藏数、主题作者的用户档案收藏数
   * @param tx - Prisma 事务对象
   * @param topicId - 主题ID
   * @param authorProfileId - 主题作者的用户档案ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateTopicFavoriteRelatedCounts(
    tx: any,
    topicId: number,
    authorProfileId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicFavoriteCount(tx, topicId, delta),
      this.updateProfileFavoriteCount(tx, authorProfileId, delta),
    ])
  }
}
