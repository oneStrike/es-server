import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { INTERACTION_TARGET_DEFINITIONS } from './interaction-target.definition'

type SelectShape = Record<string, boolean>

@Injectable()
export class InteractionTargetAccessService extends BaseService {
  /**
   * Returns prisma model delegate for a target type.
   * This removes repeated switch(targetType) logic in multiple services.
   */
  getTargetModel(client: any, targetType: InteractionTargetTypeEnum) {
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('Unsupported interaction target type')
    }

    const model = client?.[definition.modelKey]
    if (!model) {
      throw new BadRequestException(
        `Target model not found: ${definition.modelKey}`,
      )
    }

    return model
  }

  /**
   * Builds single-id where clause for the target.
   */
  buildTargetWhere(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Record<string, unknown> {
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('Unsupported interaction target type')
    }

    return definition.buildWhere(targetId)
  }

  /**
   * Builds in-list where clause for batch queries.
   */
  buildTargetListWhere(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
  ): Record<string, unknown> {
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('Unsupported interaction target type')
    }

    return definition.buildWhereIn(targetIds)
  }

  /**
   * Verifies target existence with shared lookup behavior.
   */
  async ensureTargetExists<T = { id: number }>(
    client: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    options?: {
      select?: SelectShape
      notFoundMessage?: string
    },
  ): Promise<T> {
    const model = this.getTargetModel(client, targetType)
    const where = this.buildTargetWhere(targetType, targetId)

    const target = await model.findFirst({
      where,
      select: options?.select ?? { id: true },
    })

    if (!target) {
      throw new NotFoundException(options?.notFoundMessage ?? 'Target not found')
    }

    return target as T
  }

  /**
   * Shared atomic counter update for all interaction targets.
   */
  async applyTargetCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const model = this.getTargetModel(tx, targetType)
    const where = this.buildTargetWhere(targetType, targetId)
    await model.applyCountDelta(where, field, delta)
  }
}
