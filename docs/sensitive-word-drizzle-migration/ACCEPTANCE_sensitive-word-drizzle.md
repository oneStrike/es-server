# 敏感词服务 Prisma 到 Drizzle 迁移验收报告

## 执行日期
2026-03-14

## 改造完成状态

### ✅ 已完成改造的文件

| 文件 | 状态 | 说明 |
|------|------|------|
| `libs/sensitive-word/src/sensitive-word.service.ts` | ✅ 完成 | 移除 BaseService，注入 DrizzleService，重写所有数据库操作 |
| `libs/sensitive-word/src/sensitive-word-cache.service.ts` | ✅ 完成 | 重写所有 findMany 查询 |
| `libs/sensitive-word/src/sensitive-word-statistics.service.ts` | ✅ 完成 | 重写 count、aggregate、groupBy、updateMany |
| `libs/sensitive-word/src/sensitive-word.module.ts` | ✅ 完成 | 添加 DrizzleModule 导入 |
| `libs/sensitive-word/src/sensitive-word.types.ts` | ✅ 完成 | 添加 Drizzle 类型推断定义 |

## 主要改动汇总

### 1. 服务层改造

#### SensitiveWordService
- `getSensitiveWordPage`: 使用 `drizzle.ext.findPagination` + 条件构建
- `createSensitiveWord`: `db.insert().values().returning()`
- `updateSensitiveWord`: `db.update().set().where().returning()` + `ext.exists`
- `deleteSensitiveWord`: `db.delete().where().returning()`
- `updateSensitiveWordStatus`: `db.update().set().where().returning()`
- `getLevelStatistics`: `db.select().groupBy()`
- `getTypeStatistics`: `db.select().groupBy()`
- `getTopHitStatistics`: `db.select().where().orderBy().limit()`
- `getRecentHitStatistics`: `db.select().where().orderBy().limit()`

#### SensitiveWordCacheService
- `getAllWords`: `db.select().from().where(eq(isEnabled, true))`
- `getWordsByLevel`: `db.select().where(and(eq(isEnabled, true), eq(level, level)))`
- `getWordsByType`: `db.select().where(and(eq(isEnabled, true), eq(type, type)))`
- `getWordsByMatchMode`: `db.select().where(and(eq(isEnabled, true), eq(matchMode, matchMode)))`

#### SensitiveWordStatisticsService
- `getTotalWords`: `db.select({ count: sql\`count(*)\` }).from()`
- `getEnabledWords`: `db.select({ count: sql\`count(*)\` }).where(eq(isEnabled, true))`
- `getDisabledWords`: `db.select({ count: sql\`count(*)\` }).where(eq(isEnabled, false))`
- `getTotalHits`: `db.select({ sum: sql\`sum(hitCount)\` })`
- `getHitsInDateRange`: `db.select({ sum: sql\`sum(hitCount)\` }).where(gte(lastHitAt, date))`
- `getLevelStatistics`: `db.select().groupBy(level)`
- `getTypeStatistics`: `db.select().groupBy(type)`
- `getTopHitWords`: `db.select().where(gt(hitCount, 0)).orderBy(desc(hitCount)).limit(20)`
- `getRecentHitWords`: `db.select().where(isNotNull(lastHitAt)).orderBy(desc(lastHitAt)).limit(20)`
- `incrementHitCount`: `db.update().set({ hitCount: sql\`hitCount + 1\`, lastHitAt: new Date() })`

### 2. 类型定义

```typescript
// sensitive-word.types.ts
import { sensitiveWord } from '@db/schema'

export type SensitiveWord = typeof sensitiveWord.$inferSelect
export type CreateSensitiveWordInput = typeof sensitiveWord.$inferInsert
```

### 3. 依赖注入

```typescript
// 所有服务改为注入 DrizzleService
constructor(private readonly drizzle: DrizzleService) {}

// 通过 getter 访问
private get db() { return this.drizzle.db }
private get sensitiveWord() { return this.drizzle.schema.sensitiveWord }
```

## 验证结果

### 编译验证
- ✅ TypeScript 编译通过（仅有预存在的测试文件错误，与本次改造无关）
- ✅ ESLint 无错误

### 需要测试的功能
- [ ] 敏感词 CRUD 操作
- [ ] 分页查询功能
- [ ] 缓存预加载和查询
- [ ] 统计功能（级别/类型分组、命中统计）
- [ ] 命中次数更新

## 后续工作
1. 运行单元测试验证功能正确性
2. 在开发环境进行功能测试
3. 确认缓存服务与检测服务的协同工作正常
