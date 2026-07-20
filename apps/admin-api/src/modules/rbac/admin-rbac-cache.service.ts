import type { Cache } from 'cache-manager'
import type { AdminRbacSubjectSnapshot } from './admin-rbac.type'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

const REVISION_KEY = 'admin:rbac:revision'
const SUBJECT_PREFIX = 'admin:rbac:subject:'
const BASE_TTL_MS = 10 * 60 * 1000

@Injectable()
export class AdminRbacCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  // 生成单个管理员 RBAC subject 快照的缓存键。
  getSubjectKey(adminUserId: number) {
    return `${SUBJECT_PREFIX}${adminUserId}`
  }

  // 生成带随机抖动的快照 TTL，避免 revision 与 subject 集中失效。
  getSnapshotTtlMs() {
    return BASE_TTL_MS + Math.floor(Math.random() * 5 * 60 * 1000)
  }

  // 读取当前 RBAC 缓存 revision，用于判断 subject 快照是否仍可复用。
  async getRevision() {
    return this.cacheManager.get<number>(REVISION_KEY)
  }

  // 写入当前 RBAC 缓存 revision，并沿用快照 TTL 策略控制有效期。
  async setRevision(revision: number) {
    await this.cacheManager.set(REVISION_KEY, revision, this.getSnapshotTtlMs())
  }

  // 删除全局 RBAC revision，使后续读取重新建立权限快照。
  async deleteRevision() {
    await this.cacheManager.del(REVISION_KEY)
  }

  // 读取指定管理员的 RBAC subject 快照缓存。
  async getSubject(adminUserId: number) {
    return this.cacheManager.get<AdminRbacSubjectSnapshot>(
      this.getSubjectKey(adminUserId),
    )
  }

  // 写入管理员 RBAC subject 快照，过期边界以 snapshot.expiresAt 为准。
  async setSubject(snapshot: AdminRbacSubjectSnapshot) {
    await this.cacheManager.set(
      this.getSubjectKey(snapshot.adminUserId),
      snapshot,
      Math.max(1, snapshot.expiresAt - Date.now()),
    )
  }

  // 删除指定管理员的 RBAC subject 快照缓存。
  async deleteSubject(adminUserId: number) {
    await this.cacheManager.del(this.getSubjectKey(adminUserId))
  }

  // 删除 revision，并只对去重后的有效用户 ID 逐一失效 subject 快照。
  async invalidate(adminUserIds: number[] = []) {
    await this.deleteRevision()
    await Promise.all(
      Array.from(new Set(adminUserIds))
        .filter((id) => Number.isFinite(id) && id > 0)
        .map(async (id) => this.deleteSubject(id)),
    )
  }
}
