import type { SchemaCommentTarget } from '../db/comments/schema-comments'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import {
  buildSchemaCommentsArtifact,
  getSchemaCommentTargetKey,
} from '../db/comments/schema-comments'

const SOURCE_ROOTS = ['apps', 'db', 'libs', 'scripts'] as const
const SKIPPED_DIRECTORIES = new Set(['.git', '.omx', 'dist', 'node_modules'])
const REGISTRY_PATH = 'db/core/integrity-lock-registry.ts'
const MIGRATION_SESSION_LOCK_PATH = 'db/migration-session-lock.ts'
const RETIRED_ROUTINES = new Set([
  'enforce_work_chapter_domain_boundary',
  'enforce_work_domain_boundary',
  'forum_section_level_rule_business_guard',
  'user_level_rule_forum_reference_guard',
])
const RETIRED_TRIGGERS = new Set([
  'forum_section_level_rule_business_guard_trg',
  'user_level_rule_forum_reference_delete_guard_trg',
  'user_level_rule_forum_reference_update_guard_trg',
  'work_chapter_domain_boundary_trg',
  'work_domain_boundary_trg',
])
const CRITICAL_TABLES = new Set([
  'appUser',
  'forumSection',
  'forumSectionGroup',
  'forumTopic',
  'growthLedgerRecord',
  'userAssetBalance',
  'userLevelRule',
  'work',
  'workAuthor',
  'workAuthorRelation',
  'workCategory',
  'workCategoryRelation',
  'workChapter',
  'workTag',
  'workTagRelation',
])
const CRITICAL_SQL_TABLES = new Map(
  [...CRITICAL_TABLES].map((table) => [toSnakeCase(table), table]),
)

type LockMode = 'exclusive' | 'shared'
type WriterCategory = 'integrity' | 'maintenance' | 'non-integrity'

interface LockSiteContract {
  path: string
  producer?: string
  reason: string
  root: string
}

interface LockBuilderRecord {
  mode: LockMode
  resource: string
}

interface LockInventoryRecord extends LockSiteContract {
  builders: LockBuilderRecord[]
  site: string
}

interface WriterRecord {
  category: WriterCategory
  kind: 'drizzle' | 'raw-sql'
  nonNullPayloadKeys: string[]
  operation: string
  owner: string
  payloadKeys: string[]
  table: string
}

interface PayloadAudit {
  fields: Map<string, PayloadFieldState>
  hasUnknownShape: boolean
}

interface PayloadFieldState {
  mayBeNonNull: boolean
}

interface PayloadTypeAnalysis {
  hasUnknownShape: boolean
  rowTypes: ts.Type[]
}

interface PayloadValueAnalysis {
  hasUnknownValue: boolean
  mayBeNonNull: boolean
}

interface IntegrityCounts {
  acquisitionCalls: number
  acquisitionFiles: number
  directIntegrityAdvisoryOutsideOwner: number
  dynamicLockRequests: number
  foreignKeys: number
  qxChangedQueries: number
  rawModeObjects: number
  retiredRoutines: number
  retiredTriggers: number
  s07aRoots: number
  s07bLogicalRoots: number
  unknownLockSites: number
  unknownWriters: number
  writerSites: number
}

interface IntegritySummaries {
  acquisitionDigest: string
  apiDigest: string
  dagDigest: string
  migrationDigest: string
  qxDigest: string
  writerDigest: string
}

export interface DbIntegrityReport {
  counts: IntegrityCounts
  status: 'fail' | 'pass'
  structureDigest: string
  summaries: IntegritySummaries
  violations: string[]
}

interface ProjectContext {
  checker: ts.TypeChecker
  program: ts.Program
  root: string
  sourceFiles: ts.SourceFile[]
}

type SqlTokenKind = 'identifier' | 'quoted-identifier' | 'string' | 'symbol'

interface SqlToken {
  end: number
  kind: SqlTokenKind
  start: number
  value: string
}

interface SqlStatement {
  sql: string
  tokens: SqlToken[]
}

interface MigrationCommentStatement {
  migrationPath: string
  sql: string
  target: SchemaCommentTarget
  valueSql: string
}

interface SchemaCommentTableReference {
  schemaName: string
  tableName: string
}

type SchemaCommentTargetMutation =
  | {
      columnName: string
      operation: 'drop-column'
      table: SchemaCommentTableReference
    }
  | {
      operation: 'drop-table'
      tables: SchemaCommentTableReference[]
    }
  | {
      newSchemaName: string
      operation: 'move-table'
      table: SchemaCommentTableReference
    }
  | {
      columnName: string
      newColumnName: string
      operation: 'rename-column'
      table: SchemaCommentTableReference
    }
  | {
      newTableName: string
      operation: 'rename-table'
      table: SchemaCommentTableReference
    }

interface ParsedSchemaCommentStatement {
  removesComment: boolean
  target: SchemaCommentTarget
  valueSql: string
}

interface MigrationTreeAudit {
  entries: Array<{ kind: 'directory' | 'file' | 'other'; path: string }>
  invalidEntries: string[]
  migrationSqlPaths: string[]
}

interface AcquisitionAnalysis {
  call: ts.CallExpression
  containingOwner: string
  file: string
  records: LockBuilderRecord[]
  site: string
}

interface AcquisitionAuditResult {
  analyses: AcquisitionAnalysis[]
  dynamicCount: number
  inventory: LockInventoryRecord[]
  unknownSiteCount: number
}

interface TransactionAcquisitionEvent {
  loopDepth: number
  mode: LockMode
  resource: string
  site: string
}

const lockContracts = new Map<string, LockSiteContract>()

addLockSites(
  'db/bootstrap/reference.ts',
  undefined,
  ['runReferenceBootstrap'],
  'reference bootstrap mutation',
  'runReferenceBootstrap',
  'exclusive maintenance mutation',
)
addLockSites(
  'db/seed/index.ts',
  undefined,
  ['runDemoSeed'],
  'demo seed mutation',
  'runDemoSeed',
  'exclusive maintenance job',
)
addLockSites(
  'libs/account/src/admin-app-user/admin-app-user-command.service.ts',
  'AdminAppUserCommandService',
  ['createAppUser'],
  'admin create',
  'AdminAppUserCommandService.createAppUser',
  'shared global-rule reference validation',
  'libs/growth/src/app-user-growth-profile/app-user-growth-profile.service.ts#AppUserGrowthProfileService.discoverNewUserDefaultLevelLockPlan',
)
addLockSites(
  'libs/account/src/admin-app-user/admin-app-user-command.service.ts',
  'AdminAppUserCommandService',
  ['lockAndRecheckAppUserReferenceState'],
  'app-user parent mutation',
  'AdminAppUserCommandService app-user mutation roots',
  'exclusive parent mutation',
)
addLockSites(
  'libs/config/src/app-config/config.service.ts',
  'AppConfigService',
  ['ensureActiveConfig'],
  'application configuration uniqueness',
  'AppConfigService.ensureActiveConfig',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/config/src/dictionary/dictionary.service.ts',
  'LibDictionaryService',
  [
    'createDictionary',
    'createDictionaryItem',
    'deleteDictionary',
    'deleteDictionaryItem',
    'updateDictionary',
    'updateDictionaryItem',
    'updateDictionaryItemSort',
    'updateDictionaryItemStatus',
    'updateDictionaryStatus',
  ],
  'dictionary mutation',
  'LibDictionaryService mutation roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/config/src/system-config/system-config.service.ts',
  'SystemConfigService',
  ['updateConfig'],
  'system configuration mutation',
  'SystemConfigService.updateConfig',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/content/src/author/author.service.ts',
  'WorkAuthorService',
  ['deleteAuthor', 'updateAuthor', 'updateAuthorStatus'],
  'author endpoint mutation',
  'WorkAuthorService mutation roots',
  'exclusive endpoint mutation',
)
addLockSites(
  'libs/content/src/category/category.service.ts',
  'WorkCategoryService',
  ['deleteCategory', 'updateCategory', 'updateCategoryStatus'],
  'category endpoint mutation',
  'WorkCategoryService mutation roots',
  'exclusive endpoint mutation',
)
addLockSites(
  'libs/content/src/tag/tag.service.ts',
  'WorkTagService',
  ['deleteTagBatch', 'updateTag', 'updateTagStatus'],
  'tag endpoint mutation',
  'WorkTagService mutation roots',
  'exclusive endpoint mutation',
)
addLockSites(
  'libs/content/src/work/chapter/work-chapter.service.ts',
  'WorkChapterService',
  ['createChapterReturningId', 'deleteChapterRecords', 'updateChapter'],
  'chapter mutation',
  'WorkChapterService mutation roots',
  'complete chapter/resource-parent union',
)
addLockSites(
  'libs/content/src/work/content/comic-archive-import.service.ts',
  'ComicArchiveImportService',
  ['confirmArchive'],
  'comic archive confirmation',
  'ComicArchiveImportService.confirmArchive',
  'complete workflow/import union',
)
addLockSites(
  'libs/content/src/work/content-import/content-import.service.ts',
  'ContentImportService',
  [
    'markItemFailedInTransaction',
    'markItemImageProgress',
    'markItemRateLimitRetryingInTransaction',
    'markItemRetryExhaustedInTransaction',
    'markItemSuccessInTransaction',
    'markThirdPartyImportTargetPrepared',
    'prepareRetryItems',
    'recordUploadedFileResidue',
    'recoverExpiredAttempt',
    'replaceThirdPartySyncItems',
    'startItemAttempt',
    'withLockedWorkflowImportJob',
  ],
  'content import mutation',
  'ContentImportService mutation roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/content/src/work/core/work.service.ts',
  'WorkService',
  [
    'createWorkReturningId',
    'deleteWork',
    'updateStatus',
    'updateWork',
    'updateWorkFlags',
  ],
  'work mutation',
  'WorkService mutation roots',
  'complete work/resource-parent union',
)
addLockSites(
  'libs/content/src/work/third-party/services/third-party-comic-import.service.ts',
  'ThirdPartyComicImportService',
  ['restoreChapterSnapshot'],
  'chapter metadata restore',
  'ThirdPartyComicImportService.rollbackImportTask -> restoreChapterSnapshot',
  'complete chapter restore union',
)
addLockSites(
  'libs/forum/src/hashtag/forum-hashtag.service.ts',
  'ForumHashtagService',
  ['updateHashtagAuditStatus', 'updateHashtagHidden'],
  'forum hashtag mutation',
  'ForumHashtagService mutation roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/forum/src/moderator/moderator.service.ts',
  'ForumModeratorService',
  ['lockSectionGroupsForMutation'],
  'moderator section-group reference establishment',
  'ForumModeratorService mutation roots',
  'shared endpoint validation',
)
addLockSites(
  'libs/forum/src/profile/profile.service.ts',
  'UserProfileService',
  ['updateProfileStatus'],
  'profile parent mutation',
  'UserProfileService.updateProfileStatus',
  'exclusive parent mutation',
)
addLockSites(
  'libs/forum/src/section/forum-section.service.ts',
  'ForumSectionService',
  ['createSection', 'deleteSection', 'updateSection'],
  'forum section mutation',
  'ForumSectionService mutation roots',
  'complete section/resource-parent union',
)
addLockSites(
  'libs/forum/src/section/forum-section.service.ts',
  'ForumSectionService',
  ['lockSectionsForMutation'],
  'forum section entity mutation',
  'ForumSectionService entity mutation roots',
  'exclusive section mutation',
)
addLockSites(
  'libs/forum/src/section-group/forum-section-group.service.ts',
  'ForumSectionGroupService',
  ['lockSectionGroupForMutation'],
  'forum section-group mutation',
  'ForumSectionGroupService mutation roots',
  'exclusive endpoint mutation',
)
addLockSites(
  'libs/forum/src/topic/forum-topic-command.service.ts',
  'ForumTopicCommandService',
  [
    'createForumTopic',
    'lockTopicForMutation',
    'moveTopicInTx',
    'restoreTopicWithCurrentInTx',
  ],
  'forum topic mutation',
  'ForumTopicCommandService mutation roots',
  'topic entity plus section reference union',
)
addLockSites(
  'libs/growth/src/app-user-growth-profile/app-user-growth-profile.service.ts',
  'AppUserGrowthProfileService',
  ['initializeNewUser'],
  'registration initialization',
  'AuthService.register -> AppUserGrowthProfileService.initializeNewUser',
  'shared global-rule reference validation',
  'libs/growth/src/app-user-growth-profile/app-user-growth-profile.service.ts#AppUserGrowthProfileService.discoverNewUserDefaultLevelLockPlan',
)
addLockSites(
  'libs/growth/src/badge/user-badge.service.ts',
  'UserBadgeService',
  [
    'assignBadge',
    'deleteBadge',
    'revokeBadge',
    'updateBadge',
    'updateBadgeStatus',
  ],
  'badge mutation',
  'UserBadgeService mutation roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/growth/src/check-in/check-in-definition.service.ts',
  'CheckInDefinitionService',
  ['publishStreakRule', 'terminateStreakRule'],
  'check-in definition mutation',
  'CheckInDefinitionService mutation roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/growth/src/growth-ledger/growth-ledger.service.ts',
  'GrowthLedgerService',
  ['acquireLedgerOperationLocks'],
  'S-07B ledger phase',
  'four registered experience-capable roots',
  'exclusive growth-ledger business key',
)
addLockSites(
  'libs/growth/src/growth-ledger/growth-ledger.service.ts',
  'GrowthLedgerService',
  ['syncExperienceUsersAfterLedgerBatch'],
  'S-07B terminal rule phase',
  'four registered experience-capable roots',
  'shared terminal user-level-rule reference',
)
addLockSites(
  'libs/growth/src/level-rule/level-rule.service.ts',
  'UserLevelRuleService',
  ['lockLevelRulesForMutation'],
  'level-rule parent mutation',
  'UserLevelRuleService.updateLevelRule/deleteLevelRule',
  'exclusive rule mutation',
)
addLockSites(
  'libs/growth/src/task/task.service.support.ts',
  'TaskServiceSupport',
  ['lockTaskDefinitionForMutation'],
  'task definition mutation',
  'TaskService mutation roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/identity/src/admin-rbac.service.ts',
  'AdminRbacService',
  [
    'acquireRbacMutationLocksInTransaction',
    'acquireSuperAdminMutationLocksInTransaction',
  ],
  'admin RBAC mutation',
  'AdminRbacService mutation roots',
  'exclusive RBAC mutation union',
)
addLockSites(
  'libs/interaction/src/comment/comment.service.ts',
  'CommentService',
  ['createComment', 'deleteCommentInTx', 'replyComment'],
  'comment mutation',
  'CommentService mutation roots',
  'complete rate-limit/target/comment union',
)
addLockSites(
  'libs/interaction/src/coupon/coupon-admin-grant-workflow.handler.ts',
  'CouponAdminGrantWorkflowHandler',
  ['processItem'],
  'coupon workflow grant',
  'CouponAdminGrantWorkflowHandler.processItem',
  'shared grant-parent union',
)
addLockSites(
  'libs/interaction/src/coupon/coupon-admin-grant-workflow.service.ts',
  'CouponAdminGrantWorkflowService',
  ['prepareCreateCommandInTransaction'],
  'coupon workflow creation',
  'CouponAdminGrantWorkflowService.prepareCreateCommandInTransaction',
  'exclusive workflow mutation',
)
addLockSites(
  'libs/interaction/src/coupon/coupon.service.ts',
  'CouponService',
  [
    'grantCoupon',
    'lockCouponDefinition',
    'lockCouponInstanceAndUserForRedemption',
  ],
  'coupon mutation',
  'CouponService mutation roots',
  'complete coupon/parent union',
)
addLockSites(
  'libs/interaction/src/favorite/favorite.service.ts',
  'FavoriteService',
  ['favorite'],
  'favorite mutation',
  'FavoriteService.favorite',
  'complete quota/target union',
)
addLockSites(
  'libs/interaction/src/like/like.service.ts',
  'LikeService',
  ['like'],
  'like mutation',
  'LikeService.like',
  'complete quota/target union',
)
addLockSites(
  'libs/interaction/src/payment/payment-order.service.ts',
  'PaymentOrderService',
  ['createPaymentOrder'],
  'payment order provider configuration reference',
  'PaymentOrderService.createPaymentOrder',
  'shared provider configuration snapshot',
)
addLockSites(
  'libs/interaction/src/payment/payment-settlement.service.ts',
  'PaymentSettlementService',
  ['executePaidOrderMutationWithMembershipRetry'],
  'paid membership activation',
  'PaymentSettlementService paid-order mutation roots',
  'complete membership/coupon/ledger union',
  'libs/interaction/src/membership/membership.service.ts#MembershipService.preparePaidOrderActivation',
)
addLockSites(
  'libs/interaction/src/payment/payment-notify.service.ts',
  'PaymentNotifyService',
  ['resolveVerifiedPaymentNotifyEvent'],
  'payment notification provider event deduplication',
  'PaymentNotifyService.resolveVerifiedPaymentNotifyEvent',
  'exclusive payment notification provider-event relation',
)
addLockSites(
  'libs/interaction/src/payment/payment-provider-config.service.ts',
  'PaymentProviderConfigService',
  ['updatePaymentProviderConfig', 'updatePaymentProviderStatus'],
  'payment provider configuration mutation',
  'PaymentProviderConfigService mutation roots',
  'exclusive payment provider configuration record',
)
addLockSites(
  'libs/interaction/src/purchase/purchase.service.ts',
  'PurchaseService',
  ['executePurchaseAttempt'],
  'purchase mutation',
  'PurchaseService.purchaseTarget -> executePurchaseAttempt',
  'complete purchase/coupon/wallet/ledger union',
  'libs/interaction/src/purchase/purchase.service.ts#PurchaseService.preparePurchaseAttempt',
)
addLockSites(
  'libs/message/src/chat/chat.service.ts',
  'MessageChatService',
  ['createMessageWithRetry'],
  'chat message creation',
  'MessageChatService.createMessageWithRetry',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/message/src/eventing/notification-projection.service.ts',
  'NotificationProjectionService',
  ['deleteNotificationProjectionInTransaction'],
  'notification projection mutation',
  'NotificationProjectionService mutation roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/message/src/notification/notification-delivery.service.ts',
  'MessageNotificationDeliveryService',
  ['lockAndRecheckNotificationForDeliveryInTransaction'],
  'notification delivery mutation',
  'MessageNotificationDeliveryService delivery roots',
  'exclusive non-reference mutation',
)
addLockSites(
  'libs/workflow/src/workflow/workflow.service.ts',
  'WorkflowService',
  ['confirmDraft'],
  'workflow draft confirmation',
  'WorkflowService.confirmDraft',
  'exclusive workflow/import union',
)

