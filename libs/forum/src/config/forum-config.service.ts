import type { ForumConfig, ForumConfigHistory } from '@libs/base/database'

import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'
import { extractIpAddress, extractUserAgent } from '@libs/base/utils'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { UpdateForumConfigDto } from './dto/forum-config.dto'
import { ForumConfigCacheService } from './forum-config-cache.service'
import { ChangeTypeEnum, DEFAULT_FORUM_CONFIG } from './forum-config.constants'

/**
 * 论坛配置服务
 * 提供配置的增删改查、历史记录管理以及缓存管理功能
 */
@Injectable()
export class ForumConfigService extends BaseService {
  constructor(private readonly cacheService: ForumConfigCacheService) {
    super()
  }

  get adminUser() {
    return this.prisma.adminUser
  }

  get forumConfig() {
    return this.prisma.forumConfig
  }

  /**
   * 获取论坛配置（从缓存中读取）
   */
  async getForumConfig() {
    return this.cacheService.getConfig()
  }

  /**
   * 更新论坛配置
   * @param updateForumConfigDto 更新数据DTO，包含id、reason和其他配置字段
   * @param userId 操作用户ID
   * @param req FastifyRequest 对象，用于获取 IP 和 User-Agent
   * @returns 更新后的配置
   */
  async updateConfig(
    updateForumConfigDto: UpdateForumConfigDto,
    userId: number,
    req?: FastifyRequest,
  ) {
    // 验证用户是否存在
    if (!(await this.adminUser.exists({ id: userId }))) {
      throw new BadRequestException('更新失败，无法获取用户信息')
    }
    const { id, reason, ...updateData } = updateForumConfigDto

    // 检查配置是否存在
    const existingConfig = await this.prisma.forumConfig.findUnique({
      where: { id },
    })

    if (!existingConfig) {
      throw new NotFoundException('配置不存在')
    }
    // 构建变更记录并保存到历史表
    const changes = this.buildChangesRecord(
      existingConfig,
      updateForumConfigDto,
    )

    // 如果没有变更，直接返回现有配置
    if (!Object.keys(changes).length) {
      return existingConfig
    }

    // 更新配置
    const updatedConfig = await this.prisma.forumConfig.update({
      where: { id },
      data: {
        ...updateData,
        updatedById: userId,
      },
    })

    await this.recordConfigHistory(
      id,
      changes,
      ChangeTypeEnum.UPDATE,
      userId,
      reason || `更新配置`,
      req,
    )

    // 清除缓存
    await this.cacheService.invalidateConfig()

    return updatedConfig
  }

  /**
   * 重置为默认配置
   * 删除现有配置并创建新的默认配置
   * @param req FastifyRequest 对象，用于获取 IP 和 User-Agent
   */
  async resetToDefault(req?: FastifyRequest) {
    const existingConfig = await this.prisma.forumConfig.findFirst()

    if (existingConfig) {
      await this.prisma.forumConfig.delete({
        where: { id: existingConfig.id },
      })
    }

    const config = await this.createDefaultConfig(req)
    await this.cacheService.invalidateConfig()

    return config
  }

  /**
   * 获取配置历史记录列表
   */
  async getConfigHistory() {
    return this.prisma.forumConfigHistory.findMany({
      orderBy: { id: 'desc' },
    })
  }

  /**
   * 删除历史记录
   */
  async deleteConfigHistory(historyId: number, userId?: number) {
    // 验证用户是否存在
    if (!userId || !(await this.adminUser.exists({ id: userId }))) {
      throw new BadRequestException('更新失败，无法获取用户信息')
    }
    // 检查历史记录是否存在
    const history = await this.prisma.forumConfigHistory.findUnique({
      where: { id: historyId },
    })

    if (!history) {
      throw new NotFoundException('历史记录不存在')
    }

    // 删除历史记录
    await this.prisma.forumConfigHistory.delete({
      where: { id: historyId },
    })
  }

