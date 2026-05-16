import type { WorkThirdPartySourceBindingSelect } from '@db/schema'
import type {
  ThirdPartyComicBindingMutationResult,
  ThirdPartyComicChapterBindingInput,
  ThirdPartyComicSourceBindingInput,
  ThirdPartyComicSourceScopeInput,
} from '../third-party-comic-binding.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull } from 'drizzle-orm'

/**
 * 三方漫画绑定服务。
 * 统一维护 source-scope 和 providerChapterId 幂等规则。
 */
@Injectable()
export class ThirdPartyComicBindingService {
  // 注入 Drizzle 统一入口。
  constructor(private readonly drizzle: DrizzleService) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取来源绑定表。
  private get sourceBinding() {
    return this.drizzle.schema.workThirdPartySourceBinding
  }

  // 读取章节绑定表。
  private get chapterBinding() {
    return this.drizzle.schema.workThirdPartyChapterBinding
  }

  // 生成三方来源作用域键，供后台任务去重和诊断使用。
  buildSourceScopeKey(input: ThirdPartyComicSourceScopeInput) {
    return `${input.platform}:${input.providerComicId}:${input.providerGroupPathWord}`
  }

  // 按平台、三方漫画和章节分组读取 active 来源绑定。
  async getActiveSourceBindingByScope(input: ThirdPartyComicSourceScopeInput) {
    return this.findActiveSourceBindingByScope(
      this.normalizeSourceScopeInput(input),
    )
  }

  // 读取作品当前 active 三方来源绑定。
  async getActiveSourceBindingByWorkId(workId: number) {
    const [row] = await this.db
      .select()
      .from(this.sourceBinding)
      .where(
        and(
          eq(this.sourceBinding.workId, workId),
          isNull(this.sourceBinding.deletedAt),
        ),
      )
      .limit(1)

    return row ?? null
  }

  // 读取指定 active 三方来源绑定。
  async getActiveSourceBindingById(id: number) {
    const [row] = await this.db
      .select()
      .from(this.sourceBinding)
      .where(
        and(
          eq(this.sourceBinding.id, id),
          isNull(this.sourceBinding.deletedAt),
        ),
      )
      .limit(1)

    return row ?? null
  }

  // 按作品列表批量查询是否存在 active 三方来源绑定。
  async buildActiveSourceBindingWorkIdSet(workIds: number[]) {
    const uniqueWorkIds = [...new Set(workIds)]
    if (uniqueWorkIds.length === 0) {
      return new Set<number>()
    }

    const rows = await this.db
      .select({ workId: this.sourceBinding.workId })
      .from(this.sourceBinding)
      .where(
        and(
          inArray(this.sourceBinding.workId, uniqueWorkIds),
          isNull(this.sourceBinding.deletedAt),
        ),
      )

    return new Set(rows.map((row) => row.workId))
  }

  // 创建或复用同 scope 来源绑定，拒绝任一方向的歧义绑定。
  async createOrGetSourceBinding(
    input: ThirdPartyComicSourceBindingInput,
  ): Promise<ThirdPartyComicBindingMutationResult> {
    const normalizedInput = this.normalizeSourceInput(input)
    const [localBinding, remoteBinding] = await Promise.all([
      this.getActiveSourceBindingByWorkId(normalizedInput.workId),
      this.findActiveSourceBindingByScope(normalizedInput),
    ])

    if (localBinding) {
      if (this.isSameSourceScope(localBinding, normalizedInput)) {
        return { id: localBinding.id, created: false }
      }
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '作品已绑定其他三方来源，请先解绑或迁移来源',
      )
    }