const writerOwners = new Map<string, WriterCategory>()

addWriterOwners(
  'db/seed/index.ts',
  undefined,
  ['cleanupRetiredAppUserDomain'],
  'maintenance',
)
addWriterOwners(
  'db/seed/index.ts',
  undefined,
  ['cleanupLegacyForumResidue', 'cleanupRetiredWorkDomain'],
  'maintenance',
)
addWriterOwners(
  'db/seed/modules/app/domain.ts',
  undefined,
  ['seedAppActivityDomain', 'seedAppCoreDomain'],
  'maintenance',
)
addWriterOwners(
  'db/seed/modules/forum/domain.ts',
  undefined,
  [
    'rebuildForumCounters',
    'rebuildTopicCounter',
    'resetForumSimulationData',
    'seedForumReferenceDomain',
    'seedSectionTopics',
  ],
  'maintenance',
)
addWriterOwners(
  'db/seed/modules/work/domain.ts',
  undefined,
  ['seedWorkDomain'],
  'maintenance',
)
addWriterOwners(
  'libs/account/src/admin-app-user/admin-app-user-command.service.ts',
  'AdminAppUserCommandService',
  ['createAppUser'],
  'integrity',
)
addWriterOwners(
  'libs/account/src/admin-app-user/admin-app-user-command.service.ts',
  'AdminAppUserCommandService',
  [
    'deleteAppUser',
    'resetAppUserPassword',
    'restoreAppUser',
    'updateAppUserEnabled',
    'updateAppUserProfile',
    'updateAppUserStatus',
  ],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/author/author.service.ts',
  'WorkAuthorService',
  ['deleteAuthor', 'updateAuthor', 'updateAuthorStatus'],
  'integrity',
)
addWriterOwners(
  'libs/content/src/author/author.service.ts',
  'WorkAuthorService',
  [
    'applyAuthorFollowersCountDelta',
    'applyAuthorWorkCountDelta',
    'createAuthor',
    'rebuildAuthorFollowersCount',
    'rebuildAuthorWorkCount',
    'updateAuthorRecommended',
  ],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/category/category.service.ts',
  'WorkCategoryService',
  ['deleteCategory', 'updateCategory', 'updateCategoryStatus'],
  'integrity',
)
addWriterOwners(
  'libs/content/src/category/category.service.ts',
  'WorkCategoryService',
  ['createCategory', 'updateCategorySort'],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/tag/tag.service.ts',
  'WorkTagService',
  ['deleteTagBatch', 'updateTag', 'updateTagStatus'],
  'integrity',
)
addWriterOwners(
  'libs/content/src/tag/tag.service.ts',
  'WorkTagService',
  ['createTag', 'updateTagSort'],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/work/chapter/work-chapter.service.ts',
  'WorkChapterService',
  [
    'batchUpdateChapterPublishStatus',
    'createChapterReturningId',
    'deleteChapterRecords',
    'swapChapterNumbers',
    'updateChapter',
  ],
  'integrity',
)
addWriterOwners(
  'libs/content/src/work/content/comic-archive-import.service.ts',
  'ComicArchiveImportService',
  ['importChapter'],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/work/content/comic-content.service.ts',
  'ComicContentService',
  ['saveChapterContent'],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/work/content/novel-content.service.ts',
  'NovelContentService',
  ['deleteChapterContent', 'uploadChapterContent'],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/work/core/work.service.ts',
  'WorkService',
  [
    'createWorkReturningId',
    'deleteWork',
    'updateStatus',
    'updateWork',
    'updateWorkFlags',
  ],
  'integrity',
)
addWriterOwners(
  'libs/content/src/work/counter/work-counter.service.ts',
  'WorkCounterService',
  [
    'applyWorkChapterCountDelta',
    'applyWorkCountDelta',
    'rebuildWorkChapterCounts',
    'rebuildWorkCounts',
  ],
  'non-integrity',
)
addWriterOwners(
  'libs/content/src/work/third-party/services/third-party-comic-import.service.ts',
  'ThirdPartyComicImportService',
  ['restoreChapterSnapshot'],
  'integrity',
)
addWriterOwners(
  'libs/forum/src/counter/forum-counter.service.ts',
  'ForumCounterService',
  [
    'applySectionCountDelta',
    'applyTopicCountDelta',
    'rebuildSectionFollowersCount',
    'rebuildTopicInteractionCounts',
    'syncSectionVisibleState',
    'syncTopicCommentState',
  ],
  'non-integrity',
)
addWriterOwners(
  'libs/forum/src/profile/profile.service.ts',
  'UserProfileService',
  ['updateProfileStatus'],
  'integrity',
)
addWriterOwners(
  'libs/forum/src/section/forum-section.service.ts',
  'ForumSectionService',
  [
    'createManagedSectionForWork',
    'createSection',
    'deleteSection',
    'releaseManagedSectionForWork',
    'syncManagedSectionForWork',
    'updateEnabledStatus',
    'updateSection',
    'updateSectionSort',
  ],
  'integrity',
)
addWriterOwners(
  'libs/forum/src/section-group/forum-section-group.service.ts',
  'ForumSectionGroupService',
  [
    'createSectionGroup',
    'deleteSectionGroup',
    'swapSectionGroupSortOrder',
    'updateSectionGroup',
    'updateSectionGroupEnabled',
  ],
  'integrity',
)
addWriterOwners(
  'libs/forum/src/topic/forum-topic-command.service.ts',
  'ForumTopicCommandService',
  [
    'createForumTopic',
    'deleteTopicWithCurrentInTx',
    'moveTopicInTx',
    'restoreTopicWithCurrentInTx',
  ],
  'integrity',
)
addWriterOwners(
  'libs/forum/src/topic/forum-topic-command.service.ts',
  'ForumTopicCommandService',
  [
    'updateTopicAuditStatusInTx',
    'updateTopicHiddenInTx',
    'updateTopicStatusInTx',
    'updateTopicWithCurrent',
  ],
  'non-integrity',
)
addWriterOwners(
  'libs/growth/src/app-user-growth-profile/app-user-growth-profile.service.ts',
  'AppUserGrowthProfileService',
  ['applyNewUserInitializationAfterLockInTx'],
  'integrity',
)
addWriterOwners(
  'libs/growth/src/growth-ledger/growth-ledger.service.ts',
  'GrowthLedgerService',
  [
    'decrementUserBalance',
    'incrementUserBalance',
    'insertLedgerRecord',
    'syncUserLevel',
  ],
  'integrity',
)
addWriterOwners(
  'libs/growth/src/level-rule/level-rule.service.ts',
  'UserLevelRuleService',
  [
    'clearLevelRuleReferencesInTx',
    'createLevelRule',
    'deleteLevelRule',
    'updateLevelRule',
  ],
  'integrity',
)
addWriterOwners(
  'libs/identity/src/app-user-credential.service.ts',
  'AppUserCredentialService',
  ['registerAppUser', 'updateLoginInfo', 'updatePassword'],
  'integrity',
)
addWriterOwners(
  'libs/user/src/user.service.ts',
  'UserService',
  ['changeUserPhoneNumber', 'updateUserProfile'],
  'non-integrity',
)

const S07A_ROOTS = [
  'apps/app-api/src/modules/auth/auth.service.ts#AuthService.register',
  'libs/account/src/admin-app-user/admin-app-user-command.service.ts#AdminAppUserCommandService.createAppUser',
  'libs/content/src/work/chapter/work-chapter.service.ts#WorkChapterService.createChapterReturningId',
  'libs/content/src/work/chapter/work-chapter.service.ts#WorkChapterService.deleteChapterRecords',
  'libs/content/src/work/chapter/work-chapter.service.ts#WorkChapterService.updateChapter',
  'libs/content/src/work/core/work.service.ts#WorkService.createWorkReturningId',
  'libs/content/src/work/core/work.service.ts#WorkService.deleteWork',
  'libs/content/src/work/core/work.service.ts#WorkService.updateWork',
  'libs/content/src/work/third-party/services/third-party-comic-import.service.ts#ThirdPartyComicImportService.restoreChapterSnapshot',
  'libs/forum/src/section/forum-section.service.ts#ForumSectionService.createSection',
  'libs/forum/src/section/forum-section.service.ts#ForumSectionService.deleteSection',
  'libs/forum/src/section/forum-section.service.ts#ForumSectionService.updateSection',
  'libs/forum/src/topic/forum-topic-command.service.ts#ForumTopicCommandService.createForumTopic',
  'libs/forum/src/topic/forum-topic-command.service.ts#ForumTopicCommandService.moveTopicInTx',
] as const

const S07A_APPLY_METHODS = [
  'libs/forum/src/section/forum-section.service.ts#ForumSectionService.createManagedSectionForWork',
  'libs/forum/src/section/forum-section.service.ts#ForumSectionService.releaseManagedSectionForWork',
  'libs/forum/src/section/forum-section.service.ts#ForumSectionService.syncManagedSectionForWork',
  'libs/growth/src/app-user-growth-profile/app-user-growth-profile.service.ts#AppUserGrowthProfileService.applyNewUserInitializationAfterLockInTx',
] as const

const S07B_ROOTS = [
  'libs/growth/src/experience/experience.service.ts#UserExperienceService.addExperience',
  'libs/growth/src/growth-reward/growth-event-dispatch.service.ts#GrowthEventDispatchService.dispatchDefinedEvent',
  'libs/growth/src/growth-reward/growth-reward.service.ts#UserGrowthRewardService.tryRewardTaskComplete',
  'libs/growth/src/check-in/check-in-settlement.service.ts#CheckInSettlementService.settleGrantReward',
  'libs/growth/src/check-in/check-in-settlement.service.ts#CheckInSettlementService.settleRecordReward',
] as const

const EXPERIENCE_LEDGER_CALLS = new Set([
  'libs/growth/src/check-in/check-in-settlement.service.ts#CheckInSettlementService.applyRewardItems->applyDeltaBatch',
  'libs/growth/src/experience/experience.service.ts#UserExperienceService.addExperience->applyByRule',
  'libs/growth/src/growth-reward/growth-reward.service.ts#UserGrowthRewardService.tryRewardByRule->applyByRuleBatch',
  'libs/growth/src/growth-reward/growth-reward.service.ts#UserGrowthRewardService.tryRewardTaskComplete->applyDeltaBatch',
])

const NON_EXPERIENCE_LEDGER_CALLS = new Set([
  'libs/growth/src/point/point.service.ts#UserPointService.addPoints->applyByRule',
  'libs/growth/src/point/point.service.ts#UserPointService.consumePointsInTx->applyDelta',
  'libs/growth/src/point/point.service.ts#UserPointService.syncWithComicSystem->applyDelta',
  'libs/interaction/src/wallet/wallet.service.ts#WalletService.applyRechargeSettlement->applyDelta',
])

const EXPECTED_ACQUISITION_DIGEST =
  '359ba898a4ac6f6d69d0eb1a2149d68395f3a4ac77435bb2a2e4881d0f772dbf'
const EXPECTED_WRITER_DIGEST =
  '42ecc1d2efc1065f4b09ea51290e15e291c43a4d9938f85f01404ef273c04d32'

/**
 * 以 TypeScript AST 与结构化 SQL token 重新计算完整性门禁；不连接数据库，也不读取环境变量。
 */
export function collectDbIntegrityReport(root: string): DbIntegrityReport {
  const context = createProjectContext(root)
  const violations: string[] = []
  const api = auditLockApi(context, violations)
  const acquisitions = auditAcquisitions(context, api.acquirer, violations)
  const writers = auditWriters(context, violations)
  const dag = auditDags(context, api.acquirer, acquisitions, violations)
  const qx = auditQxQueries(context, violations)
  const migration = auditMigrationsAndSchema(context, violations)

  const acquisitionDigest = digest(acquisitions.inventory)
  const writerDigest = digest(writers.records)
  if (
    EXPECTED_ACQUISITION_DIGEST.length > 0 &&
    acquisitionDigest !== EXPECTED_ACQUISITION_DIGEST
  ) {
    violations.push('LOCK_INVENTORY_DIGEST_MISMATCH')
  }
  if (
    EXPECTED_WRITER_DIGEST.length > 0 &&
    writerDigest !== EXPECTED_WRITER_DIGEST
  ) {
    violations.push('WRITER_INVENTORY_DIGEST_MISMATCH')
  }

  const summaries: IntegritySummaries = {
    acquisitionDigest,
    apiDigest: digest(api.summary),
    dagDigest: digest(dag.summary),
    migrationDigest: digest(migration.summary),
    qxDigest: digest(qx.summary),
    writerDigest,
  }
  const counts: IntegrityCounts = {
    acquisitionCalls: acquisitions.inventory.length,
    acquisitionFiles: new Set(
      acquisitions.inventory.map((item) => item.site.split('#')[0]),
    ).size,
    directIntegrityAdvisoryOutsideOwner:
      api.directIntegrityAdvisoryOutsideOwner,
    dynamicLockRequests: acquisitions.dynamicCount,
    foreignKeys: migration.foreignKeyCount,
    qxChangedQueries: qx.changedCount,
    rawModeObjects: api.rawModeObjectCount,
    retiredRoutines: migration.retiredRoutineCount,
    retiredTriggers: migration.retiredTriggerCount,
    s07aRoots: dag.s07aRootCount,
    s07bLogicalRoots: dag.s07bLogicalRootCount,
    unknownLockSites: acquisitions.unknownSiteCount,
    unknownWriters: writers.unknownCount,
    writerSites: writers.records.length,
  }
  const normalizedViolations = [...new Set(violations)].sort()
  return {
    counts,
    status: normalizedViolations.length === 0 ? 'pass' : 'fail',
    structureDigest: digest({ counts, summaries }),
    summaries,
    violations: normalizedViolations,
  }
}

