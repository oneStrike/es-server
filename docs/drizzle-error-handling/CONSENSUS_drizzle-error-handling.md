# Drizzle 错误捕获方案 - 最终共识

## 设计原则

1. **简洁至上**：不需要约束映射表，避免数据库变更时维护映射
2. **错误码驱动**：基于 PostgreSQL 错误码提供默认消息
3. **支持自定义**：允许调用时覆盖默认消息
4. **一行代码**：常见场景一行代码完成错误处理

---

## PostgreSQL 错误码

| 错误码 | 含义 | 默认消息 | HTTP 状态码 |
|--------|------|----------|-------------|
| `23505` | 唯一约束冲突 | 数据已存在 | 409 |
| `23503` | 外键约束冲突 | 关联数据不存在 | 400 |
| `23502` | 非空约束冲突 | 必填字段不能为空 | 400 |
| `23514` | 检查约束冲突 | 数据不符合要求 | 400 |
| `40001` | 事务冲突 | 操作冲突，请重试 | 409 |

---

## API 设计

```typescript
// db/drizzle.service.ts
@Injectable()
export class DrizzleService {
  // ==================== 错误检测 ====================
  
  /** 是否为唯一约束冲突 */
  isUniqueViolation(error: unknown): boolean
  
  /** 是否为外键约束冲突 */
  isForeignKeyViolation(error: unknown): boolean
  
  /** 是否为非空约束冲突 */
  isNotNullViolation(error: unknown): boolean
  
  /** 是否为事务冲突 */
  isSerializationFailure(error: unknown): boolean

  // ==================== 错误处理 ====================
  
  /**
   * 处理数据库错误，转换为业务异常
   * @param error 捕获的错误
   * @param messages 自定义消息（可选）
   */
  handleError(
    error: unknown,
    messages?: {
      duplicate?: string    // 23505
      foreignKey?: string   // 23503
      notNull?: string      // 23502
      conflict?: string     // 40001
    },
  ): never
  
  // ==================== 重试机制 ====================
  
  /** 事务冲突自动重试 */
  withRetry<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T>
}
```

---

## 使用示例

### 方式 1：一行代码（使用默认消息）

```typescript
async create(dto: CreateDto) {
  try {
    return await this.db.insert(this.table).values(dto).returning()
  } catch (error) {
    this.drizzle.handleError(error)
  }
}
// 返回: { code: 409, message: '数据已存在' }
```

### 方式 2：自定义消息

```typescript
async create(dto: CreateDto) {
  try {
    return await this.db.insert(this.table).values(dto).returning()
  } catch (error) {
    this.drizzle.handleError(error, {
      duplicate: '字典编码已存在',
    })
  }
}
```

### 方式 3：条件判断

```typescript
async create(dto: CreateDto) {
  try {
    return await this.db.insert(this.table).values(dto).returning()
  } catch (error) {
    if (this.drizzle.isUniqueViolation(error)) {
      throw new BadRequestException('数据重复')
    }
    throw error
  }
}
```

### 方式 4：事务重试

```typescript
async batchInsert(items: Item[]) {
  return this.drizzle.withRetry(async () => {
    return this.db.insert(this.table).values(items).returning()
  })
}
```

---

## 实现文件

| 文件 | 说明 |
|------|------|
| `db/constants/postgres-error.ts` | PostgreSQL 错误码常量 |
| `db/drizzle.service.ts` | 扩展错误处理方法 |
| `libs/platform/src/filters/http-exception.filter.ts` | 增加 PostgreSQL 错误码映射 |

---

## 确认

- ✅ 无需约束映射表
- ✅ 基于错误码的默认消息
- ✅ 支持自定义消息覆盖
- ✅ 一行代码完成常见处理

是否可以开始实现？
