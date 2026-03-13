# Drizzle 错误捕获方案 - 替代设计（不参考 PlatformService）

## 设计理念

### PostgreSQL 原生错误结构

Drizzle 通过 `node-postgres` 抛出的错误对象：

```typescript
interface PostgresError extends Error {
  code: string           // PostgreSQL 错误码，如 '23505'
  constraint?: string    // 约束名称，如 'user_email_unique'
  table?: string         // 表名
  column?: string        // 列名
  detail?: string        // 详细信息
  hint?: string          // 修复建议
  schema?: string        // Schema 名
}
```

### 设计原则

1. **数据驱动**: 从错误对象中提取约束名，自动匹配友好消息
2. **零配置默认**: 提供合理的默认消息，无需每次手动指定
3. **渐进增强**: 支持自定义消息覆盖默认值
4. **类型安全**: 完整的 TypeScript 类型支持

---

## 方案设计

### 核心思路：约束消息映射表

不依赖错误码硬编码，而是通过**约束名称**自动匹配预定义的友好消息：

```typescript
// 错误示例
// code: '23505'
// constraint: 'dictionary_code_key'

// 自动匹配预设消息 -> '字典编码已存在'
```

### API 设计

```typescript
// db/drizzle.service.ts
@Injectable()
export class DrizzleService {
  // ==================== 错误检测 ====================
  
  /** 从错误中提取 PostgreSQL 错误信息 */
  extractError(error: unknown): PostgresErrorInfo | null
  
  /** 判断是否为数据库约束错误 */
  isConstraintError(error: unknown): boolean

  // ==================== 错误处理 ====================
  
  /**
   * 解析错误并返回友好消息
   * - 自动从 constraintMessageMap 中匹配
   * - 支持传入自定义消息覆盖
   */
  parseError(
    error: unknown,
    customMessages?: Record<string, string>,
  ): ParsedError | null

  /**
   * 解析错误并抛出业务异常
   * 一行代码完成错误处理
   */
  throwParsedError(
    error: unknown,
    customMessages?: Record<string, string>,
  ): never

  // ==================== 重试机制 ====================
  
  /** 事务冲突自动重试 */
  withRetry<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T>
}
```

### 约束消息映射表

```typescript
// db/constraint-messages.ts

/**
 * 数据库约束名称 -> 友好消息映射表
 * 
 * 命名规则：
 * - 表名_字段名_key -> 唯一约束
 * - 表名_字段名_fkey -> 外键约束
 */
export const constraintMessages: Record<string, string> = {
  // ========== 字典模块 ==========
  'dictionary_code_key': '字典编码已存在',
  'dictionary_name_key': '字典名称已存在',
  'dictionary_item_code_key': '字典项编码已存在',
  
  // ========== 用户模块 ==========
  'app_user_email_key': '邮箱已被注册',
  'app_user_phone_key': '手机号已被注册',
  'app_user_username_key': '用户名已存在',
  
  // ========== 敏感词模块 ==========
  'sensitive_word_word_key': '敏感词已存在',
  
  // ========== 作品模块 ==========
  'work_author_relation_work_id_author_id_key': '该作者已关联此作品',
  
  // ========== 用户互动 ==========
  'user_favorite_target_type_target_id_user_id_key': '已收藏该内容',
  
  // ... 更多约束
}

/**
 * 默认错误消息（按错误码）
 */
export const defaultMessages: Record<string, string> = {
  '23505': '数据已存在',
  '23503': '关联数据不存在',
  '23502': '必填字段不能为空',
  '23514': '数据不符合约束条件',
  '40001': '操作冲突，请稍后重试',
}
```

### 类型定义

```typescript
// db/types.ts

/** PostgreSQL 错误信息 */
export interface PostgresErrorInfo {
  code: string
  constraint?: string
  table?: string
  column?: string
  detail?: string
  hint?: string
  message: string
}

/** 解析后的错误 */
export interface ParsedError {
  /** PostgreSQL 错误码 */
  code: string
  /** 约束名称 */
  constraint?: string
  /** 友好消息 */
  message: string
  /** HTTP 状态码 */
  status: number
  /** 原始错误 */
  raw: unknown
}
```

---

## 使用方式对比

### 方式 1：一行代码（推荐）

```typescript
async create(dto: CreateDto) {
  try {
    return await this.db.insert(this.table).values(dto).returning()
  } catch (error) {
    this.drizzle.throwParsedError(error)
  }
}
// 自动匹配约束消息，未匹配则使用默认消息
```

### 方式 2：自定义消息覆盖

```typescript
async create(dto: CreateDto) {
  try {
    return await this.db.insert(this.table).values(dto).returning()
  } catch (error) {
    this.drizzle.throwParsedError(error, {
      'dictionary_code_key': '此编码已被使用，请更换',
    })
  }
}
```

### 方式 3：获取解析结果后自定义处理

```typescript
async create(dto: CreateDto) {
  try {
    return await this.db.insert(this.table).values(dto).returning()
  } catch (error) {
    const parsed = this.drizzle.parseError(error)
    
    if (parsed?.code === '23505') {
      // 特殊处理唯一约束冲突
      this.logger.warn(`重复创建: ${parsed.constraint}`)
      throw new ConflictException(parsed.message)
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
  }, 3)
}
```

---

## 与 PlatformService 方案对比

| 维度 | PlatformService 模式 | 约束映射模式 |
|------|---------------------|-------------|
| **消息配置** | 每次调用时传入 | 集中配置，自动匹配 |
| **代码量** | 较多（需每次指定消息） | 较少（一行代码） |
| **灵活性** | 高（每次可不同消息） | 中（可覆盖） |
| **维护性** | 分散在各服务 | 集中在映射表 |
| **新增约束** | 无需改动 | 需添加映射 |
| **约束名可读性** | 不依赖 | 依赖约束命名规范 |

---

## 推荐选择

**建议采用混合方案**：

1. 保留约束映射表实现自动匹配
2. 同时提供 `handleBusinessError` 方法兼容 PlatformService 模式
3. 让开发者根据场景选择

```typescript
// 简单场景：自动匹配
this.drizzle.throwParsedError(error)

// 复杂场景：精确控制
this.drizzle.handleBusinessError(error, {
  duplicateMessage: '字典编码已存在',
})
```

---

## 你更倾向哪种方式？

1. **约束映射模式**：集中配置，一行代码处理
2. **PlatformService 模式**：每次调用时传入消息
3. **混合模式**：两种都支持，按需选择
