# 非必要显式返回类型排查记录

## 范围

- 目录：`apps/*`、`libs/*`、`db/*`、`scripts/*`。
- 文件：`.ts` / `.tsx` / `.js` / `.jsx`（排除依赖、构建产物与历史快照目录）。

## 判定口径

- 问题定义：内部实现（private/protected 方法、非导出函数）中，返回类型可由 TypeScript 推导但仍显式声明。
- 非问题：public/导出函数的稳定契约声明、类型谓词（`value is T`）、无函数体签名。

## 发现记录（按发现顺序）

| 序号 | 文件 | 行号 | 声明 | 判定理由 |
| --- | --- | --- | --- | --- |
| 1 | libs\config\src\system-config\system-config.service.ts | 366 | private cloneConfig<T>(config: T): T { | 内部方法，默认应依赖推导 |
| 2 | libs\config\src\system-config\system-config.service.ts | 370 | private removeNullValues<T>(value: T): T { | 内部方法，默认应依赖推导 |
| 3 | libs\content\src\permission\content-permission.service.ts | 123 | private async getUserWithLevel(userId: number): Promise<UserWithLevel> { | 内部方法，默认应依赖推导 |
| 4 | libs\content\src\work\content\comic-archive-import.service.ts | 705 | private toTaskView(record: ComicArchiveTaskRecord): ComicArchiveTaskView { | 内部方法，默认应依赖推导 |
| 5 | libs\content\src\work\content\comic-archive-import.service.ts | 883 | private toTaskRecord(row: WorkComicArchiveImportTaskSelect): ComicArchiveTaskRecord { | 内部方法，默认应依赖推导 |
| 6 | libs\content\src\work\content\comic-archive-import.service.ts | 907 | private normalizeSummary(value: unknown): ComicArchiveSummaryView { | 内部方法，默认应依赖推导 |
| 7 | libs\content\src\work\content\comic-archive-import.service.ts | 916 | private normalizeIgnoredItems(value: unknown): ComicArchiveIgnoredItemView[] { | 内部方法，默认应依赖推导 |
| 8 | libs\content\src\work\content\comic-archive-import.service.ts | 931 | private normalizeMatchedItems(value: unknown): ComicArchiveMatchedItemRecord[] { | 内部方法，默认应依赖推导 |
| 9 | libs\content\src\work\content\comic-archive-import.service.ts | 953 | private normalizeResultItems(value: unknown): ComicArchiveResultItemView[] { | 内部方法，默认应依赖推导 |
| 10 | libs\content\src\work\counter\work-counter.service.ts | 115 | private rethrowNotFound(error: unknown, message: string): never { | 内部方法，默认应依赖推导 |
| 11 | libs\forum\src\counter\forum-counter.service.ts | 84 | private rethrowNotFound(error: unknown, message: string): never { | 内部方法，默认应依赖推导 |
| 12 | libs\forum\src\moderator\moderator.service.ts | 60 | ): ForumModeratorPermissionEnum[] { | 内部方法，默认应依赖推导 |
| 13 | libs\forum\src\moderator\moderator.service.ts | 151 | ): Promise<ForumModeratorSectionScope[]> { | 内部方法，默认应依赖推导 |
| 14 | libs\forum\src\moderator\moderator.service.ts | 336 | ): Promise<ForumModeratorView[]> { | 内部方法，默认应依赖推导 |
| 15 | libs\forum\src\moderator-application\moderator-application.service.ts | 39 | ): ForumModeratorPermissionEnum[] { | 内部方法，默认应依赖推导 |
| 16 | libs\forum\src\permission\forum-permission.service.ts | 45 | ): Promise<ForumPostingUserContext> { | 内部方法，默认应依赖推导 |
| 17 | libs\forum\src\search\search.service.ts | 68 | private createEmptyPage(searchInput: ForumSearchInput): ForumSearchPageResult { | 内部方法，默认应依赖推导 |
| 18 | libs\growth\src\event-definition\event-definition.service.ts | 92 | private cloneDefinition(definition: EventDefinition): EventDefinition { | 内部方法，默认应依赖推导 |
| 19 | libs\growth\src\event-definition\event-envelope.type.ts | 205 | ): EventEnvelopeContext \\| undefined { | 非导出函数，默认应依赖推导 |
| 20 | libs\growth\src\growth-ledger\growth-ledger.service.ts | 741 | private formatDateKey(input: Date): string { | 内部方法，默认应依赖推导 |
| 21 | libs\growth\src\growth-ledger\growth-ledger.service.ts | 781 | private async deleteLedgerRecordById(tx: Tx, id: number): Promise<void> { | 内部方法，默认应依赖推导 |
| 22 | libs\growth\src\growth-reward\growth-reward.service.ts | 345 | ): TaskAssignmentRewardResultTypeEnum { | 内部方法，默认应依赖推导 |
| 23 | libs\growth\src\growth-reward\growth-reward.service.ts | 472 | private parseRewardConfig(input: unknown): { | 内部方法，默认应依赖推导 |
| 24 | libs\growth\src\growth-reward\growth-reward.service.ts | 487 | private asRecord(input: unknown): Record<string, unknown> \\| null { | 内部方法，默认应依赖推导 |
| 25 | libs\growth\src\growth-reward\growth-reward.service.ts | 494 | private readPositiveInt(input: unknown): number { | 内部方法，默认应依赖推导 |
| 26 | libs\growth\src\task\task-notification.service.ts | 72 | ): CreateNotificationOutboxEventInput { | 内部方法，默认应依赖推导 |
| 27 | libs\growth\src\task\task.service.support.ts | 163 | ): Promise<QueryTaskAssignmentPageResult> { | 内部方法，默认应依赖推导 |
| 28 | libs\growth\src\task\task.service.support.ts | 319 | ): TaskRewardConfig \\| null \\| undefined { | 内部方法，默认应依赖推导 |
| 29 | libs\growth\src\task\task.service.support.ts | 368 | ): TaskRepeatRuleConfig \\| null \\| undefined { | 内部方法，默认应依赖推导 |
| 30 | libs\growth\src\task\task.service.support.ts | 417 | ): TaskObjectiveConfig \\| null \\| undefined { | 内部方法，默认应依赖推导 |
| 31 | libs\growth\src\task\task.service.support.ts | 784 | protected formatDate(date: Dayjs): string { | 内部方法，默认应依赖推导 |
| 32 | libs\growth\src\task\task.service.support.ts | 794 | protected getWeekStart(date: Dayjs): Dayjs { | 内部方法，默认应依赖推导 |
| 33 | libs\growth\src\task\task.service.support.ts | 1044 | ): TaskProgressLogInsert { | 内部方法，默认应依赖推导 |
| 34 | libs\growth\src\task\task.service.support.ts | 2437 | protected asRecord(input: unknown): Record<string, unknown> \\| null { | 内部方法，默认应依赖推导 |
| 35 | libs\identity\src\token\drizzle-token-storage.base.ts | 31 | protected async createOne(data: CreateTokenInput): Promise<TEntity> { | 内部方法，默认应依赖推导 |
| 36 | libs\identity\src\token\drizzle-token-storage.base.ts | 53 | protected async createManyItems(data: CreateTokenInput[]): Promise<number> { | 内部方法，默认应依赖推导 |
| 37 | libs\identity\src\token\drizzle-token-storage.base.ts | 77 | protected async findOneByJti(jti: string): Promise<TEntity \\| null> { | 内部方法，默认应依赖推导 |
| 38 | libs\interaction\src\comment\comment.service.ts | 168 | private isVisible(comment: CommentVisibleState): boolean { | 内部方法，默认应依赖推导 |
| 39 | libs\interaction\src\comment\comment.service.ts | 275 | ): VisibleCommentEffectPayload { | 内部方法，默认应依赖推导 |
| 40 | libs\interaction\src\download\download.service.ts | 59 | ): IDownloadTargetResolver { | 内部方法，默认应依赖推导 |
| 41 | libs\interaction\src\download\download.service.ts | 67 | private extractRows<T>(result: unknown): T[] { | 内部方法，默认应依赖推导 |
| 42 | libs\interaction\src\emoji\emoji-catalog.service.ts | 68 | private buildSceneContainsCondition(scene: EmojiSceneEnum): SQL { | 内部方法，默认应依赖推导 |
| 43 | libs\interaction\src\emoji\emoji-catalog.service.ts | 76 | private buildActivePackCondition(scene: EmojiSceneEnum): SQL { | 内部方法，默认应依赖推导 |
| 44 | libs\interaction\src\emoji\emoji-catalog.service.ts | 88 | private buildActiveAssetCondition(): SQL { | 内部方法，默认应依赖推导 |
| 45 | libs\interaction\src\emoji\emoji-catalog.service.ts | 120 | private toAssetSnapshot(row: EmojiAssetSnapshotRow): EmojiAssetSnapshot { | 内部方法，默认应依赖推导 |
| 46 | libs\interaction\src\favorite\favorite.service.ts | 41 | private resolveErrorCode(error: unknown): string { | 内部方法，默认应依赖推导 |
| 47 | libs\interaction\src\favorite\favorite.service.ts | 62 | ): IFavoriteTargetResolver { | 内部方法，默认应依赖推导 |
| 48 | libs\interaction\src\follow\follow.service.ts | 42 | private resolveErrorCode(error: unknown): string { | 内部方法，默认应依赖推导 |
| 49 | libs\interaction\src\like\like.service.ts | 53 | private resolveErrorCode(error: unknown): string { | 内部方法，默认应依赖推导 |
| 50 | libs\interaction\src\like\like.service.ts | 77 | private getResolver(targetType: LikeTargetTypeEnum): ILikeTargetResolver { | 内部方法，默认应依赖推导 |
| 51 | libs\interaction\src\purchase\purchase.service.ts | 85 | ): IPurchaseTargetResolver { | 内部方法，默认应依赖推导 |
| 52 | libs\interaction\src\purchase\purchase.service.ts | 99 | private extractRows<T>(result: unknown): T[] { | 内部方法，默认应依赖推导 |
| 53 | libs\interaction\src\purchase\purchase.service.ts | 107 | private buildPurchaseCreatedAtFilter(startDate?: string, endDate?: string): SQL { | 内部方法，默认应依赖推导 |
| 54 | libs\interaction\src\reading-state\reading-state.service.ts | 65 | private getResolver(workType: ContentTypeEnum): IReadingStateResolver { | 内部方法，默认应依赖推导 |
| 55 | libs\interaction\src\report\report.service.ts | 107 | private getResolver(targetType: ReportTargetTypeEnum): IReportTargetResolver { | 内部方法，默认应依赖推导 |
| 56 | libs\message\src\chat\chat.service.ts | 1193 | private parseJsonPayload(payload?: string): Record<string, unknown> \\| undefined { | 内部方法，默认应依赖推导 |
| 57 | libs\message\src\notification\notification-websocket.service.ts | 496 | private mapErrorToAck(error: unknown): Omit<WsAckPayload, 'requestId'> { | 内部方法，默认应依赖推导 |
| 58 | libs\message\src\outbox\outbox.service.ts | 246 | ): MessageNotificationTypeEnum { | 内部方法，默认应依赖推导 |
| 59 | libs\moderation\sensitive-word\src\sensitive-word-cache.service.ts | 46 | private async getFromCache<T>(config: CacheQueryConfig<T>): Promise<T[]> { | 内部方法，默认应依赖推导 |
| 60 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 87 | private async getTotalWords(): Promise<number> { | 内部方法，默认应依赖推导 |
| 61 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 98 | private async getEnabledWords(): Promise<number> { | 内部方法，默认应依赖推导 |
| 62 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 110 | private async getDisabledWords(): Promise<number> { | 内部方法，默认应依赖推导 |
| 63 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 123 | private async getTotalHits(): Promise<number> { | 内部方法，默认应依赖推导 |
| 64 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 136 | private async getHitsInDateRange(startDate: Date): Promise<number> { | 内部方法，默认应依赖推导 |
| 65 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 149 | private async getTodayHits(): Promise<number> { | 内部方法，默认应依赖推导 |
| 66 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 160 | private async getLastWeekHits(): Promise<number> { | 内部方法，默认应依赖推导 |
| 67 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 171 | private async getLastMonthHits(): Promise<number> { | 内部方法，默认应依赖推导 |
| 68 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 182 | private async getLevelStatistics(): Promise<SensitiveWordLevelStatistics[]> { | 内部方法，默认应依赖推导 |
| 69 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 205 | private async getTypeStatistics(): Promise<SensitiveWordTypeStatistics[]> { | 内部方法，默认应依赖推导 |
| 70 | libs\moderation\sensitive-word\src\sensitive-word-statistics.service.ts | 228 | private async getTopHitWords(): Promise<SensitiveWordTopHitStatistics[]> { | 内部方法，默认应依赖推导 |
| 71 | libs\moderation\sensitive-word\src\sensitive-word.service.ts | 148 | private async getLevelStatistics(): Promise<SensitiveWordLevelStatistics[]> { | 内部方法，默认应依赖推导 |
| 72 | libs\moderation\sensitive-word\src\sensitive-word.service.ts | 170 | private async getTypeStatistics(): Promise<SensitiveWordTypeStatistics[]> { | 内部方法，默认应依赖推导 |
| 73 | libs\moderation\sensitive-word\src\sensitive-word.service.ts | 192 | private async getTopHitStatistics(): Promise<SensitiveWordTopHitStatistics[]> { | 内部方法，默认应依赖推导 |
| 74 | libs\moderation\sensitive-word\src\sensitive-word.service.ts | 219 | private async getRecentHitStatistics(): Promise<SensitiveWordRecentHitStatistics[]> { | 内部方法，默认应依赖推导 |
| 75 | libs\platform\src\filters\http-exception.filter.ts | 102 | private extractErrorInfo(exception: unknown): { | 内部方法，默认应依赖推导 |
| 76 | libs\platform\src\modules\crypto\aes.service.ts | 30 | private getSecretKey(): string { | 内部方法，默认应依赖推导 |
| 77 | libs\platform\src\modules\sms\sms.service.ts | 50 | private getClient(): Dypnsapi20170525 { | 内部方法，默认应依赖推导 |
| 78 | libs\platform\src\modules\sms\sms.service.ts | 85 | private createClient(config: SmsAliyunConfig): Dypnsapi20170525 { | 内部方法，默认应依赖推导 |
| 79 | libs\platform\src\modules\upload\upload.service.ts | 198 | private getSystemUploadConfig(): UploadSystemConfig { | 内部方法，默认应依赖推导 |
| 80 | libs\platform\src\modules\upload\upload.service.ts | 255 | ): Promise<UploadResult> { | 内部方法，默认应依赖推导 |
| 81 | libs\platform\src\modules\upload\upload.service.ts | 382 | private getFileCategoryFromExt(ext: string): UploadFileCategory \\| null { | 内部方法，默认应依赖推导 |
| 82 | libs\platform\src\modules\upload\upload.service.ts | 394 | private extractScene(sceneField: unknown): string \\| null { | 内部方法，默认应依赖推导 |
| 83 | libs\platform\src\modules\upload\upload.service.ts | 484 | private toBuffer(chunk: string \\| NodeBuffer): NodeBuffer { | 内部方法，默认应依赖推导 |
| 84 | libs\platform\src\modules\upload\upload.service.ts | 488 | private async consumeStream(stream: NodeJS.ReadableStream): Promise<void> { | 内部方法，默认应依赖推导 |
| 85 | libs\platform\src\utils\bitmask.ts | 65 | function backtrack(start: number, current: number[]): void { | 非导出函数，默认应依赖推导 |
| 86 | libs\platform\src\utils\jsonParse.ts | 17 | function normalizeInputToString(input: unknown): string \\| null { | 非导出函数，默认应依赖推导 |
| 87 | libs\platform\src\utils\requestParse.ts | 49 | function shouldOmitRequestField(key: string): boolean { | 非导出函数，默认应依赖推导 |
| 88 | libs\platform\src\utils\requestParse.ts | 53 | function isSensitiveRequestField(key: string): boolean { | 非导出函数，默认应依赖推导 |
| 89 | libs\platform\src\utils\requestParse.ts | 63 | function maskSensitiveValue(value: unknown): unknown { | 非导出函数，默认应依赖推导 |
| 90 | libs\platform\src\utils\requestParse.ts | 76 | function sanitizeRequestValue(value: unknown): unknown { | 非导出函数，默认应依赖推导 |
| 91 | libs\user\src\app-user-count.service.ts | 90 | ): keyof UserFollowingCounts { | 内部方法，默认应依赖推导 |
| 92 | libs\user\src\user.service.ts | 76 | private formatRestrictionUntil(date: Date): string { | 内部方法，默认应依赖推导 |
| 93 | db\comments\schema-comments.ts | 218 | function parseSchemaSourceComments(): Map<string, SourceTableComments> { | 非导出函数，默认应依赖推导 |
| 94 | db\comments\schema-comments.ts | 290 | function listSchemaSourceFiles(directoryPath: string): string[] { | 非导出函数，默认应依赖推导 |
| 95 | db\comments\schema-comments.ts | 310 | function hasExportModifier(node: ts.Node): boolean { | 非导出函数，默认应依赖推导 |
| 96 | db\comments\schema-comments.ts | 316 | ): ts.ObjectLiteralExpression \\| null \\| undefined { | 非导出函数，默认应依赖推导 |
| 97 | db\comments\schema-comments.ts | 350 | function isPgTableExpression(expression: ts.LeftHandSideExpression): boolean { | 非导出函数，默认应依赖推导 |
| 98 | db\comments\schema-comments.ts | 362 | function getPropertyName(name: ts.PropertyName): string \\| null { | 非导出函数，默认应依赖推导 |
| 99 | db\comments\schema-comments.ts | 370 | function getNodeJsDoc(node: ts.Node): string \\| null { | 非导出函数，默认应依赖推导 |
| 100 | db\comments\schema-comments.ts | 383 | ): string { | 非导出函数，默认应依赖推导 |
| 101 | db\comments\schema-comments.ts | 403 | function normalizeJsDocComment(comment: string): string \\| null { | 非导出函数，默认应依赖推导 |
| 102 | db\comments\schema-comments.ts | 424 | function safeReadFile(filePath: string): string \\| null { | 非导出函数，默认应依赖推导 |
| 103 | db\comments\schema-comments.ts | 432 | function quoteQualifiedName(...parts: string[]): string { | 非导出函数，默认应依赖推导 |
| 104 | db\comments\schema-comments.ts | 436 | function toPgTextLiteral(value: string): string { | 非导出函数，默认应依赖推导 |
| 105 | db\core\query\order-by.ts | 21 | function normalizeOrderDirection(value: unknown): 'asc' \\| 'desc' \\| undefined { | 非导出函数，默认应依赖推导 |
| 106 | db\core\query\order-by.ts | 36 | function parseOrderBy(value: unknown): DbQueryOrderBy \\| undefined { | 非导出函数，默认应依赖推导 |
| 107 | db\core\query\order-by.ts | 155 | ): DrizzleRelationOrderBy \\| undefined { | 非导出函数，默认应依赖推导 |
| 108 | db\core\drizzle.service.ts | 207 | private resolveQueryConfig(): DbQueryConfig { | 内部方法，默认应依赖推导 |
| 109 | db\extensions\softDelete.ts | 11 | function getDeletedAtColumn(table: PgTable<TableConfig>): SQLWrapper { | 非导出函数，默认应依赖推导 |
| 110 | db\extensions\swapField.ts | 12 | function generateTemporaryValue(value1: unknown, value2: unknown): unknown { | 非导出函数，默认应依赖推导 |
| 111 | db\migrate.ts | 47 | function formatLogValue(value: unknown): string { | 非导出函数，默认应依赖推导 |
| 112 | db\migrate.ts | 78 | function formatDuration(ms: number): string { | 非导出函数，默认应依赖推导 |
| 113 | db\migrate.ts | 92 | function getRuntimeLabel(): string { | 非导出函数，默认应依赖推导 |
| 114 | db\migrate.ts | 98 | function serializeError(error: unknown): string { | 非导出函数，默认应依赖推导 |
| 115 | db\migrate.ts | 106 | function readLocalMigrations(migrationsFolder: string): LocalMigrationMeta[] { | 非导出函数，默认应依赖推导 |
| 116 | db\migrate.ts | 125 | async function getMigrationTableSnapshot(pool: Pool): Promise<MigrationTableSnapshot> { | 非导出函数，默认应依赖推导 |

## 汇总

- 问题总数：116
- 涉及文件数：46
- 扫描文件数：898
