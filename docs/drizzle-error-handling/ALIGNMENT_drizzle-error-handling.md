# Drizzle 错误捕获方案 - 对齐文档

## 1. 项目上下文分析

### 1.1 现有技术栈

- **ORM**: 项目正在从 Prisma 迁移到 Drizzle ORM
- **数据库**: PostgreSQL
- **框架**: NestJS
- **错误处理**: 已有 `HttpExceptionFilter` 全局异常过滤器

### 1.2 现有错误处理机制

#### Prisma 错误处理（现有）

项目在 `libs/platform/src/database/platform.service.ts` 中已有完善的 Prisma 错误处理机制：

```typescript
// Prisma 错误码映射
P2002 - 唯一约束冲突
P2025 - 记录不存在
P2034 - 事务冲突
```

#### 全局异常过滤器（现有）

`libs/platform/src/filters/http-exception.filter.ts` 中已配置：

```typescript
// 已支持的错误码
FST_REQ_FILE_TOO_LARGE - 文件过大
FST_FILES_LIMIT - 文件数量超限
P2002 - 数据已存在
P2025 - 记录不存在
P2034 - 请求冲突
```

### 1.3 Drizzle 使用现状

当前 `db/drizzle.service.ts` 仅提供基础的数据库连接和扩展方法，**缺少错误处理机制**。

`libs/dictionary/src/dictionary.service.ts` 中的 Drizzle 错误处理示例：

```typescript
// 当前不完善的错误处理
catch (error) {
  console.log('error:', error.cause)  // 仅打印日志，无业务错误返回
}
```

---

## 2. 需求理解确认

### 2.1 原始需求

> 我想做一些 drizzle 的错误捕获，给前端返回一些错误信息

### 2.2 需求边界

| 范围 | 说明 |
|------|------|
| **包含** | PostgreSQL 数据库错误的捕获和转换 |
| **包含** | 唯一约束、外键约束、非空约束等常见错误 |
| **包含** | 与现有 NestJS 异常处理系统集成 |
| **包含** | 友好的中文错误信息返回给前端 |
| **不包含** | 数据库连接错误（已有机制处理） |
| **不包含** | SQL 语法错误（开发阶段问题） |

### 2.3 对现有项目的理解

1. **迁移背景**: 项目正在从 Prisma 迁移到 Drizzle
2. **复用现有模式**: 应参考现有 `PlatformService` 的 Prisma 错误处理模式
3. **统一错误格式**: 保持与现有 `HttpExceptionFilter` 兼容
4. **简洁设计**: 直接集成到 `DrizzleService`，无需额外服务

---

## 3. 技术方案

### 3.1 方案架构

直接在 `DrizzleService` 中添加错误处理方法，与现有 `PlatformService` 模式一致：

```
┌─────────────────────────────────────────────────────────────┐
│                      Service 层                             │
│                          │                                  │
│            ┌─────────────┴─────────────┐                   │
│            ▼                           ▼                   │
│     DrizzleService               PlatformService           │
│   (Drizzle + 错误处理)          (Prisma + 错误处理)         │
│            │                           │                   │
│            └─────────────┬─────────────┘                   │
│                          ▼                                  │
│                 HttpExceptionFilter                        │
│                          ▼                                  │
│                     前端响应                                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 PostgreSQL 错误码

参考 PostgreSQL 官方错误码，主要处理以下约束类错误：

| 错误码 | 常量名 | 说明 | HTTP 状态码 |
|--------|--------|------|-------------|
| `23505` | `UNIQUE_VIOLATION` | 唯一约束冲突 | 409 Conflict |
| `23503` | `FOREIGN_KEY_VIOLATION` | 外键约束冲突 | 400 Bad Request |
| `23502` | `NOT_NULL_VIOLATION` | 非空约束冲突 | 400 Bad Request |
| `23514` | `CHECK_VIOLATION` | 检查约束冲突 | 400 Bad Request |
| `40001` | `SERIALIZATION_FAILURE` | 序列化失败（事务冲突） | 409 Conflict |

### 3.3 API 设计

```typescript
// db/drizzle.service.ts 扩展
@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  public readonly ext: ReturnType<typeof createDrizzleExtensions>

  // ========== 错误检测方法 ==========
  
  /** 检查错误是否匹配指定的 PostgreSQL 错误码 */
  isErrorCode(error: unknown, code: string): boolean
  
  /** 唯一约束冲突 (23505) */
  isUniqueViolation(error: unknown): boolean
  
  /** 外键约束冲突 (23503) */
  isForeignKeyViolation(error: unknown): boolean
  
  /** 非空约束冲突 (23502) */
  isNotNullViolation(error: unknown): boolean
  
  /** 事务冲突 (40001) */
  isSerializationFailure(error: unknown): boolean

  // ========== 错误处理方法 ==========
  
  /** 通用数据库错误映射器 */
  handleDatabaseError<T = never>(
    error: unknown,
    handlers: Partial<Record<string, () => T>>,
  ): T
  
  /** 业务错误快速处理 */
  handleBusinessError(
    error: unknown,
    options: {
      duplicateMessage?: string    // 23505 时的消息
      foreignKeyMessage?: string   // 23503 时的消息
      conflictMessage?: string     // 40001 时的消息
    },
  ): never
  
  /** 事务冲突重试 */
  async withRetry<T>(
    operation: () => Promise<T>,
    options?: { maxRetries?: number },
  ): Promise<T>
}
```

### 3.4 使用示例

```typescript
@Injectable()
export class DictionaryService {
  constructor(private readonly drizzle: DrizzleService) {}

  async createDictionary(dto: CreateDictionaryDto) {
    try {
      const [result] = await this.db
        .insert(this.dictionary)
        .values(dto)
        .returning()
      return result
    } catch (error) {
      // 方式 1: 快速业务错误处理
      this.drizzle.handleBusinessError(error, {
        duplicateMessage: '字典编码或名称已存在',
      })
    }
  }

  async updateDictionary(dto: UpdateDictionaryDto) {
    try {
      return await this.db
        .update(this.dictionary)
        .set(dto)
        .where(eq(this.dictionary.id, dto.id))
        .returning()
    } catch (error) {
      // 方式 2: 自定义处理
      this.drizzle.handleDatabaseError(error, {
        '23505': () => {
          throw new BadRequestException('字典编码已存在')
        },
        '23503': () => {
          throw new BadRequestException('关联的分类不存在')
        },
      })
    }
  }

  async batchInsert(items: CreateItemDto[]) {
    // 方式 3: 事务冲突重试
    return this.drizzle.withRetry(async () => {
      return this.db.insert(this.item).values(items).returning()
    })
  }
}
```

---

## 4. 实现文件

| 文件 | 说明 |
|------|------|
| `db/constants/postgres-error-codes.ts` | PostgreSQL 错误码常量定义 |
| `db/drizzle.service.ts` | 扩展错误处理方法 |
| `libs/platform/src/filters/http-exception.filter.ts` | 增加 PostgreSQL 错误码映射 |

---

## 5. 实现优先级

1. **P0 - 核心功能**: 在 `DrizzleService` 中添加错误检测和处理方法
2. **P1 - 全局支持**: 在 `HttpExceptionFilter` 中增加 PostgreSQL 错误码映射
3. **P2 - 示例迁移**: 更新 `DictionaryService` 作为使用示例

---

## 6. 待确认

方案已经简化为直接集成到 `DrizzleService`，是否可以开始实现？