function auditLockApi(context: ProjectContext, violations: string[]) {
  const registry = readSourceFile(context, REGISTRY_PATH)
  const declarations = {
    acquirer: findTopLevelFunctions(context, 'acquireIntegrityLocks'),
    exclusiveBuilder: findTopLevelFunctions(context, 'exclusiveIntegrityLock'),
    sharedBuilder: findTopLevelFunctions(context, 'sharedIntegrityLock'),
  }
  for (const [name, found] of Object.entries(declarations)) {
    if (
      found.length !== 1 ||
      repoPath(context, found[0]?.getSourceFile()) !== REGISTRY_PATH
    ) {
      violations.push(`API_${name.toUpperCase()}_DECLARATION_COUNT`)
    }
  }

  const acquirer = declarations.acquirer[0]
  const requestInterface = registry.statements.find(
    (node): node is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(node) &&
      node.name.text === 'IntegrityLockRequest',
  )
  const modeAlias = registry.statements.find(
    (node): node is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(node) && node.name.text === 'IntegrityLockMode',
  )
  if (!requestInterface) {
    violations.push('API_REQUEST_INTERFACE_MISSING')
  } else {
    const mode = requestInterface.members.find(
      (member): member is ts.PropertySignature =>
        ts.isPropertySignature(member) &&
        ts.isIdentifier(member.name) &&
        member.name.text === 'mode',
    )
    if (!mode || mode.questionToken || mode.initializer) {
      violations.push('API_REQUEST_MODE_NOT_MANDATORY')
    }
  }
  if (!modeAlias || !isExactModeUnion(modeAlias.type)) {
    violations.push('API_MODE_UNION_NOT_CLOSED')
  }
  if (
    !acquirer ||
    acquirer.parameters.length !== 2 ||
    acquirer.parameters.some((parameter) =>
      Boolean(parameter.questionToken || parameter.initializer),
    )
  ) {
    violations.push('API_ACQUIRER_SIGNATURE_INVALID')
  }

  let rawModeObjectCount = 0
  let directIntegrityAdvisoryOutsideOwner = 0
  let legacyAcquirerReferenceCount = 0
  let forwardedAcquirerReferenceCount = 0
  for (const sourceFile of context.sourceFiles) {
    const file = repoPath(context, sourceFile)
    walk(sourceFile, (node) => {
      if (
        ts.isIdentifier(node) &&
        node.text === 'acquireIntegrityLocksWithQueryExecutor'
      ) {
        legacyAcquirerReferenceCount += 1
      }
      if (
        ts.isObjectLiteralExpression(node) &&
        file !== REGISTRY_PATH &&
        hasRawModeProperty(node)
      ) {
        rawModeObjectCount += 1
      }
      const sqlText = readSqlText(node)
      if (sqlText !== undefined) {
        const advisoryFunctions = readAdvisoryFunctionTokens(sqlText)
        if (advisoryFunctions.length > 0) {
          if (file === REGISTRY_PATH) {
            const allowed = new Set([
              'pg_advisory_xact_lock',
              'pg_advisory_xact_lock_shared',
            ])
            if (advisoryFunctions.some((name) => !allowed.has(name))) {
              violations.push('API_REGISTRY_ADVISORY_FUNCTION_INVALID')
            }
          } else if (file === MIGRATION_SESSION_LOCK_PATH) {
            const allowed = new Set([
              'pg_advisory_unlock',
              'pg_try_advisory_lock',
            ])
            if (advisoryFunctions.some((name) => !allowed.has(name))) {
              directIntegrityAdvisoryOutsideOwner += 1
            }
          } else {
            directIntegrityAdvisoryOutsideOwner += 1
          }
        }
      }
      if (
        acquirer &&
        ts.isIdentifier(node) &&
        resolvesToDeclaration(context, node, acquirer) &&
        !isAllowedCallableReference(node)
      ) {
        forwardedAcquirerReferenceCount += 1
      }
    })
  }
  if (legacyAcquirerReferenceCount > 0) {
    violations.push('API_LEGACY_ACQUIRER_PRESENT')
  }
  if (rawModeObjectCount > 0) {
    violations.push('API_RAW_MODE_OBJECT_OUTSIDE_OWNER')
  }
  if (directIntegrityAdvisoryOutsideOwner > 0) {
    violations.push('LOCK_DIRECT_ADVISORY_OUTSIDE_OWNER')
  }
  if (forwardedAcquirerReferenceCount > 0) {
    violations.push('API_FORWARDING_ACQUIRER_REFERENCE')
  }
  if (acquirer) {
    auditSequentialRegistry(context, acquirer, violations)
  }

  return {
    acquirer,
    directIntegrityAdvisoryOutsideOwner,
    rawModeObjectCount,
    summary: {
      acquirerDeclarations: declarations.acquirer.length,
      exclusiveBuilderDeclarations: declarations.exclusiveBuilder.length,
      legacyAcquirerReferenceCount,
      forwardedAcquirerReferenceCount,
      sharedBuilderDeclarations: declarations.sharedBuilder.length,
    },
  }
}

function auditAcquisitions(
  context: ProjectContext,
  acquirer: ts.FunctionDeclaration | undefined,
  violations: string[],
): AcquisitionAuditResult {
  const analyses: AcquisitionAnalysis[] = []
  let dynamicCount = 0
  let unknownSiteCount = 0
  if (!acquirer) {
    return { analyses, dynamicCount, inventory: [], unknownSiteCount }
  }

  for (const sourceFile of context.sourceFiles) {
    walk(sourceFile, (node) => {
      if (
        !ts.isCallExpression(node) ||
        !resolvesCallToDeclaration(context, node, acquirer)
      ) {
        return
      }
      const file = repoPath(context, sourceFile)
      if (file === REGISTRY_PATH) {
        violations.push('API_ACQUIRER_RECURSIVE_CALL')
        return
      }
      const containingOwner = declarationOwner(context, node)
      const site = `${file}#${containingOwner}`
      const contract = lockContracts.get(site)
      if (!contract) {
        unknownSiteCount += 1
        violations.push('LOCK_UNKNOWN_ACQUISITION_SITE')
      }
      const requestExpression = node.arguments[1]
      const records = requestExpression
        ? analyzeRequestExpression(
            context,
            requestExpression,
            contract?.producer,
          )
        : []
      if (records.length === 0) {
        dynamicCount += 1
        violations.push('LOCK_DYNAMIC_OR_EMPTY_REQUEST')
      }
      if (records.some((record) => record.resource === 'unknown')) {
        dynamicCount += 1
        violations.push('LOCK_DYNAMIC_RESOURCE')
      }
      if (node.arguments.length !== 2) {
        violations.push('LOCK_ACQUIRER_ARGUMENT_COUNT')
      }
      if (isWithinDirectIteration(node)) {
        violations.push('LOCK_CALLER_ACQUISITION_LOOP')
      }
      analyses.push({ call: node, containingOwner, file, records, site })
    })
  }

  const actualSites = new Set(analyses.map((analysis) => analysis.site))
  for (const site of lockContracts.keys()) {
    if (!actualSites.has(site)) {
      violations.push('LOCK_EXPECTED_ACQUISITION_SITE_MISSING')
    }
  }
  const duplicateSites = groupCounts(analyses.map((analysis) => analysis.site))
  if ([...duplicateSites.values()].some((count) => count !== 1)) {
    violations.push('LOCK_ACQUISITION_SITE_NOT_UNIQUE')
  }

  const inventory = analyses
    .map((analysis): LockInventoryRecord => {
      const contract = lockContracts.get(analysis.site) ?? {
        path: 'unknown',
        reason: 'unknown',
        root: 'unknown',
      }
      return {
        ...contract,
        builders: normalizeBuilderRecords(analysis.records),
        site: analysis.site,
      }
    })
    .sort((left, right) => left.site.localeCompare(right.site))

  return { analyses, dynamicCount, inventory, unknownSiteCount }
}

function auditWriters(context: ProjectContext, violations: string[]) {
  const records: WriterRecord[] = []
  let unknownCount = 0
  for (const sourceFile of context.sourceFiles) {
    const file = repoPath(context, sourceFile)
    walk(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) {
        return
      }
      const drizzleWrite = readDrizzleWrite(context, node)
      if (drizzleWrite && CRITICAL_TABLES.has(drizzleWrite.table)) {
        const owner = `${file}#${declarationOwner(context, node)}`
        const category = writerOwners.get(owner)
        const payloadAudit = readWritePayloadAudit(context, node)
        if (!category) {
          unknownCount += 1
          violations.push('WRITER_UNKNOWN_DRIZZLE_OWNER')
        }
        if (payloadAudit.hasUnknownShape) {
          unknownCount += 1
          violations.push('WRITER_UNKNOWN_PAYLOAD_SHAPE')
        }
        records.push({
          category: category ?? 'non-integrity',
          kind: 'drizzle',
          nonNullPayloadKeys: readPotentiallyNonNullPayloadKeys(payloadAudit),
          operation: drizzleWrite.operation,
          owner,
          payloadKeys: readKnownPayloadKeys(payloadAudit),
          table: drizzleWrite.table,
        })
      }
    })
    collectRawSqlWriters(context, sourceFile, records, violations, () => {
      unknownCount += 1
    })
  }
  const actualOwners = new Set(records.map((record) => record.owner))
  for (const owner of writerOwners.keys()) {
    if (!actualOwners.has(owner)) {
      violations.push('WRITER_EXPECTED_OWNER_MISSING')
    }
  }
  validateClosedAppUserLevelWriters(records, violations)
  return {
    records: records.sort(compareWriterRecords),
    unknownCount,
  }
}

function auditDags(
  context: ProjectContext,
  acquirer: ts.FunctionDeclaration | undefined,
  acquisitions: ReturnType<typeof auditAcquisitions>,
  violations: string[],
) {
  if (!acquirer) {
    return {
      s07aRootCount: 0,
      s07bLogicalRootCount: 0,
      summary: {},
    }
  }
  const acquisitionByStart = new Map(
    acquisitions.analyses.map((analysis) => [
      nodeLocationKey(context, analysis.call),
      analysis,
    ]),
  )
  const s07aTraces: object[] = []
  for (const root of S07A_ROOTS) {
    const declaration = readNamedDeclaration(context, root)
    if (!declaration) {
      violations.push('DAG_S07A_ROOT_MISSING')
      continue
    }
    const events = traceTransactionAcquisitions(
      context,
      declaration,
      acquirer,
      acquisitionByStart,
      new Set(),
    )
    if (new Set(events.map((event) => event.site)).size !== 1) {
      violations.push('DAG_S07A_ACQUISITION_COUNT')
    }
    s07aTraces.push({
      events: events.map(normalizeTransactionEvent),
      root,
    })
  }
  for (const apply of S07A_APPLY_METHODS) {
    const declaration = readNamedDeclaration(context, apply)
    if (!declaration) {
      violations.push('DAG_S07A_APPLY_MISSING')
      continue
    }
    const events = traceTransactionAcquisitions(
      context,
      declaration,
      acquirer,
      acquisitionByStart,
      new Set(),
    )
    if (events.length !== 0) {
      violations.push('DAG_S07A_APPLY_ACQUISITION')
    }
  }

  const s07bTraces: object[] = []
  for (const root of S07B_ROOTS) {
    const declaration = readNamedDeclaration(context, root)
    if (!declaration) {
      violations.push('DAG_S07B_ROOT_MISSING')
      continue
    }
    const events = traceTransactionAcquisitions(
      context,
      declaration,
      acquirer,
      acquisitionByStart,
      new Set(),
      new Set([
        'libs/growth/src/growth-reward/growth-event-dispatch.service.ts#GrowthEventDispatchService.dispatchDefinedEvent->libs/growth/src/growth-reward/growth-reward.service.ts#UserGrowthRewardService.tryRewardByRule',
      ]),
    )
    const normalized = events.map(normalizeTransactionEvent)
    if (
      normalized.length !== 2 ||
      normalized[0]?.mode !== 'exclusive' ||
      normalized[0]?.resource !== 'relation:growth-ledger-biz-key' ||
      normalized[1]?.mode !== 'shared' ||
      normalized[1]?.resource !== 'record:user_level_rule'
    ) {
      violations.push('DAG_S07B_PHASE_ORDER')
    }
    s07bTraces.push({ events: normalized, root })
  }
  auditExperienceLedgerCallSet(context, violations)
  auditLedgerTerminalShape(context, violations)

  return {
    s07aRootCount: S07A_ROOTS.length,
    s07bLogicalRootCount: 4,
    summary: {
      s07aApplyCount: S07A_APPLY_METHODS.length,
      s07aTraces,
      s07bTraces,
    },
  }
}

function auditQxQueries(context: ProjectContext, violations: string[]) {
  const update = readNamedDeclaration(
    context,
    'libs/growth/src/level-rule/level-rule.service.ts#UserLevelRuleService.updateLevelRule',
  )
  const remove = readNamedDeclaration(
    context,
    'libs/growth/src/level-rule/level-rule.service.ts#UserLevelRuleService.deleteLevelRule',
  )
  const signatures = [
    ...readLevelRuleExistenceSignatures(
      context,
      update,
      'updateLevelRule',
      violations,
    ),
    ...readLevelRuleExistenceSignatures(
      context,
      remove,
      'deleteLevelRule',
      violations,
    ),
  ].sort((left, right) => left.localeCompare(right))
  const expected = [
    'deleteLevelRule:appUser:levelId=id,deletedAt:is-null',
    'deleteLevelRule:forumSection:userLevelRuleId=id,deletedAt:is-null',
    'updateLevelRule:appUser:levelId=id,deletedAt:is-null',
    'updateLevelRule:forumSection:userLevelRuleId=id,deletedAt:is-null',
  ].sort((left, right) => left.localeCompare(right))
  if (!sameStrings(signatures, expected)) {
    violations.push('QX_EXISTENCE_QUERY_SET')
  }
  const qxChanged = signatures.filter(
    (signature) =>
      signature.startsWith('updateLevelRule:') ||
      signature.startsWith('deleteLevelRule:appUser:'),
  )
  if (qxChanged.length !== 3) {
    violations.push('QX_CHANGED_SET_COUNT')
  }
  if (update && countNamedCalls(update, '$count') > 0) {
    violations.push('QX_UPDATE_COUNT_REMAINS')
  }
  if (remove && countNamedCalls(remove, '$count') > 0) {
    violations.push('QX_DELETE_COUNT_REMAINS')
  }
  if (
    !remove ||
    !containsStringLiteral(remove, '该等级规则下还有用户，无法删除')
  ) {
    violations.push('QX_DELETE_MESSAGE_DRIFT')
  }
  return {
    changedCount: qxChanged.length,
    summary: { changed: qxChanged, completeExistenceSet: signatures },
  }
}

