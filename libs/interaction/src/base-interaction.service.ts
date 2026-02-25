import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType, InteractionActionType } from './interaction.constant'
import { CounterService } from './counter/counter.service'
import { TargetValidatorRegistry } from './validator/target-validator.registry'
import { InteractionEventEmitter } from './interaction.event'

export abstract class BaseInteractionService {
  protected abstract readonly prisma: PrismaClient
  protected abstract readonly counterService: CounterService
  protected abstract readonly validatorRegistry: TargetValidatorRegistry
  protected eventEmitter?: InteractionEventEmitter

  protected abstract getActionType(): InteractionActionType
  protected abstract getCancelActionType(): InteractionActionType

  /**
   * 校验目标是否存在
   * @param targetType 目标类型
   * @param targetId 目标ID
   */
  protected async validateTarget(
    targetType: InteractionTargetType,
    targetId: number,
  ): Promise<void> {
    const validator = this.validatorRegistry.getValidator(targetType)
    const result = await validator.validate(targetId)

    if (!result.valid) {
      throw new NotFoundException(result.message || '目标不存在')
    }
  }

  /**
   * 获取目标信息
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @returns 目标信息
   */
  protected async getTargetInfo(
    targetType: InteractionTargetType,
    targetId: number,
  ): Promise<unknown | null> {
    const validator = this.validatorRegistry.getValidator(targetType)
    return validator.getTargetInfo(targetId)
  }

  /**
   * 检查用户是否已执行交互
   * 子类需要实现此方法
   */
  protected abstract checkUserInteracted(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean>

  /**
   * 创建交互记录
   * 子类需要实现此方法
   */
  protected abstract createInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    extraData?: Record<string, unknown>,
  ): Promise<void>

  /**
   * 删除交互记录
   * 子类需要实现此方法
   */
  protected abstract deleteInteraction(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void>

  /**
   * 获取计数字段名
   * 子类需要实现此方法
   */
  protected abstract getCountField(): string

  async interact(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    extraData?: Record<string, unknown>,
  ): Promise<void> {
    await this.validateTarget(targetType, targetId)

    const hasInteracted = await this.checkUserInteracted(targetType, targetId, userId)
    if (hasInteracted) {
      throw new BadRequestException('已经执行过该操作')
    }

    await this.createInteraction(targetType, targetId, userId, extraData)

    const countField = this.getCountField()
    await this.counterService.increment(targetType, targetId, countField)

    if (this.eventEmitter) {
      await this.eventEmitter.emit({
        actionType: this.getActionType(),
        targetType,
        targetId,
        userId,
        timestamp: new Date(),
        extraData,
      })
    }
  }

  async cancelInteract(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const hasInteracted = await this.checkUserInteracted(targetType, targetId, userId)
    if (!hasInteracted) {
      throw new BadRequestException('尚未执行过该操作')
    }

    await this.deleteInteraction(targetType, targetId, userId)

    const countField = this.getCountField()
    await this.counterService.decrement(targetType, targetId, countField)

    if (this.eventEmitter) {
      await this.eventEmitter.emit({
        actionType: this.getCancelActionType(),
        targetType,
        targetId,
        userId,
        timestamp: new Date(),
      })
    }
  }

  /**
   * 检查用户交互状态
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @param userId 用户ID
   * @returns 是否已交互
   */
  async checkStatus(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    return this.checkUserInteracted(targetType, targetId, userId)
  }

  /**
   * 批量检查用户交互状态
   * @param targetType 目标类型
   * @param targetIds 目标ID数组
   * @param userId 用户ID
   * @returns 交互状态映射表
   */
  abstract checkStatusBatch(
    targetType: InteractionTargetType,
    targetIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>>

  /**
   * 获取交互计数
   * @param targetType 目标类型
   * @param targetId 目标ID
   * @returns 交互计数
   */
  async getCount(
    targetType: InteractionTargetType,
    targetId: number,
  ): Promise<number> {
    const countField = this.getCountField()
    return this.counterService.getCount(targetType, targetId, countField)
  }

  /**
   * 批量获取交互计数
   * @param targetType 目标类型
   * @param targetIds 目标ID数组
   * @returns 计数映射表
   */
  async getCounts(
    targetType: InteractionTargetType,
    targetIds: number[],
  ): Promise<Map<number, number>> {
    const countField = this.getCountField()
    return this.counterService.getCounts(targetType, targetIds, countField)
  }
}
