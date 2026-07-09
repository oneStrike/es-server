import type { Cache } from 'cache-manager'
import type { AdminRbacSubjectSnapshot } from './admin-rbac.type'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'

const REVISION_KEY = 'admin:rbac:revision'
const SUBJECT_PREFIX = 'admin:rbac:subject:'
const BASE_TTL_MS = 10 * 60 * 1000

@Injectable()
export class AdminRbacCacheService {
  private readonly logger = new Logger(AdminRbacCacheService.name)

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  getSubjectKey(adminUserId: number) {
    return `${SUBJECT_PREFIX}${adminUserId}`
  }

  getSnapshotTtlMs() {
    return BASE_TTL_MS + Math.floor(Math.random() * 5 * 60 * 1000)
  }

  async getRevision() {
    return this.cacheManager.get<number>(REVISION_KEY)
  }

  async setRevision(revision: number) {
    await this.cacheManager.set(REVISION_KEY, revision, this.getSnapshotTtlMs())
  }

  async deleteRevision() {
    await this.cacheManager.del(REVISION_KEY)
  }

  async getSubject(adminUserId: number) {
    return this.cacheManager.get<AdminRbacSubjectSnapshot>(
      this.getSubjectKey(adminUserId),
    )
  }

  async setSubject(snapshot: AdminRbacSubjectSnapshot) {
    await this.cacheManager.set(
      this.getSubjectKey(snapshot.adminUserId),
      snapshot,
      Math.max(1, snapshot.expiresAt - Date.now()),
    )
  }

  async deleteSubject(adminUserId: number) {
    await this.cacheManager.del(this.getSubjectKey(adminUserId))
  }

  async invalidate(adminUserIds: number[] = []) {
    try {
      await this.deleteRevision()
      await Promise.all(
        Array.from(new Set(adminUserIds))
          .filter((id) => Number.isFinite(id) && id > 0)
          .map(async (id) => this.deleteSubject(id)),
      )
    } catch (error) {
      this.logger.warn(
        `RBAC cache invalidation degraded: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
