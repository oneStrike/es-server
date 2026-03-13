# 敏感词服务 Prisma 到 Drizzle 迁移方案

## 1. 项目上下文

### 1.1 现有技术栈
- **ORM**: Prisma → Drizzle ORM
- **数据库**: PostgreSQL
- **框架**: NestJS

### 1.2 相关文件清单

#### 需要改造的服务文件
| 文件 | 描述 | 主要改造点 |
|------|------|-----------|
| `libs/sensitive-word/src/sensitive-word.service.ts` | 敏感词主服务 | CRUD、分页、统计查询 |
| `libs/sensitive-word/src/sensitive-word-cache.service.ts` | 缓存服务 | findMany 查询 |
| `libs/sensitive-word/src/sensitive-word-statistics.service.ts` | 统计服务 | count、aggregate、groupBy |
| `libs/sensitive-word/src/sensitive-word.module.ts` | 模块定义 | 添加 DrizzleModule 依赖 |

#### 已有的 Drizzle 基础设施
| 文件 | 描述 |
|------|------|
| `db/drizzle.service.ts` | Drizzle 服务，提供 db 和 schema 访问 |
| `db/drizzle.provider.ts` | Drizzle Provider 定义 |
| `db/schema/system/sensitive-word.ts` | 敏感词表 Schema 定义 |
| `db/extensions/*` | Drizzle 扩展方法 (findPagination, exists 等) |

