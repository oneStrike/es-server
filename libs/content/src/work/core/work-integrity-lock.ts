import type { IntegrityLock } from '@db/core'
import { tableIntegrityLock } from '@db/core'

/**
 * 内容目录关系写入的统一锁元组。
 *
 * 作品、作者、分类和标签均不使用物理外键；任何会创建、迁移、禁用或删除这些
 * 关系端点的写入必须锁定关联记录并在同一事务内重查业务前提。调用方将多个
 * 元组一次性交给 `acquireIntegrityLocks`，由 core 负责去重、全局排序和加锁。
 */
export function workCatalogWorkLock(workId: number): IntegrityLock {
  return tableIntegrityLock('work', workId)
}

export function workCatalogAuthorLock(authorId: number): IntegrityLock {
  return tableIntegrityLock('work_author', authorId)
}

export function workCatalogCategoryLock(categoryId: number): IntegrityLock {
  return tableIntegrityLock('work_category', categoryId)
}

export function workCatalogTagLock(tagId: number): IntegrityLock {
  return tableIntegrityLock('work_tag', tagId)
}

export function workCatalogRelationEndpointLocks(input: {
  authorIds?: readonly number[]
  categoryIds?: readonly number[]
  tagIds?: readonly number[]
  workIds?: readonly number[]
}): IntegrityLock[] {
  return [
    ...(input.workIds ?? []).map(workCatalogWorkLock),
    ...(input.authorIds ?? []).map(workCatalogAuthorLock),
    ...(input.categoryIds ?? []).map(workCatalogCategoryLock),
    ...(input.tagIds ?? []).map(workCatalogTagLock),
  ]
}
