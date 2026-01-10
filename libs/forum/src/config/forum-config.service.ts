import type { ForumConfig, ForumConfigHistory } from '@libs/base/database'

import { BaseService } from '@libs/base/database'
import { Injectable, NotFoundException } from '@nestjs/common'
import { UpdateForumConfigDto } from './dto/forum-config.dto'
import { ForumConfigCacheService } from './forum-config-cache.service'
import { ChangeTypeEnum, DEFAULT_FORUM_CONFIG } from './forum-config.constants'

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

  async getForumConfig() {
    const config = await this.cacheService.getConfig()

    if (!config) {
      return this.createDefaultConfig()
    }

    return config
  }

  async updateForumConfig(
    updateForumConfigDto: UpdateForumConfigDto,
    userId?: number,
  ) {
    if (!userId || !(await this.adminUser.exists({ id: userId }))) {
      this.throwHttpException('更新失败，无法获取用户信息')
    }
    const { id, reason, ...updateData } = updateForumConfigDto

    const existingConfig = await this.prisma.forumConfig.findUnique({
      where: { id },
    })

    if (!existingConfig) {
      throw new NotFoundException('配置不存在')
    }

    const updatedConfig = await this.prisma.forumConfig.update({
      where: { id },
      data: {
        ...updateData,
        updatedById: userId,
      },
    })

    const changes = this.buildChangesRecord(
      existingConfig,
      updateForumConfigDto,
    )

    await this.recordConfigHistory(
      id,
      changes,
      ChangeTypeEnum.UPDATE,
      userId,
      reason,
    )

    await this.cacheService.invalidateConfig()

    return updatedConfig
  }

  async resetToDefault() {
    const existingConfig = await this.prisma.forumConfig.findFirst()

    if (existingConfig) {
      await this.prisma.forumConfig.delete({
        where: { id: existingConfig.id },
      })
    }

    const config = await this.createDefaultConfig()
    await this.cacheService.invalidateConfig()

    return config
  }

  async getConfigHistory() {
    return this.prisma.forumConfigHistory.findMany()
  }

  async restoreFromHistory(historyId: number, userId?: number) {
    if (!userId || !(await this.adminUser.exists({ id: userId }))) {
      this.throwHttpException('更新失败，无法获取用户信息')
    }
    const history = await this.prisma.forumConfigHistory.findUnique({
      where: { id: historyId },
    })

    if (!history) {
      throw new NotFoundException('历史记录不存在')
    }

    const config = await this.prisma.forumConfig.findUnique({
      where: { id: history.configId },
    })

    if (!config) {
      throw new NotFoundException('配置不存在')
    }

    const restoreData = this.extractRestoreData(history.changes)

    const updatedConfig = await this.prisma.forumConfig.update({
      where: { id: history.configId },
      data: {
        ...restoreData,
        updatedById: userId,
      },
    })

    await this.recordConfigHistory(
      history.configId,
      restoreData,
      ChangeTypeEnum.RESTORE,
      userId,
      `从历史记录 ${historyId} 恢复`,
    )

    await this.cacheService.invalidateConfig()

    return updatedConfig
  }

  private async createDefaultConfig(): Promise<ForumConfig> {
    const config = await this.prisma.forumConfig.create({
      data: DEFAULT_FORUM_CONFIG,
    })

    await this.recordConfigHistory(
      config.id,
      DEFAULT_FORUM_CONFIG,
      ChangeTypeEnum.CREATE,
      undefined,
      '创建默认配置',
    )

    return config
  }

  private async recordConfigHistory(
    configId: number,
    changes: any,
    changeType: ChangeTypeEnum,
    operatedById?: number,
    reason?: string,
  ) {
    await this.prisma.forumConfigHistory.create({
      data: {
        configId,
        changes,
        changeType,
        operatedById,
        reason,
      },
    })
  }

  private extractRestoreData(changes: ForumConfigHistory['changes']) {
    if (!changes) {
      return {}
    }
    const restoreData = {}

    for (const [key, value] of Object.entries(changes)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        'old' in value &&
        'new' in value
      ) {
        const fieldChange = value
        restoreData[key] = fieldChange.old
      } else if (value !== undefined) {
        restoreData[key] = value
      }
    }

    return restoreData
  }

  private buildChangesRecord(
    existingConfig: ForumConfig,
    updateData: UpdateForumConfigDto,
  ) {
    const changes = {}

    for (const [key, newValue] of Object.entries(updateData)) {
      if (key in existingConfig) {
        const oldValue = existingConfig[key as keyof ForumConfig]
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