function auditMigrationsAndSchema(
  context: ProjectContext,
  violations: string[],
) {
  const migrationTree = auditMigrationTree(context.root)
  const { migrationSqlPaths } = migrationTree
  const commentArtifact = buildSchemaCommentsArtifact()
  const expectedCommentsByTarget = new Map(
    commentArtifact.commentStatements.map((statement) => [
      statement.target.targetKey,
      {
        sql: statement.sql,
        valueSql: readSchemaCommentValueSql(statement.sql),
      },
    ]),
  )
  const finalCommentsByTarget = new Map<string, MigrationCommentStatement>()
  const targetlessCommentStatements: string[] = []
  const transactionControlStatements: string[] = []
  let foreignKeyCount = 0
  let migrationCommentStatementCount = 0
  let retiredRoutineCount = 0
  let retiredTriggerCount = 0
  let routineDeclarationCount = 0
  let triggerDeclarationCount = 0

  if (migrationSqlPaths.length === 0) {
    violations.push('MIGRATION_SQL_MISSING')
  }
  if (migrationTree.invalidEntries.length > 0) {
    violations.push('MIGRATION_TREE_NOT_STANDARD_DRIZZLE')
  }
  if (
    expectedCommentsByTarget.size !== commentArtifact.commentStatements.length
  ) {
    violations.push('MIGRATION_SCHEMA_COMMENT_ARTIFACT_DUPLICATE_TARGET')
  }

  for (const migrationPath of migrationSqlPaths) {
    const source = readFileSync(join(context.root, migrationPath), 'utf8')
    const tokens = tokenizeSql(source)
    foreignKeyCount += countSqlForeignKeys(tokens)
    routineDeclarationCount += countSqlObjectDeclarations(
      tokens,
      new Set(['function', 'procedure']),
    )
    triggerDeclarationCount += countSqlObjectDeclarations(
      tokens,
      new Set(['trigger']),
    )
    retiredRoutineCount += tokens.filter((token) =>
      RETIRED_ROUTINES.has(token),
    ).length
    retiredTriggerCount += tokens.filter((token) =>
      RETIRED_TRIGGERS.has(token),
    ).length

    for (const statement of splitPostgresSqlStatements(source)) {
      if (isTransactionControlStatement(statement)) {
        transactionControlStatements.push(`${migrationPath}:${statement.sql}`)
      }

      const comment = parseSchemaCommentStatement(statement)
      if (comment === 'targetless') {
        targetlessCommentStatements.push(`${migrationPath}:${statement.sql}`)
        continue
      }
      if (comment) {
        migrationCommentStatementCount += 1
        if (comment.removesComment) {
          finalCommentsByTarget.delete(comment.target.targetKey)
        } else {
          finalCommentsByTarget.set(comment.target.targetKey, {
            migrationPath,
            sql: statement.sql,
            target: comment.target,
            valueSql: comment.valueSql,
          })
        }
        continue
      }

      for (const mutation of parseSchemaCommentTargetMutations(statement)) {
        applySchemaCommentTargetMutation(finalCommentsByTarget, mutation)
      }
    }
  }

  for (const sourceFile of context.sourceFiles) {
    if (!repoPath(context, sourceFile).startsWith('db/schema/')) {
      continue
    }
    walk(sourceFile, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'references'
      ) {
        foreignKeyCount += 1
      }
      if (ts.isIdentifier(node)) {
        if (RETIRED_ROUTINES.has(node.text)) {
          retiredRoutineCount += 1
        }
        if (RETIRED_TRIGGERS.has(node.text)) {
          retiredTriggerCount += 1
        }
      }
    })
  }

  const missingCommentTargetKeys = commentArtifact.commentStatements
    .filter(
      (statement) => !finalCommentsByTarget.has(statement.target.targetKey),
    )
    .map((statement) => statement.target.targetKey)
  const unexpectedCommentTargetKeys = [...finalCommentsByTarget.keys()]
    .filter((targetKey) => !expectedCommentsByTarget.has(targetKey))
    .sort((left, right) => left.localeCompare(right))
  const sqlMismatches = [...expectedCommentsByTarget]
    .flatMap(([targetKey, expected]) => {
      const actual = finalCommentsByTarget.get(targetKey)
      if (!actual || actual.valueSql === expected.valueSql) {
        return []
      }
      return [
        {
          actual: actual.sql,
          expected: expected.sql,
          migrationPath: actual.migrationPath,
          targetKey,
        },
      ]
    })
    .sort((left, right) => left.targetKey.localeCompare(right.targetKey))

  if (foreignKeyCount > 0) {
    violations.push('MIGRATION_FOREIGN_KEY_PRESENT')
  }
  if (routineDeclarationCount > 0) {
    violations.push('MIGRATION_BUSINESS_ROUTINE_PRESENT')
  }
  if (triggerDeclarationCount > 0) {
    violations.push('MIGRATION_TRIGGER_PRESENT')
  }
  if (retiredRoutineCount > 0) {
    violations.push('MIGRATION_RETIRED_ROUTINE_PRESENT')
  }
  if (retiredTriggerCount > 0) {
    violations.push('MIGRATION_RETIRED_TRIGGER_PRESENT')
  }
  if (transactionControlStatements.length > 0) {
    violations.push('MIGRATION_TRANSACTION_CONTROL_PRESENT')
  }
  if (targetlessCommentStatements.length > 0) {
    violations.push('MIGRATION_SCHEMA_COMMENT_TARGETLESS')
  }
  if (missingCommentTargetKeys.length > 0) {
    violations.push('MIGRATION_SCHEMA_COMMENT_TARGET_MISSING')
  }
  if (unexpectedCommentTargetKeys.length > 0) {
    violations.push('MIGRATION_SCHEMA_COMMENT_TARGET_UNEXPECTED')
  }
  if (sqlMismatches.length > 0) {
    violations.push('MIGRATION_SCHEMA_COMMENT_SQL_MISMATCH')
  }

  return {
    foreignKeyCount,
    retiredRoutineCount,
    retiredTriggerCount,
    summary: {
      artifactWarningCount: commentArtifact.warnings.length,
      expectedCommentTargetKeys: [...expectedCommentsByTarget.keys()].sort(
        (left, right) => left.localeCompare(right),
      ),
      foreignKeyCount,
      migrationCommentStatementCount,
      migrationSqlPaths,
      migrationTree: {
        entries: migrationTree.entries,
        invalidEntries: migrationTree.invalidEntries,
      },
      missingCommentTargetKeys,
      retiredRoutineCount,
      retiredTriggerCount,
      routineDeclarationCount,
      sqlMismatches,
      targetlessCommentStatements,
      transactionControlStatements,
      triggerDeclarationCount,
      unexpectedCommentTargetKeys,
    },
  }
}

// 审计并记录受支持的 Drizzle migration tree，拒绝非直接目录、嵌套目录和额外工件。
function auditMigrationTree(root: string): MigrationTreeAudit {
  const migrationRoot = join(root, 'db/migration')
  if (!existsSync(migrationRoot)) {
    return {
      entries: [],
      invalidEntries: ['db/migration:missing-directory'],
      migrationSqlPaths: [],
    }
  }
  if (!statSync(migrationRoot).isDirectory()) {
    return {
      entries: [],
      invalidEntries: ['db/migration:not-directory'],
      migrationSqlPaths: [],
    }
  }

  const entries = collectMigrationTreeEntries(migrationRoot)
    .map((entry) => ({
      ...entry,
      path: relative(root, entry.path).replaceAll('\\', '/'),
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
  const directEntries = readdirSync(migrationRoot, { withFileTypes: true })
  const invalidEntries: string[] = []

  if (directEntries.length === 0) {
    invalidEntries.push('db/migration:missing-migration-directory')
  }

  for (const entry of directEntries) {
    const entryPath = join(migrationRoot, entry.name)
    const relativeEntryPath = relative(root, entryPath).replaceAll('\\', '/')
    if (!entry.isDirectory()) {
      invalidEntries.push(`${relativeEntryPath}:root-entry-must-be-directory`)
      continue
    }

    const childEntries = readdirSync(entryPath, { withFileTypes: true })
    const childFiles = childEntries
      .filter((child) => child.isFile())
      .map((child) => child.name)
      .sort((left, right) => left.localeCompare(right))
    const childDirectories = childEntries
      .filter((child) => !child.isFile())
      .map((child) => child.name)
      .sort((left, right) => left.localeCompare(right))
    if (!sameStrings(childFiles, ['migration.sql', 'snapshot.json'])) {
      invalidEntries.push(`${relativeEntryPath}:unexpected-files`)
    }
    for (const childDirectory of childDirectories) {
      invalidEntries.push(`${relativeEntryPath}/${childDirectory}:nested-entry`)
    }
  }

  return {
    entries,
    invalidEntries: invalidEntries.sort((left, right) =>
      left.localeCompare(right),
    ),
    migrationSqlPaths: entries
      .filter(
        (entry) =>
          entry.kind === 'file' && entry.path.endsWith('/migration.sql'),
      )
      .map((entry) => entry.path)
      .sort((left, right) => left.localeCompare(right)),
  }
}

// 递归收集 migration tree 的完整相对结构，使摘要能感知任何目录或文件漂移。
function collectMigrationTreeEntries(
  directory: string,
): MigrationTreeAudit['entries'] {
  const result: MigrationTreeAudit['entries'] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      result.push({ kind: 'directory', path: entryPath })
      result.push(...collectMigrationTreeEntries(entryPath))
      continue
    }
    result.push({
      kind: entry.isFile() ? 'file' : 'other',
      path: entryPath,
    })
  }
  return result
}

function createProjectContext(root: string): ProjectContext {
  const configPath = join(root, 'tsconfig.build.json')
  const config = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path))
  if (config.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
    )
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
    undefined,
    configPath,
  )
  const repositorySources = SOURCE_ROOTS.flatMap((directory) =>
    collectTypeScriptSources(join(root, directory)),
  )
  const program = ts.createProgram({
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    rootNames: [...new Set([...parsed.fileNames, ...repositorySources])],
  })
  const sourceFiles = program
    .getSourceFiles()
    .filter((sourceFile) => isRepositorySource(root, sourceFile.fileName))
    .filter((sourceFile) => !sourceFile.fileName.includes('.probe.'))
  return { checker: program.getTypeChecker(), program, root, sourceFiles }
}

function collectTypeScriptSources(directory: string): string[] {
  if (!existsSync(directory)) {
    return []
  }
  const result: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        result.push(...collectTypeScriptSources(join(directory, entry.name)))
      }
      continue
    }
    if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.includes('.probe.')
    ) {
      result.push(join(directory, entry.name))
    }
  }
  return result
}

function auditSequentialRegistry(
  context: ProjectContext,
  acquirer: ts.FunctionDeclaration,
  violations: string[],
) {
  if (!acquirer.body) {
    violations.push('LOCK_ACQUIRER_BODY_MISSING')
    return
  }
  const loops: ts.ForOfStatement[] = []
  const executeCalls: ts.CallExpression[] = []
  let aggregateAsyncCount = 0
  walk(acquirer.body, (node) => {
    if (ts.isForOfStatement(node)) {
      loops.push(node)
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      if (node.expression.name.text === 'execute') {
        executeCalls.push(node)
      }
      if (
        node.expression.expression.getText() === 'Promise' &&
        node.expression.name.text === 'all'
      ) {
        aggregateAsyncCount += 1
      }
    }
  })
  const normalizedLoop = loops.find(
    (loop) =>
      ts.isCallExpression(loop.expression) &&
      readCallName(loop.expression) === 'normalizeIntegrityLockRequests',
  )
  if (
    !normalizedLoop ||
    executeCalls.length !== 2 ||
    executeCalls.some(
      (call) => !isNodeWithin(call, normalizedLoop.statement),
    ) ||
    aggregateAsyncCount > 0
  ) {
    violations.push('LOCK_REGISTRY_NOT_SEQUENTIAL')
  }
  if (
    executeCalls.some(
      (call) => !hasAwaitAncestorBefore(call, acquirer.body as ts.Block),
    )
  ) {
    violations.push('LOCK_REGISTRY_EXECUTE_NOT_AWAITED')
  }
  const tokens: string[] = []
  walk(acquirer.body, (node) => {
    const sqlText = readSqlText(node)
    if (sqlText !== undefined) {
      tokens.push(...tokenizeSql(sqlText))
    }
  })
  if (tokens.some((token) => ['unnest', 'array_agg'].includes(token))) {
    violations.push('LOCK_SET_BASED_BATCH_PRESENT')
  }
}

function analyzeRequestExpression(
  context: ProjectContext,
  expression: ts.Expression,
  producer: string | undefined,
) {
  const records: LockBuilderRecord[] = []
  const seenDeclarations = new Set<string>()
  const seenNodes = new Set<string>()

  function visitExpression(
    candidate: ts.Expression,
    propertyName?: string,
  ): void {
    candidate = unwrapExpression(candidate)
    const nodeId = `${candidate.getSourceFile().fileName}:${candidate.getStart()}:${propertyName ?? ''}`
    if (seenNodes.has(nodeId)) {
      return
    }
    seenNodes.add(nodeId)

    if (ts.isCallExpression(candidate)) {
      const callName = readCallName(candidate)
      if (
        callName === 'sharedIntegrityLock' ||
        callName === 'exclusiveIntegrityLock'
      ) {
        records.push({
          mode: callName === 'sharedIntegrityLock' ? 'shared' : 'exclusive',
          resource: candidate.arguments[0]
            ? readLockResource(context, candidate.arguments[0])
            : 'unknown',
        })
        return
      }
      if (
        ts.isPropertyAccessExpression(candidate.expression) &&
        ['flatMap', 'map'].includes(candidate.expression.name.text)
      ) {
        for (const argument of candidate.arguments) {
          if (
            ts.isArrowFunction(argument) ||
            ts.isFunctionExpression(argument)
          ) {
            visitFunctionReturns(argument)
          }
        }
      }
      const target = resolveCallDeclaration(context, candidate)
      if (target) {
        visitDeclarationReturns(target, propertyName)
      }
      return
    }
    if (ts.isArrayLiteralExpression(candidate)) {
      for (const element of candidate.elements) {
        if (ts.isSpreadElement(element)) {
          visitExpression(element.expression)
        } else if (ts.isExpression(element)) {
          visitExpression(element)
        }
      }
      return
    }
    if (ts.isConditionalExpression(candidate)) {
      visitExpression(candidate.whenTrue)
      visitExpression(candidate.whenFalse)
      return
    }
    if (ts.isPropertyAccessExpression(candidate)) {
      if (candidate.name.text === 'lockRequests') {
        visitExpression(candidate.expression, 'lockRequests')
        if (records.length === 0 && producer) {
          const declaration = readNamedDeclaration(context, producer)
          if (declaration) {
            visitDeclarationReturns(declaration, 'lockRequests')
          }
        }
        return
      }
      const symbol = resolveSymbol(context, candidate.name)
      for (const declaration of symbol?.declarations ?? []) {
        if (
          ts.isPropertyAssignment(declaration) ||
          ts.isPropertyDeclaration(declaration)
        ) {
          if (declaration.initializer) {
            visitExpression(declaration.initializer)
          }
        }
      }
      return
    }
    if (ts.isIdentifier(candidate)) {
      const symbol = resolveSymbol(context, candidate)
      for (const declaration of symbol?.declarations ?? []) {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
          visitExpression(declaration.initializer, propertyName)
          visitArrayMutations(declaration, candidate.text)
        } else if (
          ts.isParameter(declaration) &&
          producer &&
          propertyName === 'lockRequests'
        ) {
          const target = readNamedDeclaration(context, producer)
          if (target) {
            visitDeclarationReturns(target, 'lockRequests')
          }
        }
      }
      return
    }
    if (ts.isObjectLiteralExpression(candidate)) {
      for (const property of candidate.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          (!propertyName || readPropertyName(property.name) === propertyName)
        ) {
          visitExpression(property.initializer)
        } else if (
          ts.isShorthandPropertyAssignment(property) &&
          (!propertyName || property.name.text === propertyName)
        ) {
          const symbol =
            context.checker.getShorthandAssignmentValueSymbol(property)
          for (const declaration of symbol?.declarations ?? []) {
            if (
              ts.isVariableDeclaration(declaration) &&
              declaration.initializer
            ) {
              visitExpression(declaration.initializer)
              visitArrayMutations(declaration, property.name.text)
            } else if (ts.isParameter(declaration) && producer) {
              const target = readNamedDeclaration(context, producer)
              if (target) {
                visitDeclarationReturns(target, propertyName)
              }
            }
          }
        } else if (ts.isSpreadAssignment(property)) {
          visitExpression(property.expression, propertyName)
        }
      }
    }
  }

  function visitArrayMutations(
    declaration: ts.VariableDeclaration,
    name: string,
  ) {
    const scope =
      findContainingFunction(declaration) ?? declaration.getSourceFile()
    walk(scope, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === name &&
        node.expression.name.text === 'push'
      ) {
        for (const argument of node.arguments) {
          visitExpression(argument)
        }
      }
    })
  }

  function visitFunctionReturns(
    declaration: ts.ArrowFunction | ts.FunctionExpression,
  ) {
    if (ts.isBlock(declaration.body)) {
      visitReturnExpressions(declaration.body)
    } else {
      visitExpression(declaration.body)
    }
  }

  function visitDeclarationReturns(
    declaration: ts.Declaration,
    requestedProperty?: string,
  ) {
    const key = declarationKey(context, declaration)
    const visitKey = `${key}:${requestedProperty ?? ''}`
    if (seenDeclarations.has(visitKey)) {
      return
    }
    seenDeclarations.add(visitKey)
    if (
      (ts.isMethodDeclaration(declaration) ||
        ts.isFunctionDeclaration(declaration) ||
        ts.isFunctionExpression(declaration) ||
        ts.isArrowFunction(declaration)) &&
      declaration.body
    ) {
      if (ts.isBlock(declaration.body)) {
        visitReturnExpressions(declaration.body, requestedProperty)
      } else {
        visitExpression(declaration.body, requestedProperty)
      }
    }
  }

  function visitReturnExpressions(body: ts.Block, requestedProperty?: string) {
    walk(body, (node) => {
      if (ts.isReturnStatement(node) && node.expression) {
        visitExpression(node.expression, requestedProperty)
      }
    })
  }

  visitExpression(expression)
  return records
}