  /**
   * 从历史记录恢复配置
   * @param historyId 历史记录ID
   * @param userId 操作用户ID
   * @param req FastifyRequest 对象，用于获取 IP 和 User-Agent
   * @returns 恢复后的配置
   */
  async restoreFromHistory(
    historyId: number,
    userId?: number,
    req?: FastifyRequest,
  ) {
    // 验证用户是否存在
    if (!userId || !(await this.adminUser.exists({ id: userId }))) {
      throw new BadRequestException('更新失败，无法获取用户信息')
    }
    // 查找历史记录
    const history = await this.prisma.forumConfigHistory.findUnique({
      where: { id: historyId },
    })

    if (!history) {
      throw new NotFoundException('历史记录不存在')
    }

    // 检查配置是否存在
    const config = await this.prisma.forumConfig.findUnique({
      where: { id: history.configId },
    })

    if (!config) {
      throw new NotFoundException('配置不存在')
    }

    // 从变更记录中提取需要恢复的数据
    const restoreData = this.extractRestoreData(history.changes)

    // 更新配置
    const updatedConfig = await this.prisma.forumConfig.update({
      where: { id: history.configId },
      data: {
        ...restoreData,
        updatedById: userId,
      },
    })

    // 记录恢复操作
    await this.recordConfigHistory(
      history.configId,
      restoreData,
      ChangeTypeEnum.RESTORE,
      userId,
      `从历史记录 【${historyId}】 恢复`,
      req,
    )

    // 清除缓存
    await this.cacheService.invalidateConfig()

    return updatedConfig
  }

  /**
   * 创建默认配置
   * @param req FastifyRequest 对象，用于获取 IP 和 User-Agent
   * @returns 新创建的默认配置
   */
  private async createDefaultConfig(
    req?: FastifyRequest,
  ): Promise<ForumConfig> {
    const config = await this.prisma.forumConfig.create({
      data: DEFAULT_FORUM_CONFIG,
    })

    // 记录创建操作
    await this.recordConfigHistory(
      config.id,
      DEFAULT_FORUM_CONFIG,
      ChangeTypeEnum.CREATE,
      undefined,
      '创建默认配置',
      req,
    )

    return config
  }

  /**
   * 记录配置变更历史
   * @param configId 配置ID
   * @param changes 变更内容
   * @param changeType 变更类型
   * @param operatedById 操作用户ID
   * @param reason 变更原因
   * @param req FastifyRequest 对象，用于获取 IP 和 User-Agent
   */
  private async recordConfigHistory(
    configId: number,
    changes: any,
    changeType: ChangeTypeEnum,
    operatedById?: number,
    reason?: string,
    req?: FastifyRequest,
  ) {
    await this.prisma.forumConfigHistory.create({
      data: {
        configId,
        changes,
        changeType,
        operatedById,
        reason,
        ipAddress: req ? extractIpAddress(req) : undefined,
        userAgent: req ? extractUserAgent(req) : undefined,
      },
    })
  }

  /**
   * 从变更记录中提取需要恢复的数据
   * 如果变更记录包含old和new字段，则提取old值用于恢复
   * @param changes 变更记录
   * @returns 需要恢复的数据对象
   */
  private extractRestoreData(changes: ForumConfigHistory['changes']) {
    if (!changes) {
      return {}
    }
    const restoreData = {}

    for (const [key, value] of Object.entries(changes)) {
      // 如果是包含old和new的变更记录，提取old值
      if (
        typeof value === 'object' &&
        value !== null &&
        'old' in value &&
        'new' in value
      ) {
        const fieldChange = value
        restoreData[key] = fieldChange.old
      } else if (value !== undefined) {
        // 否则直接使用该值
        restoreData[key] = value
      }
    }

    return restoreData
  }

  /**
   * 构建变更记录
   * 比较现有配置和更新数据，记录发生变化的字段
   * @param existingConfig 现有配置
   * @param updateData 更新数据
   * @returns 变更记录对象，包含每个变化字段的old和new值
   */
  private buildChangesRecord(
    existingConfig: ForumConfig,
    updateData: UpdateForumConfigDto,
  ) {
    const changes = {}

    for (const [key, newValue] of Object.entries(updateData)) {
      if (key in existingConfig) {
        const oldValue = existingConfig[key as keyof ForumConfig]
        // 只记录发生变化的字段
        if (oldValue !== newValue) {
          changes[key as keyof ForumConfig] = {
            old: oldValue,
            new: newValue,
          }
        }
      }
    }

    return changes
  }
}
