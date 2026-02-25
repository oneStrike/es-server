import type { CounterService } from './counter/counter.service'
import type { InteractionActionType, InteractionTargetType } from './interaction.constant'
import type { InteractionEventEmitter } from './interaction.event'
import type { TargetValidatorRegistry } from './validator/target-validator.registry'
import { BaseService } from '@libs/base/database'

import { BadRequestException, NotFoundException } from '@nestjs/common'

export abstract class BaseInteractionService extends BaseService {
  protected declare readonly counterService: CounterService
  protected declare readonly validatorRegistry: TargetValidatorRegistry
  protected eventEmitter?: InteractionEventEmitter

  protected abstract getActionType(): InteractionActionType
  protected abstract getCancelActionType(): InteractionActionType

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

  protected async checkUserInteracted(
    _targetType: InteractionTargetType,
    _targetId: number,
    _userId: number,
  ): Promise<boolean> {
    throw new Error('checkUserInteracted must be implemented')
  }

  protected async createInteraction(
    _targetType: InteractionTargetType,
    _targetId: number,
    _userId: number,
    _extraData?: Record<string, unknown>,
  ): Promise<void> {
    throw new Error('createInteraction must be implemented')
  }

  protected async deleteInteraction(
    _targetType: InteractionTargetType,
    _targetId: number,
    _userId: number,
  ): Promise<void> {
    throw new Error('deleteInteraction must be implemented')
  }

  protected getCountField(): string {
    return 'interactionCount'
  }

  protected async interact(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
    extraData?: Record<string, unknown>,
  ): Promise<void> {
    await this.validateTarget(targetType, targetId)

    const alreadyInteracted = await this.checkUserInteracted(targetType, targetId, userId)
    if (alreadyInteracted) {
      throw new BadRequestException('已经进行过此操作')
    }

    await this.prisma.$transaction(async (tx) => {
      await this.createInteraction(targetType, targetId, userId, extraData)
      await this.counterService.incrementCount(tx, targetType, targetId, this.getCountField())
    })

    if (this.eventEmitter) {
      void this.eventEmitter.emit({
        actionType: this.getActionType(),
        targetType,
        targetId,
        userId,
        timestamp: new Date(),
      })
    }
  }

  protected async cancelInteract(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<void> {
    await this.validateTarget(targetType, targetId)

    const hasInteracted = await this.checkUserInteracted(targetType, targetId, userId)
    if (!hasInteracted) {
      throw new BadRequestException('尚未进行过此操作')
    }

    await this.prisma.$transaction(async (tx) => {
      await this.deleteInteraction(targetType, targetId, userId)
      await this.counterService.decrementCount(tx, targetType, targetId, this.getCountField())
    })

    if (this.eventEmitter) {
      void this.eventEmitter.emit({
        actionType: this.getCancelActionType(),
        targetType,
        targetId,
        userId,
        timestamp: new Date(),
      })
    }
  }

  async checkStatus(
    targetType: InteractionTargetType,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    return this.checkUserInteracted(targetType, targetId, userId)
  }

  protected async getCount(
    targetType: InteractionTargetType,
    targetId: number,
  ): Promise<number> {
    return this.counterService.getCount(targetType, targetId, this.getCountField())
  }

  protected async getCounts(
    targetType: InteractionTargetType,
    targetIds: number[],
  ): Promise<Map<number, number>> {
    return this.counterService.getCounts(targetType, targetIds, this.getCountField())
  }

  setEventEmitter(emitter: InteractionEventEmitter): void {
    this.eventEmitter = emitter
  }
}