function readLockResource(
  context: ProjectContext,
  expression: ts.Expression,
): string {
  expression = unwrapExpression(expression)
  if (ts.isCallExpression(expression)) {
    const name = readCallName(expression)
    if (name === 'tableIntegrityLock') {
      return `record:${readTableLockName(context, expression.arguments[0])}`
    }
    if (name === 'relationIntegrityLock') {
      return `relation:${readStaticString(context, expression.arguments[0])}`
    }
    if (name === 'jobIntegrityLock') {
      return `job:${readStaticString(context, expression.arguments[0])}`
    }
    const target = resolveCallDeclaration(context, expression)
    if (target) {
      const resources = collectReturnedResources(context, target)
      return resources.length === 1 ? resources[0] : 'unknown'
    }
  }
  if (
    ts.isIdentifier(expression) ||
    ts.isPropertyAccessExpression(expression)
  ) {
    const symbol = resolveSymbol(
      context,
      ts.isPropertyAccessExpression(expression) ? expression.name : expression,
    )
    const resources = (symbol?.declarations ?? []).flatMap((declaration) => {
      if (
        (ts.isVariableDeclaration(declaration) ||
          ts.isPropertyAssignment(declaration) ||
          ts.isPropertyDeclaration(declaration)) &&
        declaration.initializer
      ) {
        return [readLockResource(context, declaration.initializer)]
      }
      return []
    })
    return resources.length === 1 ? resources[0] : 'unknown'
  }
  return 'unknown'
}

function collectReturnedResources(
  context: ProjectContext,
  declaration: ts.Declaration,
) {
  const resources: string[] = []
  if (
    (ts.isFunctionDeclaration(declaration) ||
      ts.isMethodDeclaration(declaration)) &&
    declaration.body
  ) {
    walk(declaration.body, (node) => {
      if (ts.isReturnStatement(node) && node.expression) {
        const expression = unwrapExpression(node.expression)
        if (
          ts.isCallExpression(expression) &&
          [
            'jobIntegrityLock',
            'relationIntegrityLock',
            'tableIntegrityLock',
          ].includes(readCallName(expression) ?? '')
        ) {
          resources.push(readLockResource(context, expression))
        } else if (
          ts.isCallExpression(expression) &&
          ['exclusiveIntegrityLock', 'sharedIntegrityLock'].includes(
            readCallName(expression) ?? '',
          ) &&
          expression.arguments[0]
        ) {
          resources.push(readLockResource(context, expression.arguments[0]))
        }
      }
    })
  }
  return [...new Set(resources)]
}

function readTableLockName(
  context: ProjectContext,
  expression: ts.Expression | undefined,
) {
  if (!expression) {
    return 'unknown'
  }
  expression = unwrapExpression(expression)
  const literal = readStaticString(context, expression)
  if (literal !== 'unknown') {
    return literal
  }
  if (
    ts.isCallExpression(expression) &&
    readCallName(expression) === 'getTableName' &&
    expression.arguments[0]
  ) {
    return toSnakeCase(readTableExpressionName(expression.arguments[0]))
  }
  return 'unknown'
}

function traceTransactionAcquisitions(
  context: ProjectContext,
  declaration: ts.FunctionLikeDeclaration,
  acquirer: ts.FunctionDeclaration,
  acquisitionByStart: Map<string, AcquisitionAnalysis>,
  stack: Set<string>,
  noTransactionBridges = new Set<string>(),
  inheritedLoopDepth = 0,
): TransactionAcquisitionEvent[] {
  const key = declarationKey(context, declaration)
  if (stack.has(key) || !declaration.body) {
    return []
  }
  const nextStack = new Set(stack).add(key)
  const events: TransactionAcquisitionEvent[] = []
  const initialTransactionNames = readTransactionParameterNames(declaration)

  const visit = (
    node: ts.Node,
    transactionNames: Set<string>,
    loopDepth: number,
  ): void => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const nestedNames = new Set(transactionNames)
      for (const name of readTransactionParameterNames(node)) {
        nestedNames.add(name)
      }
      visit(node.body, nestedNames, loopDepth)
      return
    }
    if (
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      ts.forEachChild(node, (child) =>
        visit(child, transactionNames, loopDepth + 1),
      )
      return
    }
    if (ts.isCallExpression(node)) {
      const target = resolveCallDeclaration(context, node)
      if (target && sameDeclaration(target, acquirer)) {
        const analysis = acquisitionByStart.get(nodeLocationKey(context, node))
        for (const record of normalizeBuilderRecords(analysis?.records ?? [])) {
          events.push({
            loopDepth,
            mode: record.mode,
            resource: record.resource,
            site: analysis?.site ?? 'unknown',
          })
        }
        return
      }
      for (const argument of node.arguments) {
        visit(argument, transactionNames, loopDepth)
      }
      if (target && isProjectFunctionLike(context, target) && target.body) {
        const targetKey = declarationKey(context, target)
        const bridgeKey = `${key}->${targetKey}`
        const carriesTransaction = node.arguments.some((argument) =>
          containsTransactionReference(argument, transactionNames),
        )
        if (carriesTransaction || noTransactionBridges.has(bridgeKey)) {
          events.push(
            ...traceTransactionAcquisitions(
              context,
              target,
              acquirer,
              acquisitionByStart,
              nextStack,
              noTransactionBridges,
              loopDepth,
            ),
          )
        }
      }
      return
    }
    ts.forEachChild(node, (child) => visit(child, transactionNames, loopDepth))
  }

  visit(declaration.body, initialTransactionNames, inheritedLoopDepth)
  return events
}

function auditExperienceLedgerCallSet(
  context: ProjectContext,
  violations: string[],
) {
  const ledgerMethods = new Map(
    ['applyByRule', 'applyByRuleBatch', 'applyDelta', 'applyDeltaBatch'].map(
      (name) => [
        name,
        readNamedDeclaration(
          context,
          `libs/growth/src/growth-ledger/growth-ledger.service.ts#GrowthLedgerService.${name}`,
        ),
      ],
    ),
  )
  const actual = new Set<string>()
  for (const sourceFile of context.sourceFiles) {
    if (
      repoPath(context, sourceFile) ===
      'libs/growth/src/growth-ledger/growth-ledger.service.ts'
    ) {
      continue
    }
    walk(sourceFile, (node) => {
      if (!ts.isCallExpression(node)) {
        return
      }
      const target = resolveCallDeclaration(context, node)
      for (const [name, declaration] of ledgerMethods) {
        if (target && declaration && sameDeclaration(target, declaration)) {
          actual.add(
            `${repoPath(context, sourceFile)}#${declarationOwner(context, node)}->${name}`,
          )
        }
      }
    })
  }
  const expected = new Set([
    ...EXPERIENCE_LEDGER_CALLS,
    ...NON_EXPERIENCE_LEDGER_CALLS,
  ])
  if (!sameStrings([...actual].sort(), [...expected].sort())) {
    violations.push('DAG_LEDGER_EXTERNAL_CALL_SET')
  }
}

function auditLedgerTerminalShape(
  context: ProjectContext,
  violations: string[],
) {
  const batchMethods = ['applyByRuleBatch', 'applyDeltaBatch'] as const
  for (const name of batchMethods) {
    const declaration = readNamedDeclaration(
      context,
      `libs/growth/src/growth-ledger/growth-ledger.service.ts#GrowthLedgerService.${name}`,
    )
    if (!declaration) {
      violations.push('DAG_LEDGER_BATCH_MISSING')
      continue
    }
    const calls = collectResolvedCallNames(context, declaration)
    const first = calls.indexOf('acquireLedgerOperationLocks')
    const operation = calls.findIndex((call) =>
      call.includes('AfterOperationLock'),
    )
    const terminal = calls.indexOf('syncExperienceUsersAfterLedgerBatch')
    if (first < 0 || operation <= first || terminal <= operation) {
      violations.push('DAG_LEDGER_BATCH_PHASE_ORDER')
    }
  }
  for (const name of [
    'applyByRuleAfterOperationLock',
    'applyDeltaAfterOperationLock',
  ]) {
    const declaration = readNamedDeclaration(
      context,
      `libs/growth/src/growth-ledger/growth-ledger.service.ts#GrowthLedgerService.${name}`,
    )
    if (
      !declaration ||
      countNamedCalls(declaration, 'acquireIntegrityLocks') > 0
    ) {
      violations.push('DAG_LEDGER_APPLY_ACQUISITION')
    }
  }
  const terminal = readNamedDeclaration(
    context,
    'libs/growth/src/growth-ledger/growth-ledger.service.ts#GrowthLedgerService.syncExperienceUsersAfterLedgerBatch',
  )
  if (!terminal || !hasEmptySetEarlyReturn(terminal)) {
    violations.push('DAG_LEDGER_NON_EXPERIENCE_TERMINAL_GUARD')
  }
}

function readLevelRuleExistenceSignatures(
  context: ProjectContext,
  declaration: ts.FunctionLikeDeclaration | undefined,
  methodName: string,
  violations: string[],
) {
  if (!declaration?.body) {
    return []
  }
  const signatures: string[] = []
  walk(declaration.body, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== 'limit' ||
      node.arguments.length !== 1 ||
      !ts.isNumericLiteral(node.arguments[0]) ||
      node.arguments[0].text !== '1'
    ) {
      return
    }
    const from = findCallInChain(node, 'from')
    const select = findCallInChain(node, 'select')
    const where = findCallInChain(node, 'where')
    if (!from?.arguments[0] || !select?.arguments[0] || !where?.arguments[0]) {
      return
    }
    const table = normalizeTableName(readTableExpressionName(from.arguments[0]))
    if (!['appUser', 'forumSection'].includes(table)) {
      return
    }
    if (!isIdOnlyProjection(select.arguments[0])) {
      violations.push('QX_PROJECTION_NOT_ID_ONLY')
    }
    signatures.push(
      `${methodName}:${table}:${readLevelRulePredicateShape(where.arguments[0], table)}`,
    )
  })
  return signatures
}

function readLevelRulePredicateShape(expression: ts.Expression, table: string) {
  expression = unwrapExpression(expression)
  if (
    !ts.isCallExpression(expression) ||
    readCallName(expression) !== 'and' ||
    expression.arguments.length !== 2
  ) {
    return 'invalid'
  }
  const referenceColumn = table === 'appUser' ? 'levelId' : 'userLevelRuleId'
  const parts = expression.arguments
    .map((argument) => readLevelRulePredicatePart(argument, table))
    .sort((left, right) => left.localeCompare(right))
  const expected = [`${referenceColumn}=id`, 'deletedAt:is-null'].sort(
    (left, right) => left.localeCompare(right),
  )
  return sameStrings(parts, expected)
    ? `${referenceColumn}=id,deletedAt:is-null`
    : 'invalid'
}

function readLevelRulePredicatePart(expression: ts.Expression, table: string) {
  expression = unwrapExpression(expression)
  if (!ts.isCallExpression(expression)) {
    return 'invalid'
  }
  const name = readCallName(expression)
  if (name === 'isNull' && expression.arguments.length === 1) {
    return readTableColumn(expression.arguments[0], table) === 'deletedAt'
      ? 'deletedAt:is-null'
      : 'invalid'
  }
  if (name !== 'eq' || expression.arguments.length !== 2) {
    return 'invalid'
  }
  const [left, right] = expression.arguments.map(unwrapExpression)
  if (ts.isIdentifier(left) && left.text === 'id') {
    const column = readTableColumn(right, table)
    return column ? `${column}=id` : 'invalid'
  }
  if (ts.isIdentifier(right) && right.text === 'id') {
    const column = readTableColumn(left, table)
    return column ? `${column}=id` : 'invalid'
  }
  return 'invalid'
}

function readTableColumn(expression: ts.Expression, table: string) {
  expression = unwrapExpression(expression)
  if (
    !ts.isPropertyAccessExpression(expression) ||
    normalizeTableName(readTableExpressionName(expression.expression)) !== table
  ) {
    return undefined
  }
  return expression.name.text
}

function readDrizzleWrite(context: ProjectContext, node: ts.CallExpression) {
  if (
    !ts.isPropertyAccessExpression(node.expression) ||
    !['delete', 'insert', 'update'].includes(node.expression.name.text) ||
    !node.arguments[0]
  ) {
    return undefined
  }
  const table = normalizeTableName(readTableExpressionName(node.arguments[0]))
  return { operation: node.expression.name.text, table }
}

// 沿 Drizzle 写入链定位 set/values payload，并将无法定位的 payload 标记为未知。
function readWritePayloadAudit(
  context: ProjectContext,
  writeCall: ts.CallExpression,
): PayloadAudit {
  const operation = readCallName(writeCall)
  if (operation === 'delete') {
    return createPayloadAudit()
  }
  let current: ts.Node | undefined = writeCall.parent
  while (current && !ts.isStatement(current)) {
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      ['set', 'values'].includes(current.expression.name.text) &&
      current.arguments[0]
    ) {
      return readPayloadAudit(context, current.arguments[0])
    }
    current = current.parent
  }
  return createUnknownPayloadAudit()
}

// 将字面量与类型驱动 payload 归一化为字段、可为非空字段和未知形状。
function readPayloadAudit(
  context: ProjectContext,
  expression: ts.Expression,
): PayloadAudit {
  expression = unwrapExpression(expression)
  if (ts.isArrayLiteralExpression(expression)) {
    const audits: PayloadAudit[] = []
    for (const element of expression.elements) {
      if (ts.isOmittedExpression(element)) {
        continue
      }
      const nestedExpression = ts.isSpreadElement(element)
        ? element.expression
        : element
      audits.push(readPayloadAudit(context, nestedExpression))
    }
    return combinePayloadAudits(audits)
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return readObjectLiteralPayloadAudit(context, expression)
  }
  return readPayloadTypeAudit(
    context.checker,
    context.checker.getTypeAtLocation(expression),
    expression,
  )
}

// 按对象字面量的声明顺序覆盖字段，避免 spread 后显式 null 被误记为非空。
function readObjectLiteralPayloadAudit(
  context: ProjectContext,
  expression: ts.ObjectLiteralExpression,
): PayloadAudit {
  const audit = createPayloadAudit()
  for (const property of expression.properties) {
    if (
      ts.isPropertyAssignment(property) ||
      ts.isShorthandPropertyAssignment(property) ||
      ts.isMethodDeclaration(property)
    ) {
      const name = readStaticPropertyName(property.name)
      if (!name) {
        audit.hasUnknownShape = true
        continue
      }
      const value = ts.isPropertyAssignment(property)
        ? analyzePayloadValueExpression(context, property.initializer)
        : ts.isShorthandPropertyAssignment(property)
          ? analyzePayloadValueExpression(context, property.name)
          : { hasUnknownValue: false, mayBeNonNull: true }
      audit.fields.set(name, { mayBeNonNull: value.mayBeNonNull })
      audit.hasUnknownShape ||= value.hasUnknownValue
    } else if (ts.isSpreadAssignment(property)) {
      overlayPayloadAudit(
        audit,
        readPayloadObjectSpreadAudit(context, property.expression),
      )
    } else {
      audit.hasUnknownShape = true
    }
  }
  return audit
}

// 对数组作对象 spread 时无法安全映射为列字段，直接保守标记为未知。
function readPayloadObjectSpreadAudit(
  context: ProjectContext,
  expression: ts.Expression,
): PayloadAudit {
  const type = context.checker.getTypeAtLocation(unwrapExpression(expression))
  return containsArrayLikeType(context.checker, type)
    ? createUnknownPayloadAudit()
    : readPayloadAudit(context, expression)
}

// 合并批量 payload 的所有可能字段；任一元素可写入即保留为可能写入。
function combinePayloadAudits(audits: readonly PayloadAudit[]): PayloadAudit {
  const combined = createPayloadAudit()
  for (const audit of audits) {
    combined.hasUnknownShape ||= audit.hasUnknownShape
    for (const [name, state] of audit.fields) {
      const existing = combined.fields.get(name)
      combined.fields.set(name, {
        mayBeNonNull: existing?.mayBeNonNull || state.mayBeNonNull,
      })
    }
  }
  return combined
}

// 将对象 spread 的已知字段按覆盖语义写入目标审计结果。
function overlayPayloadAudit(target: PayloadAudit, source: PayloadAudit) {
  target.hasUnknownShape ||= source.hasUnknownShape
  for (const [name, state] of source.fields) {
    target.fields.set(name, state)
  }
}

// 创建不含字段的已知 payload 审计结果。
function createPayloadAudit(): PayloadAudit {
  return {
    fields: new Map<string, PayloadFieldState>(),
    hasUnknownShape: false,
  }
}