    if (remoteBinding && remoteBinding.workId !== normalizedInput.workId) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '三方来源已绑定其他作品，不能重复绑定',
      )
    }

    if (remoteBinding) {
      return { id: remoteBinding.id, created: false }
    }

    const [created] = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .insert(this.sourceBinding)
          .values({
            ...normalizedInput,
            providerUuid: normalizedInput.providerUuid ?? null,
          })
          .returning({ id: this.sourceBinding.id }),
      {
        duplicate: '三方来源绑定已存在',
        check: '三方来源绑定字段非法',
      },
    )

    return { id: created.id, created: true }
  }

  // 创建或复用章节绑定，拒绝同一 provider 章节或本地章节的歧义绑定。
  async createOrGetChapterBinding(
    input: ThirdPartyComicChapterBindingInput,
  ): Promise<ThirdPartyComicBindingMutationResult> {
    const normalizedInput = this.normalizeChapterInput(input)
    const [providerBinding, chapterBinding] = await Promise.all([
      this.findActiveChapterBindingByProvider(
        normalizedInput.workThirdPartySourceBindingId,
        normalizedInput.providerChapterId,
      ),
      this.findActiveChapterBindingByChapterId(normalizedInput.chapterId),
    ])

    if (providerBinding) {
      if (providerBinding.chapterId === normalizedInput.chapterId) {
        return { id: providerBinding.id, created: false }
      }
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '三方章节已绑定其他本地章节',
      )
    }

    if (chapterBinding) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '本地章节已绑定其他三方章节',
      )
    }

    const [created] = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .insert(this.chapterBinding)
          .values(normalizedInput)
          .returning({ id: this.chapterBinding.id }),
      {
        duplicate: '三方章节绑定已存在',
        check: '三方章节绑定字段非法',
      },
    )

    return { id: created.id, created: true }
  }

  // 查询来源绑定下全部 active 章节绑定。
  async listActiveChapterBindings(sourceBindingId: number) {
    return this.db
      .select()
      .from(this.chapterBinding)
      .where(
        and(
          eq(
            this.chapterBinding.workThirdPartySourceBindingId,
            sourceBindingId,
          ),
          isNull(this.chapterBinding.deletedAt),
        ),
      )
  }

  // 软删除指定来源绑定。
  async softDeleteSourceBindings(ids: number[]) {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) {
      return
    }

    await this.db
      .update(this.sourceBinding)
      .set({ deletedAt: new Date() })
      .where(
        and(
          inArray(this.sourceBinding.id, uniqueIds),
          isNull(this.sourceBinding.deletedAt),
        ),
      )
  }

  // 软删除指定章节绑定。
  async softDeleteChapterBindings(ids: number[]) {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) {
      return
    }

    await this.db
      .update(this.chapterBinding)
      .set({ deletedAt: new Date() })
      .where(
        and(
          inArray(this.chapterBinding.id, uniqueIds),
          isNull(this.chapterBinding.deletedAt),
        ),
      )
  }

  // 按平台、三方漫画和章节分组读取 active 来源绑定。
  private async findActiveSourceBindingByScope(
    input: ThirdPartyComicSourceScopeInput,
  ) {
    const [row] = await this.db
      .select()
      .from(this.sourceBinding)
      .where(
        and(
          eq(this.sourceBinding.platform, input.platform),
          eq(this.sourceBinding.providerComicId, input.providerComicId),
          eq(
            this.sourceBinding.providerGroupPathWord,
            input.providerGroupPathWord,
          ),
          isNull(this.sourceBinding.deletedAt),
        ),
      )
      .limit(1)

    return row ?? null
  }

  // 归一化来源作用域输入，供只读查询和写入校验共享。
  private normalizeSourceScopeInput(input: ThirdPartyComicSourceScopeInput) {
    const normalized = {
      platform: input.platform.trim(),
      providerComicId: input.providerComicId.trim(),
      providerGroupPathWord: input.providerGroupPathWord.trim(),
    }

    for (const [field, value] of [
      ['platform', normalized.platform],
      ['providerComicId', normalized.providerComicId],
      ['providerGroupPathWord', normalized.providerGroupPathWord],
    ] as const) {
      if (!value) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `三方来源绑定字段 ${field} 不能为空`,
        )
      }
    }

    return normalized
  }

  // 按来源绑定和 provider 章节 ID 读取 active 章节绑定。
  private async findActiveChapterBindingByProvider(
    sourceBindingId: number,
    providerChapterId: string,
  ) {
    const [row] = await this.db
      .select()
      .from(this.chapterBinding)
      .where(
        and(
          eq(
            this.chapterBinding.workThirdPartySourceBindingId,
            sourceBindingId,
          ),
          eq(this.chapterBinding.providerChapterId, providerChapterId),
          isNull(this.chapterBinding.deletedAt),
        ),
      )
      .limit(1)

    return row ?? null
  }

  // 按本地章节 ID 读取 active 章节绑定。
  private async findActiveChapterBindingByChapterId(chapterId: number) {
    const [row] = await this.db
      .select()
      .from(this.chapterBinding)
      .where(
        and(
          eq(this.chapterBinding.chapterId, chapterId),
          isNull(this.chapterBinding.deletedAt),
        ),
      )
      .limit(1)

    return row ?? null
  }

  // 归一化来源绑定输入，并提前阻断空白 source-scope 字段。
  private normalizeSourceInput(input: ThirdPartyComicSourceBindingInput) {
    const sourceScope = this.normalizeSourceScopeInput(input)
    const normalized = {
      ...input,
      platform: sourceScope.platform,
      providerComicId: sourceScope.providerComicId,
      providerPathWord: input.providerPathWord.trim(),
      providerGroupPathWord: sourceScope.providerGroupPathWord,
      providerUuid: input.providerUuid?.trim() || null,
    }

    for (const [field, value] of [
      ['platform', normalized.platform],
      ['providerComicId', normalized.providerComicId],
      ['providerPathWord', normalized.providerPathWord],
      ['providerGroupPathWord', normalized.providerGroupPathWord],
    ] as const) {
      if (!value) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `三方来源绑定字段 ${field} 不能为空`,
        )
      }
    }

    return normalized
  }

  // 归一化章节绑定输入，并提前阻断空白 provider 章节 ID。
  private normalizeChapterInput(input: ThirdPartyComicChapterBindingInput) {
    const providerChapterId = input.providerChapterId.trim()
    if (!providerChapterId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '三方章节ID不能为空',
      )
    }

    return {
      ...input,
      providerChapterId,
      remoteSortOrder: input.remoteSortOrder ?? null,
    }
  }

  // 判断已有绑定是否与本次输入处于同一三方来源作用域。
  private isSameSourceScope(
    binding: WorkThirdPartySourceBindingSelect,
    input: ThirdPartyComicSourceBindingInput,
  ) {
    return (
      binding.platform === input.platform &&
      binding.providerComicId === input.providerComicId &&
      binding.providerGroupPathWord === input.providerGroupPathWord
    )
  }
}
