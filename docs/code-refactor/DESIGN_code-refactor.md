# 代码重构设计文档

## 整体架构图

```mermaid
classDiagram
    class CounterService {
        +getModel(client, targetType)
        +getWhere(targetType, targetId)
        +ensureTargetExists(targetType, targetId)
        +isDuplicateError(error)
        +applyCountDelta(tx, targetType, targetId, field, delta)
        +incrementCount(tx, targetType, targetId, field, amount)
        +decrementCount(tx, targetType, targetId, field, amount)
        +getCount(targetType, targetId, field)
        +getCounts(targetType, targetIds, field)
        +setCount(targetType, targetId, field, value)
        -getModelInfo(targetType, targetId)
    }

    class LikeService {
        -counterService: CounterService
        +like(targetType, targetId, userId)
        +unlike(targetType, targetId, userId)
        +checkLikeStatus(targetType, targetId, userId)
        +checkStatusBatch(targetType, targetIds, userId)
        +getTargetLikes(targetType, targetId, pageIndex, pageSize)
        +getLikeCount(targetType, targetId)
        +getLikeCounts(targetType, targetIds)
        +getUserLikes(userId, targetType, pageIndex, pageSize)
    }

    class ViewService {
        -counterService: CounterService
        +recordView(targetType, targetId, userId, ipAddress, device, userAgent)
        +getUserViews(userId, targetType, pageIndex, pageSize)
        +deleteView(viewId, userId)
        +deleteViews(viewIds, userId)
        +clearUserViews(userId, targetType)
    }

    class FavoriteService {
        -counterService: CounterService
        +favorite(targetType, targetId, userId)
        +unfavorite(targetType, targetId, userId)
        +checkFavoriteStatus(targetType, targetId, userId)
        +checkStatusBatch(targetType, targetIds, userId)
        +getUserFavorites(userId, targetType, pageIndex, pageSize)
    }

    class CommentCountService {
        -counterService: CounterService
        +isVisible(comment)
        +applyCommentCountDelta(tx, targetType, targetId, delta)
        +setCommentCount(targetType, targetId, count)
        +syncVisibleCountByTransition(tx, targetType, targetId, beforeVisible, afterVisible)
    }

    LikeService --> CounterService : uses
    ViewService --> CounterService : uses
    FavoriteService --> CounterService : uses
    CommentCountService --> CounterService : uses
```

## 分层设计

### 1. 基础层 - CounterService (增强)

位置: `libs/interaction/src/counter/counter.service.ts`

职责:
- 目标类型到 Prisma 模型的映射
- 目标存在性验证
- 通用计数更新
- 错误检测辅助

### 2. 业务层 - 各交互服务

位置: `libs/interaction/src/*/*.service.ts`

职责:
- 调用 CounterService 完成基础操作
- 实现业务特定逻辑
- 保持 API 接口不变

## 接口契约定义

### CounterService 新增接口

```typescript
interface ICounterService {
  /**
   * 根据目标类型获取 Prisma 模型
   * @param client - Prisma 客户端或事务对象
   * @param targetType - 目标类型枚举
   * @returns Prisma 模型对象
   */
  getModel(client: any, targetType: InteractionTargetTypeEnum): any

  /**
   * 根据目标类型获取查询条件
   * @param targetType - 目标类型枚举
   * @param targetId - 目标ID
   * @returns Prisma where 条件对象
   */
  getWhere(targetType: InteractionTargetTypeEnum, targetId: number): any

  /**
   * 确保目标存在，不存在则抛出 NotFoundException
   * @param targetType - 目标类型枚举
   * @param targetId - 目标ID
   * @throws NotFoundException 目标不存在时
   */
  ensureTargetExists(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<void>

  /**
   * 检测是否为 Prisma 重复键错误
   * @param error - 错误对象
   * @returns 是否为重复错误
   */
  isDuplicateError(error: unknown): boolean

  /**
   * 应用计数变化（支持增减）
   * @param tx - Prisma 事务对象
   * @param targetType - 目标类型枚举
   * @param targetId - 目标ID
   * @param field - 计数字段名
   * @param delta - 变化量（正数增加，负数减少）
   */
  applyCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ): Promise<void>
}
```

## 数据流向图

```mermaid
sequenceDiagram
    participant Client
    participant LikeService
    participant CounterService
    participant Prisma

    Client->>LikeService: like(targetType, targetId, userId)
    LikeService->>CounterService: ensureTargetExists(targetType, targetId)
    CounterService->>Prisma: findFirst(where)
    Prisma-->>CounterService: target
    CounterService-->>LikeService: void (或抛出异常)
    
    LikeService->>Prisma: $transaction()
    Prisma-->>LikeService: tx
    
    LikeService->>Prisma: userLike.create()
    Prisma-->>LikeService: like record
    
    LikeService->>CounterService: applyCountDelta(tx, targetType, targetId, "likeCount", 1)
    CounterService->>Prisma: model.update()
    Prisma-->>CounterService: updated
    CounterService-->>LikeService: void
    
    LikeService-->>Client: void
```

## 异常处理策略

1. **目标不存在**: `CounterService.ensureTargetExists()` 统一抛出 `NotFoundException`
2. **重复操作**: `CounterService.isDuplicateError()` 统一检测，业务层决定错误消息
3. **其他错误**: 保持原有处理逻辑

## 与现有系统的关系

```mermaid
graph LR
    subgraph "现有系统"
        A[LikeService]
        B[ViewService]
        C[FavoriteService]
        D[CommentCountService]
    end

    subgraph "重构后"
        E[CounterService<br/>增强版]
    end

    A -.->|原: 重复代码| A
    B -.->|原: 重复代码| B
    C -.->|原: 重复代码| C
    D -.->|原: 重复代码| D

    A -->|新: 依赖| E
    B -->|新: 依赖| E
    C -->|新: 依赖| E
    D -->|新: 依赖| E
```