// 创建未知 payload 形状，禁止以字段名哨兵掩盖无法审计的写入。
function createUnknownPayloadAudit(): PayloadAudit {
  return { fields: new Map<string, PayloadFieldState>(), hasUnknownShape: true }
}

// 从审计结果读取所有已知字段名。
function readKnownPayloadKeys(audit: PayloadAudit): string[] {
  return [...audit.fields.keys()].sort()
}

// 从审计结果读取可能写入非空值的字段名。
function readPotentiallyNonNullPayloadKeys(audit: PayloadAudit): string[] {
  return [...audit.fields]
    .filter(([, state]) => state.mayBeNonNull)
    .map(([name]) => name)
    .sort()
}

// 基于表达式实际类型判断属性值是否可能为非空，并传播未知值类型。
function analyzePayloadValueExpression(
  context: ProjectContext,
  expression: ts.Expression,
): PayloadValueAnalysis {
  return analyzePayloadValueType(
    context.checker.getTypeAtLocation(unwrapExpression(expression)),
  )
}

function collectRawSqlWriters(
  context: ProjectContext,
  sourceFile: ts.SourceFile,
  records: WriterRecord[],
  violations: string[],
  onUnknown: () => void,
) {
  const file = repoPath(context, sourceFile)
  walk(sourceFile, (node) => {
    if (
      !ts.isTaggedTemplateExpression(node) ||
      readTagName(node.tag) !== 'sql'
    ) {
      return
    }
    const tokens = tokenizeSql(readTemplateText(node.template))
    for (let index = 0; index < tokens.length; index += 1) {
      const operation = tokens[index]
      let tableToken: string | undefined
      if (operation === 'update') {
        tableToken = tokens[index + 1]
      } else if (operation === 'insert' && tokens[index + 1] === 'into') {
        tableToken = tokens[index + 2]
      } else if (operation === 'delete' && tokens[index + 1] === 'from') {
        tableToken = tokens[index + 2]
      }
      if (!tableToken) {
        continue
      }
      const table = CRITICAL_SQL_TABLES.get(tableToken)
      if (!table) {
        continue
      }
      const owner = `${file}#${declarationOwner(context, node)}`
      const category = writerOwners.get(owner)
      if (!category) {
        onUnknown()
        violations.push('WRITER_UNKNOWN_RAW_SQL_OWNER')
      }
      records.push({
        category: category ?? 'non-integrity',
        kind: 'raw-sql',
        nonNullPayloadKeys: [],
        operation,
        owner,
        payloadKeys: [],
        table,
      })
    }
  })
}

function validateClosedAppUserLevelWriters(
  records: WriterRecord[],
  violations: string[],
) {
  const levelWriters = records
    .filter((record) => record.table === 'appUser')
    .filter(
      (record) =>
        record.nonNullPayloadKeys.includes('levelId') ||
        (record.operation === 'update' &&
          record.payloadKeys.includes('levelId')),
    )
    .map((record) => record.owner)
  const expected = new Set([
    'db/seed/modules/app/domain.ts#seedAppCoreDomain',
    'libs/account/src/admin-app-user/admin-app-user-command.service.ts#AdminAppUserCommandService.createAppUser',
    'libs/growth/src/app-user-growth-profile/app-user-growth-profile.service.ts#AppUserGrowthProfileService.applyNewUserInitializationAfterLockInTx',
    'libs/growth/src/growth-ledger/growth-ledger.service.ts#GrowthLedgerService.syncUserLevel',
    'libs/growth/src/level-rule/level-rule.service.ts#UserLevelRuleService.clearLevelRuleReferencesInTx',
  ])
  if (!sameStrings([...new Set(levelWriters)].sort(), [...expected].sort())) {
    violations.push('WRITER_APP_USER_LEVEL_ALLOWLIST')
  }
}

function addLockSites(
  file: string,
  className: string | undefined,
  methods: readonly string[],
  path: string,
  root: string,
  reason: string,
  producer?: string,
) {
  for (const method of methods) {
    const owner = className ? `${className}.${method}` : method
    const site = `${file}#${owner}`
    if (lockContracts.has(site)) {
      throw new Error(`duplicate lock-site contract: ${site}`)
    }
    lockContracts.set(site, { path, producer, reason, root })
  }
}

function addWriterOwners(
  file: string,
  className: string | undefined,
  methods: readonly string[],
  category: WriterCategory,
) {
  for (const method of methods) {
    const owner = `${file}#${className ? `${className}.` : ''}${method}`
    if (writerOwners.has(owner)) {
      throw new Error(`duplicate writer owner: ${owner}`)
    }
    writerOwners.set(owner, category)
  }
}

function findTopLevelFunctions(context: ProjectContext, name: string) {
  return context.sourceFiles.flatMap((sourceFile) =>
    sourceFile.statements.filter(
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === name,
    ),
  )
}

function readNamedDeclaration(
  context: ProjectContext,
  key: string,
): ts.FunctionLikeDeclaration | undefined {
  const separator = key.indexOf('#')
  if (separator < 0) {
    return undefined
  }
  const file = key.slice(0, separator)
  const owner = key.slice(separator + 1)
  const sourceFile = readSourceFile(context, file)
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === owner) {
      return statement
    }
    if (!ts.isClassDeclaration(statement) || !statement.name) {
      continue
    }
    const prefix = `${statement.name.text}.`
    if (!owner.startsWith(prefix)) {
      continue
    }
    const memberName = owner.slice(prefix.length)
    for (const member of statement.members) {
      if (
        ts.isMethodDeclaration(member) &&
        readPropertyName(member.name) === memberName
      ) {
        return member
      }
    }
  }
  return undefined
}

function readSourceFile(context: ProjectContext, file: string) {
  const absolute = resolve(context.root, file).toLowerCase()
  const sourceFile = context.sourceFiles.find(
    (candidate) => resolve(candidate.fileName).toLowerCase() === absolute,
  )
  if (!sourceFile) {
    throw new Error(`repository source file missing: ${file}`)
  }
  return sourceFile
}

function resolveCallDeclaration(
  context: ProjectContext,
  call: ts.CallExpression,
): ts.FunctionLikeDeclaration | undefined {
  let node: ts.Node = call.expression
  if (ts.isPropertyAccessExpression(call.expression)) {
    node = call.expression.name
  } else if (ts.isElementAccessExpression(call.expression)) {
    node = call.expression.argumentExpression
  }
  const symbol = resolveSymbol(context, node)
  return symbol?.declarations?.find(isFunctionLikeDeclaration)
}

function resolveSymbol(context: ProjectContext, node: ts.Node) {
  let symbol = context.checker.getSymbolAtLocation(node)
  if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    symbol = context.checker.getAliasedSymbol(symbol)
  }
  return symbol
}

function resolvesCallToDeclaration(
  context: ProjectContext,
  call: ts.CallExpression,
  declaration: ts.Declaration,
) {
  const target = resolveCallDeclaration(context, call)
  return Boolean(target && sameDeclaration(target, declaration))
}

function resolvesToDeclaration(
  context: ProjectContext,
  node: ts.Node,
  declaration: ts.Declaration,
) {
  const symbol = resolveSymbol(context, node)
  return Boolean(
    symbol?.declarations?.some((candidate) =>
      sameDeclaration(candidate, declaration),
    ),
  )
}

function sameDeclaration(left: ts.Declaration, right: ts.Declaration) {
  return (
    resolve(left.getSourceFile().fileName).toLowerCase() ===
      resolve(right.getSourceFile().fileName).toLowerCase() &&
    left.getStart() === right.getStart()
  )
}

function declarationOwner(context: ProjectContext, node: ts.Node) {
  const declaration = isFunctionLikeDeclaration(node)
    ? node
    : findContainingFunction(node)
  if (!declaration) {
    return '<module>'
  }
  if (declaration.name) {
    const name = declaration.name.getText()
    if (
      ts.isMethodDeclaration(declaration) &&
      ts.isClassDeclaration(declaration.parent) &&
      declaration.parent.name
    ) {
      return `${declaration.parent.name.text}.${name}`
    }
    return name
  }
  let current: ts.Node | undefined = declaration.parent
  while (current) {
    if (
      ts.isMethodDeclaration(current) &&
      ts.isClassDeclaration(current.parent) &&
      current.parent.name
    ) {
      return `${current.parent.name.text}.${readPropertyName(current.name)}`
    }
    if (ts.isFunctionDeclaration(current) && current.name) {
      return current.name.text
    }
    current = current.parent
  }
  return '<anonymous>'
}

function declarationKey(context: ProjectContext, declaration: ts.Declaration) {
  return `${repoPath(context, declaration.getSourceFile())}#${declarationOwner(context, declaration)}`
}

function findContainingFunction(node: ts.Node) {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (isFunctionLikeDeclaration(current)) {
      return current
    }
    current = current.parent
  }
  return undefined
}

function isFunctionLikeDeclaration(
  node: ts.Node,
): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  )
}

function isProjectFunctionLike(
  context: ProjectContext,
  declaration: ts.FunctionLikeDeclaration,
) {
  return isRepositorySource(context.root, declaration.getSourceFile().fileName)
}

function readTransactionParameterNames(declaration: ts.SignatureDeclaration) {
  const names = new Set<string>()
  for (const parameter of declaration.parameters) {
    if (!ts.isIdentifier(parameter.name)) {
      continue
    }
    const type = parameter.type?.getText() ?? ''
    if (
      /^(?:transaction|trx|tx)$/iu.test(parameter.name.text) ||
      type.includes('DbTransaction') ||
      type.includes('DbExecutor')
    ) {
      names.add(parameter.name.text)
    }
  }
  return names
}

function containsTransactionReference(
  expression: ts.Expression,
  transactionNames: ReadonlySet<string>,
) {
  let found = false
  walk(expression, (node) => {
    if (ts.isIdentifier(node) && transactionNames.has(node.text)) {
      found = true
    }
  })
  return found
}

function normalizeTransactionEvent(event: TransactionAcquisitionEvent) {
  return { mode: event.mode, resource: event.resource, site: event.site }
}

function normalizeBuilderRecords(records: readonly LockBuilderRecord[]) {
  return [
    ...new Map(
      records.map((record) => [`${record.mode}:${record.resource}`, record]),
    ).values(),
  ].sort(
    (left, right) =>
      left.resource.localeCompare(right.resource) ||
      left.mode.localeCompare(right.mode),
  )
}

function readCallName(call: ts.CallExpression) {
  if (ts.isIdentifier(call.expression)) {
    return call.expression.text
  }
  if (ts.isPropertyAccessExpression(call.expression)) {
    return call.expression.name.text
  }
  if (
    ts.isElementAccessExpression(call.expression) &&
    ts.isStringLiteral(call.expression.argumentExpression)
  ) {
    return call.expression.argumentExpression.text
  }
  return undefined
}

function collectResolvedCallNames(
  context: ProjectContext,
  declaration: ts.FunctionLikeDeclaration,
) {
  const calls: { name: string; position: number }[] = []
  if (!declaration.body) {
    return []
  }
  walk(declaration.body, (node) => {
    if (ts.isCallExpression(node)) {
      const target = resolveCallDeclaration(context, node)
      const name = target?.name?.getText() ?? readCallName(node)
      if (name) {
        calls.push({ name, position: node.getStart() })
      }
    }
  })
  return calls
    .sort((left, right) => left.position - right.position)
    .map((call) => call.name)
}

function countNamedCalls(
  declaration: ts.FunctionLikeDeclaration,
  name: string,
) {
  let count = 0
  if (!declaration.body) {
    return count
  }
  walk(declaration.body, (node) => {
    if (ts.isCallExpression(node) && readCallName(node) === name) {
      count += 1
    }
  })
  return count
}

function hasEmptySetEarlyReturn(declaration: ts.FunctionLikeDeclaration) {
  if (!declaration.body || !ts.isBlock(declaration.body)) {
    return false
  }
  const firstStatement = declaration.body.statements[0]
  if (!firstStatement || !ts.isIfStatement(firstStatement)) {
    return false
  }
  const properties = collectPropertyNames(firstStatement.expression)
  const hasZero = collectNumericLiterals(firstStatement.expression).includes(
    '0',
  )
  const returns = statementContainsReturn(firstStatement.thenStatement)
  return properties.includes('size') && hasZero && returns
}

function statementContainsReturn(statement: ts.Statement) {
  let found = false
  walk(statement, (node) => {
    if (ts.isReturnStatement(node)) {
      found = true
    }
  })
  return found
}

function isWithinDirectIteration(node: ts.Node) {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (
      ts.isForStatement(current) ||
      ts.isForInStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isWhileStatement(current) ||
      ts.isDoStatement(current)
    ) {
      return true
    }
    if (isFunctionLikeDeclaration(current)) {
      return isIterationCallback(current)
    }
    current = current.parent
  }
  return false
}

function isIterationCallback(node: ts.FunctionLikeDeclaration) {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) {
    return false
  }
  const parent = node.parent
  return (
    ts.isCallExpression(parent) &&
    parent.arguments.includes(node) &&
    ts.isPropertyAccessExpression(parent.expression) &&
    [
      'every',
      'filter',
      'flatMap',
      'forEach',
      'map',
      'reduce',
      'reduceRight',
      'some',
    ].includes(parent.expression.name.text)
  )
}

function isAllowedCallableReference(node: ts.Identifier) {
  const parent = node.parent
  if (
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent)
  ) {
    return true
  }
  return ts.isCallExpression(parent) && parent.expression === node
}

function isExactModeUnion(type: ts.TypeNode) {
  if (!ts.isUnionTypeNode(type)) {
    return false
  }
  const values = type.types.flatMap((member) =>
    ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)
      ? [member.literal.text]
      : [],
  )
  return sameStrings(values.sort(), ['exclusive', 'shared'])
}

function hasRawModeProperty(node: ts.ObjectLiteralExpression) {
  return node.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      readPropertyName(property.name) === 'mode' &&
      ts.isStringLiteral(unwrapExpression(property.initializer)) &&
      ['exclusive', 'shared'].includes(
        (unwrapExpression(property.initializer) as ts.StringLiteral).text,
      ),
  )
}

function readSqlText(node: ts.Node) {
  if (ts.isTaggedTemplateExpression(node) && readTagName(node.tag) === 'sql') {
    return readTemplateText(node.template)
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText() === 'sql' &&
    node.expression.name.text === 'raw' &&
    node.arguments[0] &&
    (ts.isStringLiteral(node.arguments[0]) ||
      ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
  ) {
    return node.arguments[0].text
  }
  return undefined
}

function readAdvisoryFunctionTokens(value: string) {
  const tokens = tokenizeSql(value)
  return tokens.filter(
    (token) => token.startsWith('pg_') && token.includes('advisory'),
  )
}

function readStaticString(
  context: ProjectContext,
  expression: ts.Expression | undefined,
): string {
  if (!expression) {
    return 'unknown'
  }
  expression = unwrapExpression(expression)
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text
  }
  if (ts.isIdentifier(expression)) {
    const symbol = resolveSymbol(context, expression)
    for (const declaration of symbol?.declarations ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        const value = readStaticString(context, declaration.initializer)
        if (value !== 'unknown') {
          return value
        }
      }
    }
  }
  return 'unknown'
}

function readTableExpressionName(expression: ts.Expression): string {
  expression = unwrapExpression(expression)
  if (ts.isIdentifier(expression)) {
    return expression.text
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text
  }
  return 'unknown'
}

function normalizeTableName(value: string) {
  return value.endsWith('Table') ? value.slice(0, -'Table'.length) : value
}

function readPropertyName(name: ts.PropertyName) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text
  }
  return name.getText()
}

// 从静态类型构建 payload 审计，并保留类型无法闭集推导的未知状态。
function readPayloadTypeAudit(
  checker: ts.TypeChecker,
  type: ts.Type,
  location: ts.Node,
): PayloadAudit {
  const analysis = collectPayloadRowTypes(checker, type)
  const audit = combinePayloadAudits(
    analysis.rowTypes.map((rowType) =>
      readPayloadRowTypeAudit(checker, rowType, location),
    ),
  )
  audit.hasUnknownShape ||= analysis.hasUnknownShape
  return audit
}