### 1.3 数据库 Schema 已就绪
敏感词表的 Drizzle Schema 已存在于 `db/schema/system/sensitive-word.ts`，包含：
- `id`, `word`, `replaceWord`, `level`, `type`, `matchMode`
- `isEnabled`, `version`, `remark`, `hitCount`, `lastHitAt`
- `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

---

## 2. 改造需求理解

### 2.1 核心改造目标
将敏感词模块中的三个服务从 Prisma API 迁移到 Drizzle ORM API。

### 2.2 现有 Prisma API 使用情况

#### SensitiveWordService
| 方法 | Prisma API | Drizzle 对应 |
|------|-----------|-------------|
| `getSensitiveWordPage` | `findPagination` (扩展) | `drizzle.ext.findPagination` |
| `createSensitiveWord` | `create` | `db.insert().values().returning()` |
| `updateSensitiveWord` | `update`, `exists` | `db.update().set().where()`, `ext.exists` |
| `deleteSensitiveWord` | `delete` | `db.delete().where().returning()` |
| `updateSensitiveWordStatus` | `update` | `db.update().set().where()` |
| `getLevelStatistics` | `groupBy` | `db.select().groupBy()` |
| `getTypeStatistics` | `groupBy` | `db.select().groupBy()` |
| `getTopHitStatistics` | `findMany` | `db.select().from().where().orderBy().limit()` |
| `getRecentHitStatistics` | `findMany` | `db.select().from().where().orderBy().limit()` |

#### SensitiveWordCacheService
| 方法 | Prisma API | Drizzle 对应 |
|------|-----------|-------------|
| `getAllWords` | `findMany` | `db.select().from().where()` |
| `getWordsByLevel` | `findMany` | `db.select().from().where()` |
| `getWordsByType` | `findMany` | `db.select().from().where()` |
| `getWordsByMatchMode` | `findMany` | `db.select().from().where()` |

#### SensitiveWordStatisticsService
| 方法 | Prisma API | Drizzle 对应 |
|------|-----------|-------------|
| `getTotalWords` | `count()` | `db.select({ count: sql\`count(*)\` })` |
| `getEnabledWords` | `count({ where })` | `db.select({ count: sql\`count(*)\` }).where()` |
| `getDisabledWords` | `count({ where })` | `db.select({ count: sql\`count(*)\` }).where()` |
| `getTotalHits` | `aggregate({ _sum })` | `db.select({ sum: sql\`sum(hit_count)\` })` |
| `getHitsInDateRange` | `aggregate({ where, _sum })` | `db.select({ sum: sql\`sum(hit_count)\` }).where()` |
| `getLevelStatistics` | `groupBy` | `db.select().groupBy()` |
| `getTypeStatistics` | `groupBy` | `db.select().groupBy()` |
| `getTopHitWords` | `findMany` | `db.select().from().where().orderBy().limit()` |
| `getRecentHitWords` | `findMany` | `db.select().from().where().orderBy().limit()` |
| `incrementHitCount` | `updateMany` | `db.update().set().where()` |
| `incrementHitCounts` | `updateMany` | `db.update().set().where()` |

---

## 3. 疑问澄清

### 3.1 已确认事项
1. ✅ Drizzle Schema 已存在于 `db/schema/system/sensitive-word.ts`
2. ✅ DrizzleService 提供 `db`、`schema`、`ext` 属性
3. ✅ dictionary.service.ts 是标准参考模板

### 3.2 需要确认的问题

#### Q1: PlatformService 继承问题
**现状**: 当前三个服务都继承 `PlatformService`，通过 `this.prisma` 访问数据库。
**方案**: 改为注入 `DrizzleService`，参考 dictionary 服务模式。

```typescript
// 改造前
export class SensitiveWordService extends PlatformService {
  get sensitiveWord() {
    return this.prisma.sensitiveWord
  }
}

// 改造后
export class SensitiveWordService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() { return this.drizzle.db }
  private get sensitiveWord() { return this.drizzle.schema.sensitiveWord }
}
```

#### Q2: 类型定义问题
**现状**: 使用 Prisma 生成的 `SensitiveWord` 类型。
**方案**: 使用 Drizzle Schema 推断类型 `$inferSelect` 和 `$inferInsert`。

```typescript
// 在 sensitive-word.types.ts 或新文件中添加
import { sensitiveWord } from '@db/schema'
export type SensitiveWord = typeof sensitiveWord.$inferSelect
export type CreateSensitiveWordInput = typeof sensitiveWord.$inferInsert
```

#### Q3: Module 依赖
**现状**: Module 未导入任何数据库模块（依赖 PlatformService 全局注入）。
**方案**: 需要导入 `DrizzleModule`。

---

## 4. 改造方案

### 4.1 改造范围

```
libs/sensitive-word/src/
├── sensitive-word.service.ts          # 主服务改造
├── sensitive-word-cache.service.ts    # 缓存服务改造
├── sensitive-word-statistics.service.ts # 统计服务改造
├── sensitive-word.module.ts           # 添加 DrizzleModule
└── sensitive-word.types.ts            # 添加类型定义
```

### 4.2 详细改造内容

#### 4.2.1 sensitive-word.service.ts

**主要变更**:
1. 移除 `PlatformService` 继承
2. 注入 `DrizzleService`
3. 重写所有数据库操作

**关键代码示例**:

```typescript
// 分页查询
async getSensitiveWordPage(dto: QuerySensitiveWordDto) {
  const { word, isEnabled, level, matchMode, type, pageIndex, pageSize, orderBy } = dto

  const conditions: SQL[] = []
  if (word) conditions.push(like(this.sensitiveWord.word, `%${word}%`))
  if (isEnabled !== undefined) conditions.push(eq(this.sensitiveWord.isEnabled, isEnabled))
  if (level !== undefined) conditions.push(eq(this.sensitiveWord.level, level))
  if (matchMode !== undefined) conditions.push(eq(this.sensitiveWord.matchMode, matchMode))
  if (type !== undefined) conditions.push(eq(this.sensitiveWord.type, type))

  return this.drizzle.ext.findPagination(this.sensitiveWord, {
    where: conditions.length > 0 ? and(...conditions) : undefined,
    pageIndex,
    pageSize,
    orderBy,
  })
}

// 创建
async createSensitiveWord(dto: CreateSensitiveWordDto) {
  const [result] = await this.db
    .insert(this.sensitiveWord)
    .values(dto)
    .returning()

  await this.cacheService.invalidateAll()
  await this.detectService.reloadWords()
  return result
}

// 更新
async updateSensitiveWord(dto: UpdateSensitiveWordDto) {
  const exists = await this.drizzle.ext.exists(
    this.sensitiveWord,
    eq(this.sensitiveWord.id, dto.id)
  )
  if (!exists) {
    throw new BadRequestException(`ID【${dto.id}】数据不存在`)
  }

  const [result] = await this.db
    .update(this.sensitiveWord)
    .set(dto)
    .where(eq(this.sensitiveWord.id, dto.id))
    .returning()

  await this.cacheService.invalidateAll()
  await this.detectService.reloadWords()
  return result
}

// 删除
async deleteSensitiveWord(dto: IdDto) {
  const [result] = await this.db
    .delete(this.sensitiveWord)
    .where(eq(this.sensitiveWord.id, dto.id))
    .returning()

  await this.cacheService.invalidateAll()
  await this.detectService.reloadWords()
  return result
}

// 级别统计 (groupBy 改造)
private async getLevelStatistics(): Promise<SensitiveWordLevelStatisticsDto[]> {
  const results = await this.db
    .select({
      level: this.sensitiveWord.level,
      count: sql<number>`count(*)`,
      hitCount: sql<number>`sum(${this.sensitiveWord.hitCount})`,
    })
    .from(this.sensitiveWord)
    .groupBy(this.sensitiveWord.level)

  return results.map((result) => ({
    level: result.level,
    count: Number(result.count),
    levelName: SensitiveWordLevelNames[result.level] || '未知',
    hitCount: Number(result.hitCount) || 0,
  }))
}

// 热门敏感词统计
private async getTopHitStatistics(): Promise<SensitiveWordTopHitStatisticsDto[]> {
  const results = await this.db
    .select({
      word: this.sensitiveWord.word,
      hitCount: this.sensitiveWord.hitCount,
      level: this.sensitiveWord.level,
      type: this.sensitiveWord.type,
      lastHitAt: this.sensitiveWord.lastHitAt,
    })
    .from(this.sensitiveWord)
    .where(gt(this.sensitiveWord.hitCount, 0))
    .orderBy(desc(this.sensitiveWord.hitCount))
    .limit(20)

  return results.map((result) => ({
    word: result.word,
    hitCount: result.hitCount,
    level: result.level,
    type: result.type,
    lastHitAt: result.lastHitAt ?? undefined,
  }))
}
```

#### 4.2.2 sensitive-word-cache.service.ts

**主要变更**:
1. 移除 `PlatformService` 继承
2. 注入 `DrizzleService`
3. 重写 `findMany` 查询

**关键代码示例**:

```typescript
async getAllWords(): Promise<SensitiveWord[]> {
  return this.getFromCache<SensitiveWord>({
    cacheKey: SENSITIVE_WORD_CACHE_KEYS.ALL_WORDS,
    logMessage: (words) => `已缓存 ${words.length} 个敏感词`,
    queryFn: async () =>
      this.db
        .select()
        .from(this.sensitiveWord)
        .where(eq(this.sensitiveWord.isEnabled, true)),
  })
}

async getWordsByLevel(level: number): Promise<SensitiveWord[]> {
  return this.getFromCache<SensitiveWord>({
    cacheKey: SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_LEVEL(level),
    logMessage: (words) => `已缓存等级 ${level} 的 ${words.length} 个敏感词`,
    queryFn: async () =>
      this.db
        .select()
        .from(this.sensitiveWord)
        .where(and(
          eq(this.sensitiveWord.isEnabled, true),
          eq(this.sensitiveWord.level, level)
        )),
  })
}
```

#### 4.2.3 sensitive-word-statistics.service.ts

**主要变更**:
1. 移除 `PlatformService` 继承
2. 注入 `DrizzleService`
3. 重写 `count`、`aggregate`、`groupBy` 查询

**关键代码示例**:

```typescript
// count 改造
private async getTotalWords(): Promise<number> {
  const [result] = await this.db
    .select({ count: sql<number>`count(*)` })
    .from(this.sensitiveWord)
  return Number(result?.count ?? 0)
}

private async getEnabledWords(): Promise<number> {
  const [result] = await this.db
    .select({ count: sql<number>`count(*)` })
    .from(this.sensitiveWord)
    .where(eq(this.sensitiveWord.isEnabled, true))
  return Number(result?.count ?? 0)
}

// aggregate 改造
private async getTotalHits(): Promise<number> {
  const [result] = await this.db
    .select({ sum: sql<number>`sum(${this.sensitiveWord.hitCount})` })
    .from(this.sensitiveWord)
  return Number(result?.sum ?? 0)
}

// groupBy 改造
private async getLevelStatistics(): Promise<SensitiveWordLevelStatisticsDto[]> {
  const results = await this.db
    .select({
      level: this.sensitiveWord.level,
      count: sql<number>`count(*)`,
      hitCount: sql<number>`sum(${this.sensitiveWord.hitCount})`,
    })
    .from(this.sensitiveWord)
    .groupBy(this.sensitiveWord.level)

  return results.map((result) => ({
    level: result.level,
    levelName: SensitiveWordLevelNames[result.level] || '未知',
    count: Number(result.count),
    hitCount: Number(result.hitCount) || 0,
  }))
}

// updateMany 改造
async incrementHitCount(word: string): Promise<void> {
  try {
    await this.db
      .update(this.sensitiveWord)
      .set({
        hitCount: sql`${this.sensitiveWord.hitCount} + 1`,
        lastHitAt: new Date(),
      })
      .where(eq(this.sensitiveWord.word, word))
  } catch (error) {
    this.logger.error(`更新敏感词命中次数失败: ${word}`, error)
  }
}
```

#### 4.2.4 sensitive-word.module.ts

**变更**: 添加 DrizzleModule 导入

```typescript
import { DrizzleModule } from '@db/drizzle.module'
import { Module } from '@nestjs/common'
// ...

@Module({
  imports: [DrizzleModule],  // 添加
  // ...
})
export class SensitiveWordModule {}
```

#### 4.2.5 sensitive-word.types.ts

**变更**: 添加 Drizzle 类型定义

```typescript
import { sensitiveWord } from '@db/schema'

/** 敏感词实体类型 */
export type SensitiveWord = typeof sensitiveWord.$inferSelect

/** 创建敏感词输入类型 */
export type CreateSensitiveWordInput = typeof sensitiveWord.$inferInsert
```

---

## 5. 需要引入的 Drizzle 操作符

```typescript
import { and, desc, eq, gt, like, not, sql } from 'drizzle-orm'
```

---

## 6. 风险评估

| 风险项 | 影响 | 缓解措施 |
|--------|------|---------|
| 类型变更可能导致编译错误 | 中 | 使用 Drizzle 类型推断 |
| groupBy 语法差异 | 低 | 使用 sql 模板函数 |
| 更新操作的 increment | 低 | 使用 sql 模板表达式 |
| null 值处理差异 | 低 | 注意 lastHitAt 等可空字段 |

---

## 7. 验收标准

- [ ] 所有服务编译通过，无类型错误
- [ ] 敏感词 CRUD 功能正常
- [ ] 分页查询功能正常
- [ ] 缓存功能正常
- [ ] 统计功能正常（按级别/类型分组、命中统计）
- [ ] 命中次数更新功能正常

---

## 8. 请确认

1. 是否同意上述改造方案？
2. 是否有其他需要考虑的事项？
3. 确认后我将开始执行改造。