// 审计单行对象类型的命名字段；开放索引和不可读符号字段一律视为未知。
function readPayloadRowTypeAudit(
  checker: ts.TypeChecker,
  rowType: ts.Type,
  location: ts.Node,
): PayloadAudit {
  const audit = createPayloadAudit()
  if ((rowType.flags & ts.TypeFlags.Object) === 0) {
    audit.hasUnknownShape = true
    return audit
  }
  const properties = checker.getPropertiesOfType(rowType)
  if (
    properties.length === 0 ||
    checker.getIndexTypeOfType(rowType, ts.IndexKind.String) !== undefined ||
    checker.getIndexTypeOfType(rowType, ts.IndexKind.Number) !== undefined
  ) {
    audit.hasUnknownShape = true
  }
  for (const property of properties) {
    const name = readAuditableSymbolPropertyName(property)
    if (!name) {
      audit.hasUnknownShape = true
      continue
    }
    const value = analyzePayloadSymbolValue(checker, property, location)
    audit.fields.set(name, { mayBeNonNull: value.mayBeNonNull })
    audit.hasUnknownShape ||= value.hasUnknownValue
  }
  return audit
}

// 递归归一化联合、数组和元组 payload；活动路径检测避免递归别名导致栈溢出。
function collectPayloadRowTypes(
  checker: ts.TypeChecker,
  type: ts.Type,
  activeTypes = new Set<ts.Type>(),
): PayloadTypeAnalysis {
  if (isUnknownPayloadType(type)) {
    return { hasUnknownShape: true, rowTypes: [] }
  }
  if (type.flags & ts.TypeFlags.Never) {
    return { hasUnknownShape: true, rowTypes: [] }
  }
  if (activeTypes.has(type)) {
    return { hasUnknownShape: true, rowTypes: [] }
  }
  activeTypes.add(type)
  try {
    if (type.isUnion()) {
      const analysis: PayloadTypeAnalysis = {
        hasUnknownShape: false,
        rowTypes: [],
      }
      for (const member of type.types) {
        const memberAnalysis = collectPayloadRowTypes(
          checker,
          member,
          activeTypes,
        )
        analysis.hasUnknownShape ||= memberAnalysis.hasUnknownShape
        analysis.rowTypes.push(...memberAnalysis.rowTypes)
      }
      return analysis
    }
    if (!checker.isArrayLikeType(type)) {
      return { hasUnknownShape: false, rowTypes: [type] }
    }
    const elementType = checker.getIndexTypeOfType(type, ts.IndexKind.Number)
    return elementType
      ? collectPayloadRowTypes(checker, elementType, activeTypes)
      : { hasUnknownShape: true, rowTypes: [] }
  } finally {
    activeTypes.delete(type)
  }
}

// 判断对象 spread 的类型中是否出现数组或元组，避免把索引元素误作对象字段。
function containsArrayLikeType(
  checker: ts.TypeChecker,
  type: ts.Type,
): boolean {
  if (type.isUnion()) {
    return type.types.some((member) => containsArrayLikeType(checker, member))
  }
  return checker.isArrayLikeType(type)
}

// 分析属性声明的值类型；缺失声明同样属于不可审计状态。
function analyzePayloadSymbolValue(
  checker: ts.TypeChecker,
  property: ts.Symbol,
  location: ts.Node,
): PayloadValueAnalysis {
  const declaration = property.valueDeclaration ?? property.declarations?.[0]
  return analyzePayloadValueType(
    checker.getTypeOfSymbolAtLocation(property, declaration ?? location),
  )
}

// 判断值类型是否可能为非空；不确定类型会显式传播为未知。
function analyzePayloadValueType(type: ts.Type): PayloadValueAnalysis {
  if (isUnknownPayloadType(type)) {
    return { hasUnknownValue: true, mayBeNonNull: true }
  }
  if (type.flags & ts.TypeFlags.Never) {
    return { hasUnknownValue: true, mayBeNonNull: true }
  }
  if (
    type.flags &
    (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)
  ) {
    return { hasUnknownValue: false, mayBeNonNull: false }
  }
  if (type.isUnion()) {
    const analysis: PayloadValueAnalysis = {
      hasUnknownValue: false,
      mayBeNonNull: false,
    }
    for (const member of type.types) {
      const memberAnalysis = analyzePayloadValueType(member)
      analysis.hasUnknownValue ||= memberAnalysis.hasUnknownValue
      analysis.mayBeNonNull ||= memberAnalysis.mayBeNonNull
    }
    return analysis
  }
  return { hasUnknownValue: false, mayBeNonNull: true }
}

// 将 any、unknown 与尚未具化的类型参数视为不可静态闭集的 payload 类型。
function isUnknownPayloadType(type: ts.Type): boolean {
  return (
    (type.flags &
      (ts.TypeFlags.Any |
        ts.TypeFlags.Unknown |
        ts.TypeFlags.TypeParameter |
        ts.TypeFlags.Conditional |
        ts.TypeFlags.IndexedAccess |
        ts.TypeFlags.Substitution)) !==
    0
  )
}

// 仅接受可稳定还原为字符串的属性声明，避免 Symbol 等内部名称进入摘要。
function readAuditableSymbolPropertyName(
  property: ts.Symbol,
): string | undefined {
  const declarations = property.declarations ?? []
  if (declarations.length === 0) {
    return property.flags & ts.SymbolFlags.Transient
      ? readSyntheticStringPropertyName(property.name)
      : undefined
  }
  const names = declarations.map((declaration) => {
    if (!('name' in declaration) || !declaration.name) {
      return undefined
    }
    return readStaticPropertyName(declaration.name)
  })
  return names.every((name) => name === property.name)
    ? property.name
    : undefined
}

// 仅解析标识符、字面量与字面量 computed key，动态 key 必须显式进入未知状态。
function readStaticPropertyName(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text
  }
  if (!ts.isComputedPropertyName(name)) {
    return undefined
  }
  const expression = unwrapExpression(name.expression)
  return ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)
    ? expression.text
    : undefined
}

function findCallInChain(call: ts.CallExpression, name: string) {
  let current: ts.Expression = call
  while (ts.isCallExpression(current)) {
    if (readCallName(current) === name) {
      return current
    }
    if (!ts.isPropertyAccessExpression(current.expression)) {
      break
    }
    current = current.expression.expression
  }
  return undefined
}

function isIdOnlyProjection(expression: ts.Expression) {
  expression = unwrapExpression(expression)
  return (
    ts.isObjectLiteralExpression(expression) &&
    expression.properties.length === 1 &&
    (ts.isPropertyAssignment(expression.properties[0]) ||
      ts.isShorthandPropertyAssignment(expression.properties[0])) &&
    readPropertyName(expression.properties[0].name) === 'id'
  )
}

function collectPropertyNames(node: ts.Node) {
  const result = new Set<string>()
  walk(node, (candidate) => {
    if (ts.isPropertyAccessExpression(candidate)) {
      result.add(candidate.name.text)
    }
  })
  return [...result]
}

function collectNumericLiterals(node: ts.Node) {
  const result: string[] = []
  walk(node, (candidate) => {
    if (ts.isNumericLiteral(candidate)) {
      result.push(candidate.text)
    }
  })
  return result
}

function containsStringLiteral(node: ts.Node, value: string) {
  let found = false
  walk(node, (candidate) => {
    if (ts.isStringLiteral(candidate) && candidate.text === value) {
      found = true
    }
  })
  return found
}

function countSqlForeignKeys(tokens: string[]) {
  let count = 0
  for (let index = 0; index < tokens.length; index += 1) {
    if (
      tokens[index] === 'references' ||
      (tokens[index] === 'foreign' && tokens[index + 1] === 'key')
    ) {
      count += 1
    }
  }
  return count
}

function countSqlObjectDeclarations(
  tokens: string[],
  objectTypes: ReadonlySet<string>,
) {
  let count = 0
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== 'create') {
      continue
    }
    let cursor = index + 1
    if (tokens[cursor] === 'or' && tokens[cursor + 1] === 'replace') {
      cursor += 2
    }
    if (tokens[cursor] === 'constraint' && objectTypes.has('trigger')) {
      cursor += 1
    }
    if (objectTypes.has(tokens[cursor] ?? '')) {
      count += 1
    }
  }
  return count
}

function splitPostgresSqlStatements(source: string): SqlStatement[] {
  const tokens = lexPostgresSql(source)
  const statements: SqlStatement[] = []
  let statementStart = 0

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token?.kind !== 'symbol' || token.value !== ';') {
      continue
    }

    appendSqlStatement(
      source,
      tokens.slice(statementStart, index),
      token.end,
      statements,
    )
    statementStart = index + 1
  }

  appendSqlStatement(
    source,
    tokens.slice(statementStart),
    undefined,
    statements,
  )
  return statements
}

function appendSqlStatement(
  source: string,
  tokens: SqlToken[],
  statementEnd: number | undefined,
  statements: SqlStatement[],
) {
  const firstToken = tokens[0]
  const lastToken = tokens.at(-1)
  if (!firstToken || !lastToken) {
    return
  }

  const sql = source
    .slice(firstToken.start, statementEnd ?? lastToken.end)
    .trim()
  if (sql.length > 0) {
    statements.push({ sql, tokens })
  }
}

// 禁止 migration 自行控制事务，避免与 Drizzle Kit 的迁移事务语义嵌套或漂移。
function isTransactionControlStatement(statement: SqlStatement): boolean {
  const firstKeyword = readSqlKeyword(statement.tokens[0])
  const secondKeyword = readSqlKeyword(statement.tokens[1])
  if (
    firstKeyword === 'abort' ||
    firstKeyword === 'begin' ||
    firstKeyword === 'commit' ||
    firstKeyword === 'end' ||
    firstKeyword === 'rollback' ||
    firstKeyword === 'savepoint'
  ) {
    return true
  }
  if (firstKeyword === 'release') {
    return true
  }
  if (firstKeyword === 'start' && secondKeyword === 'transaction') {
    return true
  }
  if (firstKeyword === 'prepare' && secondKeyword === 'transaction') {
    return true
  }
  if (
    firstKeyword === 'set' &&
    (secondKeyword === 'constraints' || secondKeyword === 'transaction')
  ) {
    return true
  }
  return false
}

function parseSchemaCommentStatement(
  statement: SqlStatement,
): ParsedSchemaCommentStatement | 'targetless' | undefined {
  const tokens = statement.tokens
  if (!isSqlKeyword(tokens[0], 'comment') || !isSqlKeyword(tokens[1], 'on')) {
    return undefined
  }

  const kind = readSqlKeyword(tokens[2])
  if (kind !== 'table' && kind !== 'column') {
    return undefined
  }

  const parts: string[] = []
  let cursor = 3
  while (true) {
    const identifier = readSqlIdentifier(tokens[cursor])
    if (!identifier) {
      break
    }
    parts.push(identifier)
    cursor += 1
    if (tokens[cursor]?.kind !== 'symbol' || tokens[cursor].value !== '.') {
      break
    }
    cursor += 1
  }

  if (!isSqlKeyword(tokens[cursor], 'is')) {
    return 'targetless'
  }

  const target = createSchemaCommentTargetFromParts(kind, parts)
  const valueToken = tokens[cursor + 1]
  if (!target || !valueToken) {
    return 'targetless'
  }

  return {
    removesComment: isSqlKeyword(valueToken, 'null'),
    target,
    valueSql: readSqlStatementSuffix(statement, valueToken),
  }
}

function createSchemaCommentTargetFromParts(
  kind: SchemaCommentTarget['kind'],
  parts: string[],
): SchemaCommentTarget | undefined {
  if (kind === 'table') {
    if (parts.length === 1 && parts[0]) {
      return createSchemaCommentTarget('table', 'public', parts[0])
    }
    if (parts.length === 2 && parts[0] && parts[1]) {
      return createSchemaCommentTarget('table', parts[0], parts[1])
    }
    return undefined
  }

  if (parts.length === 2 && parts[0] && parts[1]) {
    return createSchemaCommentTarget('column', 'public', parts[0], parts[1])
  }
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return createSchemaCommentTarget('column', parts[0], parts[1], parts[2])
  }
  return undefined
}

function createSchemaCommentTarget(
  kind: SchemaCommentTarget['kind'],
  schemaName: string,
  tableName: string,
  columnName?: string,
): SchemaCommentTarget {
  if (kind === 'column') {
    if (!columnName) {
      throw new Error('Column comment target requires a column name')
    }
    return {
      columnName,
      kind,
      schemaName,
      tableName,
      targetKey: getSchemaCommentTargetKey(
        kind,
        schemaName,
        tableName,
        columnName,
      ),
    }
  }
  return {
    kind,
    schemaName,
    tableName,
    targetKey: getSchemaCommentTargetKey(kind, schemaName, tableName),
  }
}

function readSchemaCommentValueSql(sql: string): string {
  const statements = splitPostgresSqlStatements(sql)
  const statement = statements[0]
  const parsed = statement ? parseSchemaCommentStatement(statement) : undefined
  if (!parsed || parsed === 'targetless') {
    throw new Error(
      'Schema comment artifact contains an invalid comment statement',
    )
  }
  return parsed.valueSql
}

function readSqlStatementSuffix(
  statement: SqlStatement,
  token: SqlToken,
): string {
  const firstToken = statement.tokens[0]
  if (!firstToken) {
    return ''
  }
  return statement.sql
    .slice(token.start - firstToken.start)
    .replace(/;\s*$/u, '')
}

function parseSchemaCommentTargetMutations(
  statement: SqlStatement,
): SchemaCommentTargetMutation[] {
  const dropTable = parseDropTableCommentTargetMutation(statement.tokens)
  if (dropTable) {
    return [dropTable]
  }
  return parseAlterTableCommentTargetMutations(statement.tokens)
}

function parseDropTableCommentTargetMutation(
  tokens: SqlToken[],
): SchemaCommentTargetMutation | undefined {
  if (!isSqlKeyword(tokens[0], 'drop') || !isSqlKeyword(tokens[1], 'table')) {
    return undefined
  }

  const tables: SchemaCommentTableReference[] = []
  let cursor = skipIfExists(tokens, 2)
  while (cursor < tokens.length) {
    const parsed = readSchemaCommentTableReference(tokens, cursor)
    if (!parsed) {
      break
    }
    tables.push(parsed.table)
    cursor = parsed.cursor
    if (tokens[cursor]?.kind !== 'symbol' || tokens[cursor].value !== ',') {
      break
    }
    cursor += 1
  }

  return tables.length > 0 ? { operation: 'drop-table', tables } : undefined
}

function parseAlterTableCommentTargetMutations(
  tokens: SqlToken[],
): SchemaCommentTargetMutation[] {
  if (!isSqlKeyword(tokens[0], 'alter') || !isSqlKeyword(tokens[1], 'table')) {
    return []
  }

  let cursor = skipIfExists(tokens, 2)
  if (isSqlKeyword(tokens[cursor], 'only')) {
    cursor += 1
  }
  const parsedTable = readSchemaCommentTableReference(tokens, cursor)
  if (!parsedTable) {
    return []
  }
  cursor = parsedTable.cursor
  if (tokens[cursor]?.kind === 'symbol' && tokens[cursor].value === '*') {
    cursor += 1
  }

  return splitAlterTableActions(tokens.slice(cursor)).flatMap((action) => {
    const mutation = parseAlterTableCommentTargetMutation(
      parsedTable.table,
      action,
    )
    return mutation ? [mutation] : []
  })
}

function parseAlterTableCommentTargetMutation(
  table: SchemaCommentTableReference,
  tokens: SqlToken[],
): SchemaCommentTargetMutation | undefined {
  if (isSqlKeyword(tokens[0], 'drop')) {
    let cursor = 1
    const explicitlyColumn = isSqlKeyword(tokens[cursor], 'column')
    if (explicitlyColumn) {
      cursor += 1
    }
    cursor = skipIfExists(tokens, cursor)
    const columnName = readSqlIdentifier(tokens[cursor])
    if (
      !columnName ||
      (!explicitlyColumn &&
        ['constraint', 'default', 'expression', 'identity'].includes(
          columnName,
        ))
    ) {
      return undefined
    }
    return { columnName, operation: 'drop-column', table }
  }

  if (isSqlKeyword(tokens[0], 'rename')) {
    let cursor = 1
    if (isSqlKeyword(tokens[cursor], 'to')) {
      const newTableName = readSqlIdentifier(tokens[cursor + 1])
      return newTableName
        ? { newTableName, operation: 'rename-table', table }
        : undefined
    }
    if (isSqlKeyword(tokens[cursor], 'column')) {
      cursor += 1
    } else if (isSqlKeyword(tokens[cursor], 'constraint')) {
      return undefined
    }
    const columnName = readSqlIdentifier(tokens[cursor])
    if (!columnName || !isSqlKeyword(tokens[cursor + 1], 'to')) {
      return undefined
    }
    const newColumnName = readSqlIdentifier(tokens[cursor + 2])
    return newColumnName
      ? { columnName, newColumnName, operation: 'rename-column', table }
      : undefined
  }

  if (isSqlKeyword(tokens[0], 'set') && isSqlKeyword(tokens[1], 'schema')) {
    const newSchemaName = readSqlIdentifier(tokens[2])
    return newSchemaName
      ? { newSchemaName, operation: 'move-table', table }
      : undefined
  }

  return undefined
}

function skipIfExists(tokens: SqlToken[], cursor: number): number {
  return isSqlKeyword(tokens[cursor], 'if') &&
    isSqlKeyword(tokens[cursor + 1], 'exists')
    ? cursor + 2
    : cursor
}

function readSchemaCommentTableReference(
  tokens: SqlToken[],
  cursor: number,
): { cursor: number; table: SchemaCommentTableReference } | undefined {
  const parts: string[] = []
  const first = readSqlIdentifier(tokens[cursor])
  if (!first) {
    return undefined
  }
  parts.push(first)
  cursor += 1
  if (tokens[cursor]?.kind === 'symbol' && tokens[cursor].value === '.') {
    const second = readSqlIdentifier(tokens[cursor + 1])
    if (!second) {
      return undefined
    }
    parts.push(second)
    cursor += 2
  }

  if (parts.length === 1) {
    return { cursor, table: { schemaName: 'public', tableName: parts[0] } }
  }
  const [schemaName, tableName] = parts
  return schemaName && tableName
    ? { cursor, table: { schemaName, tableName } }
    : undefined
}

function splitAlterTableActions(tokens: SqlToken[]): SqlToken[][] {
  const actions: SqlToken[][] = []
  let actionStart = 0
  let parenthesisDepth = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token?.kind !== 'symbol') {
      continue
    }
    if (token.value === '(') {
      parenthesisDepth += 1
      continue
    }
    if (token.value === ')') {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1)
      continue
    }
    if (token.value === ',' && parenthesisDepth === 0) {
      const action = tokens.slice(actionStart, index)
      if (action.length > 0) {
        actions.push(action)
      }
      actionStart = index + 1
    }
  }
  const finalAction = tokens.slice(actionStart)
  if (finalAction.length > 0) {
    actions.push(finalAction)
  }
  return actions
}

function applySchemaCommentTargetMutation(
  comments: Map<string, MigrationCommentStatement>,
  mutation: SchemaCommentTargetMutation,
) {
  if (mutation.operation === 'drop-table') {
    for (const table of mutation.tables) {
      deleteSchemaCommentsForTable(comments, table)
    }
    return
  }
  if (mutation.operation === 'drop-column') {
    comments.delete(
      getSchemaCommentTargetKey(
        'column',
        mutation.table.schemaName,
        mutation.table.tableName,
        mutation.columnName,
      ),
    )
    return
  }
  if (mutation.operation === 'rename-column') {
    const targetKey = getSchemaCommentTargetKey(
      'column',
      mutation.table.schemaName,
      mutation.table.tableName,
      mutation.columnName,
    )
    const comment = comments.get(targetKey)
    if (!comment) {
      return
    }
    const target = createSchemaCommentTarget(
      'column',
      mutation.table.schemaName,
      mutation.table.tableName,
      mutation.newColumnName,
    )
    comments.delete(targetKey)
    comments.set(target.targetKey, { ...comment, target })
    return
  }

  const newSchemaName =
    mutation.operation === 'move-table'
      ? mutation.newSchemaName
      : mutation.table.schemaName
  const newTableName =
    mutation.operation === 'rename-table'
      ? mutation.newTableName
      : mutation.table.tableName
  rewriteSchemaCommentTableTargets(
    comments,
    mutation.table,
    newSchemaName,
    newTableName,
  )
}

function deleteSchemaCommentsForTable(
  comments: Map<string, MigrationCommentStatement>,
  table: SchemaCommentTableReference,
) {
  for (const [targetKey, comment] of comments) {
    if (isSchemaCommentTargetForTable(comment.target, table)) {
      comments.delete(targetKey)
    }
  }
}

function rewriteSchemaCommentTableTargets(
  comments: Map<string, MigrationCommentStatement>,
  table: SchemaCommentTableReference,
  newSchemaName: string,
  newTableName: string,
) {
  const matches = [...comments.values()].filter((comment) =>
    isSchemaCommentTargetForTable(comment.target, table),
  )
  for (const comment of matches) {
    comments.delete(comment.target.targetKey)
  }
  for (const comment of matches) {
    const target = createSchemaCommentTarget(
      comment.target.kind,
      newSchemaName,
      newTableName,
      comment.target.kind === 'column' ? comment.target.columnName : undefined,
    )
    comments.set(target.targetKey, { ...comment, target })
  }
}

function isSchemaCommentTargetForTable(
  target: SchemaCommentTarget,
  table: SchemaCommentTableReference,
) {
  return (
    target.schemaName === table.schemaName &&
    target.tableName === table.tableName
  )
}

function readSqlKeyword(token: SqlToken | undefined): string | undefined {
  return token?.kind === 'identifier' ? token.value : undefined
}

function isSqlKeyword(token: SqlToken | undefined, keyword: string): boolean {
  return readSqlKeyword(token) === keyword
}

function readSqlIdentifier(token: SqlToken | undefined): string | undefined {
  if (token?.kind === 'identifier' || token?.kind === 'quoted-identifier') {
    return token.value
  }
  return undefined
}

function tokenizeSql(source: string) {
  return lexPostgresSql(source)
    .filter(
      (token) =>
        token.kind === 'identifier' || token.kind === 'quoted-identifier',
    )
    .map((token) => token.value.toLowerCase())
}

function lexPostgresSql(source: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let index = 0

  while (index < source.length) {
    const character = source[index] ?? ''
    const next = source[index + 1] ?? ''
    if (/\s/u.test(character)) {
      index += 1
      continue
    }
    if (character === '-' && next === '-') {
      index = skipLineComment(source, index)
      continue
    }
    if (character === '/' && next === '*') {
      index = skipBlockComment(source, index)
      continue
    }

    const stringEnd = readPostgresStringEnd(source, index)
    if (stringEnd !== undefined) {
      tokens.push({ end: stringEnd, kind: 'string', start: index, value: '' })
      index = stringEnd
      continue
    }

    const dollarQuotedStringEnd = readDollarQuotedStringEnd(source, index)
    if (dollarQuotedStringEnd !== undefined) {
      tokens.push({
        end: dollarQuotedStringEnd,
        kind: 'string',
        start: index,
        value: '',
      })
      index = dollarQuotedStringEnd
      continue
    }

    const quotedIdentifier = readPostgresQuotedIdentifier(source, index)
    if (quotedIdentifier) {
      tokens.push({
        end: quotedIdentifier.end,
        kind: 'quoted-identifier',
        start: index,
        value: quotedIdentifier.value,
      })
      index = quotedIdentifier.end
      continue
    }

    if (isSqlIdentifierStart(character)) {
      const start = index
      index += 1
      while (isSqlIdentifierPart(source[index] ?? '')) {
        index += 1
      }
      tokens.push({
        end: index,
        kind: 'identifier',
        start,
        value: source.slice(start, index).toLowerCase(),
      })
      continue
    }

    tokens.push({
      end: index + 1,
      kind: 'symbol',
      start: index,
      value: character,
    })
    index += 1
  }

  return tokens
}

function skipLineComment(source: string, start: number): number {
  const lineEnd = source.indexOf('\n', start + 2)
  return lineEnd < 0 ? source.length : lineEnd + 1
}

function skipBlockComment(source: string, start: number): number {
  let depth = 1
  let index = start + 2
  while (index < source.length && depth > 0) {
    if (source[index] === '/' && source[index + 1] === '*') {
      depth += 1
      index += 2
      continue
    }
    if (source[index] === '*' && source[index + 1] === '/') {
      depth -= 1
      index += 2
      continue
    }
    index += 1
  }
  return index
}

function readPostgresStringEnd(
  source: string,
  start: number,
): number | undefined {
  const character = source[start]
  if (character === "'") {
    return readSingleQuotedStringEnd(source, start, false)
  }
  if ((character === 'e' || character === 'E') && source[start + 1] === "'") {
    return readSingleQuotedStringEnd(source, start + 1, true)
  }
  if (
    (character === 'u' || character === 'U') &&
    source[start + 1] === '&' &&
    source[start + 2] === "'"
  ) {
    return readSingleQuotedStringEnd(source, start + 2, true)
  }
  if (
    ['b', 'B', 'n', 'N', 'x', 'X'].includes(character ?? '') &&
    source[start + 1] === "'"
  ) {
    return readSingleQuotedStringEnd(source, start + 1, false)
  }
  return undefined
}

function readSingleQuotedStringEnd(
  source: string,
  quoteStart: number,
  supportsBackslashEscapes: boolean,
): number {
  let index = quoteStart + 1
  while (index < source.length) {
    if (supportsBackslashEscapes && source[index] === '\\') {
      index += 2
      continue
    }
    if (source[index] !== "'") {
      index += 1
      continue
    }
    if (source[index + 1] === "'") {
      index += 2
      continue
    }
    return index + 1
  }
  return source.length
}

function readDollarQuotedStringEnd(
  source: string,
  start: number,
): number | undefined {
  if (source[start] !== '$') {
    return undefined
  }

  let cursor = start + 1
  if (source[cursor] !== '$') {
    if (!isSqlIdentifierStart(source[cursor] ?? '')) {
      return undefined
    }
    cursor += 1
    while (isDollarQuoteTagPart(source[cursor] ?? '')) {
      cursor += 1
    }
    if (source[cursor] !== '$') {
      return undefined
    }
  }

  const delimiter = source.slice(start, cursor + 1)
  const close = source.indexOf(delimiter, cursor + 1)
  return close < 0 ? source.length : close + delimiter.length
}

function readPostgresQuotedIdentifier(
  source: string,
  start: number,
): { end: number; value: string } | undefined {
  const isUnicodeQuotedIdentifier =
    (source[start] === 'u' || source[start] === 'U') &&
    source[start + 1] === '&' &&
    source[start + 2] === '"'
  const quoteStart = isUnicodeQuotedIdentifier ? start + 2 : start
  if (source[quoteStart] !== '"') {
    return undefined
  }

  let index = quoteStart + 1
  let value = ''
  while (index < source.length) {
    if (source[index] === '"' && source[index + 1] === '"') {
      value += '"'
      index += 2
      continue
    }
    if (source[index] === '"') {
      return { end: index + 1, value }
    }
    value += source[index]
    index += 1
  }
  return { end: source.length, value }
}

function isSqlIdentifierStart(value: string): boolean {
  return (
    value === '_' ||
    isAsciiLatinLetter(value) ||
    (value.codePointAt(0) ?? 0) >= 0x80
  )
}

function isSqlIdentifierPart(value: string): boolean {
  return isSqlIdentifierStart(value) || isAsciiDigit(value) || value === '$'
}

function isDollarQuoteTagPart(value: string): boolean {
  return isSqlIdentifierStart(value) || isAsciiDigit(value)
}

function isAsciiLatinLetter(value: string): boolean {
  return (value >= 'A' && value <= 'Z') || (value >= 'a' && value <= 'z')
}

function isAsciiDigit(value: string): boolean {
  return value >= '0' && value <= '9'
}

function readTemplateText(template: ts.TemplateLiteral) {
  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    return template.text
  }
  return [
    template.head.text,
    ...template.templateSpans.map((span) => span.literal.text),
  ].join(' ')
}

function readTagName(tag: ts.LeftHandSideExpression) {
  if (ts.isIdentifier(tag)) {
    return tag.text
  }
  if (ts.isPropertyAccessExpression(tag)) {
    return tag.name.text
  }
  return undefined
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapExpression(expression.expression)
  }
  return expression
}

function hasAwaitAncestorBefore(node: ts.Node, boundary: ts.Node) {
  let current: ts.Node | undefined = node.parent
  while (current && current !== boundary) {
    if (ts.isAwaitExpression(current)) {
      return true
    }
    current = current.parent
  }
  return false
}

function isNodeWithin(node: ts.Node, ancestor: ts.Node) {
  let current: ts.Node | undefined = node
  while (current) {
    if (current === ancestor) {
      return true
    }
    current = current.parent
  }
  return false
}

function compareWriterRecords(left: WriterRecord, right: WriterRecord) {
  return (
    left.owner.localeCompare(right.owner) ||
    left.table.localeCompare(right.table) ||
    left.operation.localeCompare(right.operation) ||
    left.kind.localeCompare(right.kind) ||
    left.payloadKeys.join(',').localeCompare(right.payloadKeys.join(','))
  )
}

function groupCounts(values: readonly string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function digest(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function toSnakeCase(value: string) {
  return value.replaceAll(/([a-z0-9])([A-Z])/gu, '$1_$2').toLowerCase()
}

function repoPath(context: ProjectContext, sourceFile: ts.SourceFile) {
  return relative(context.root, sourceFile.fileName).replaceAll('\\', '/')
}

function nodeLocationKey(context: ProjectContext, node: ts.Node) {
  return `${repoPath(context, node.getSourceFile())}:${node.getStart()}`
}

function isRepositorySource(root: string, filePath: string) {
  const file = relative(root, filePath).replaceAll('\\', '/')
  return (
    !file.startsWith('../') &&
    SOURCE_ROOTS.some((directory) => file.startsWith(`${directory}/`)) &&
    ![...SKIPPED_DIRECTORIES].some((directory) =>
      file.split('/').includes(directory),
    ) &&
    !file.endsWith('.d.ts')
  )
}

function walk(node: ts.Node, visitor: (node: ts.Node) => void) {
  visitor(node)
  ts.forEachChild(node, (child) => walk(child, visitor))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readRoot(argv = process.argv) {
  const args = argv.slice(2)
  if (args.length === 0) {
    return resolve(__dirname, '..')
  }
  if (args.length === 2 && args[0] === '--root') {
    const root = resolve(args[1])
    if (!statSync(root).isDirectory()) {
      throw new Error('integrity-check root must be a directory')
    }
    return root
  }
  throw new Error('Usage: tsx scripts/check-db-integrity.ts [--root <path>]')
}

function main() {
  const report = collectDbIntegrityReport(readRoot())
  const output = {
    counts: report.counts,
    status: report.status,
    structureDigest: report.structureDigest,
    summaries: report.summaries,
    violationCodes: report.violations,
  }
  process.stdout.write(`${JSON.stringify(output)}\n`)
  if (report.status === 'fail') {
    process.exitCode = 1
  }
}

// 映射类型的 transient 字段没有声明节点，只接受公开可表示的字符串字段名。
function readSyntheticStringPropertyName(name: string): string | undefined {
  return isPublicIdentifierPropertyName(name) || isDecimalPropertyName(name)
    ? name
    : undefined
}

// 使用公开 parser API 验证标识符，避免依赖 TypeScript 未声明的内部辅助函数。
function isPublicIdentifierPropertyName(name: string): boolean {
  const escapedName = [...name]
    .map((character) => {
      const codePoint = character.codePointAt(0)!
      return codePoint <= 65535
        ? `\\u${codePoint.toString(16).padStart(4, '0')}`
        : `\\u{${codePoint.toString(16)}}`
    })
    .join('')
  const sourceFile = ts.createSourceFile(
    'payload-property.ts',
    `type Payload = { ${escapedName}: unknown }`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const statement = sourceFile.statements[0]
  if (
    sourceFile.statements.length !== 1 ||
    !statement ||
    !ts.isTypeAliasDeclaration(statement) ||
    !ts.isTypeLiteralNode(statement.type)
  ) {
    return false
  }
  const member = statement.type.members[0]
  return (
    statement.type.members.length === 1 &&
    !!member &&
    ts.isPropertySignature(member) &&
    ts.isIdentifier(member.name) &&
    member.name.text === name
  )
}

// 判断字符串是否为十进制属性名，不依赖 TypeScript 内部 symbol 编码。
function isDecimalPropertyName(name: string): boolean {
  return (
    name.length > 0 &&
    [...name].every((character) => character >= '0' && character <= '9')
  )
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main()
}
