# 代码重复问题对齐文档

## 项目概述

**项目名称**: es-server  
**技术栈**: NestJS + Prisma + PostgreSQL  
**架构**: 单体应用，采用 libs 共享库 + apps 多应用模式

## 发现的代码重复问题

### 1. 目标类型映射重复 (严重)

多个服务中都存在几乎相同的 `switch` 语句来映射 `InteractionTargetTypeEnum` 到 Prisma 模型和查询条件：

| 服务 | 方法 | 用途 |
|------|------|------|
| `LikeService` | `getTargetCountModel`, `getTargetCountWhere` | 点赞计数 |
| `ViewService` | `getTargetModel`, `getTargetWhere` | 浏览记录验证 |
| `FavoriteService` | `getTargetCountModel`, `getTargetCountWhere` | 收藏计数 |
| `CommentCountService` | `getTargetCountModel` | 评论计数 |
| `CounterService` | `getModelInfo` | 通用计数 |

**重复代码示例** (出现在5个文件中):
```typescript
// LikeService, ViewService, FavoriteService, CommentCountService 都有类似代码
private getTargetCountModel(tx: any, targetType: InteractionTargetTypeEnum) {
  switch (targetType) {
    case InteractionTargetTypeEnum.COMIC:
    case InteractionTargetTypeEnum.NOVEL:
      return tx.work
    case InteractionTargetTypeEnum.COMIC_CHAPTER:
    case InteractionTargetTypeEnum.NOVEL_CHAPTER:
      return tx.workChapter
    case InteractionTargetTypeEnum.FORUM_TOPIC:
      return tx.forumTopic
    default:
      throw new BadRequestException('Unsupported target type')
  }
}
```

### 2. 目标存在性验证重复

`LikeService.ensureTargetExists()` 和 `FavoriteService.ensureTargetExists()` 几乎完全相同：

```typescript
// LikeService 和 FavoriteService 都有相同逻辑
private async ensureTargetExists(targetType: InteractionTargetTypeEnum, targetId: number) {
  const where = this.getTargetCountWhere(targetType, targetId)
  const model = this.getTargetCountModel(this.prisma, targetType)
  const target = await model.findFirst({ where, select: { id: true } })
  if (!target) {
    throw new NotFoundException('Target not found')
  }
}
```

### 3. 重复错误检测逻辑

`isDuplicateLikeError` 和 `isDuplicateFavoriteError` 完全相同：

```typescript
// LikeService, FavoriteService 都有相同代码
private isDuplicateXxxError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}
```

### 4. 计数更新逻辑重复

`applyLikeCountDelta`, `applyFavoriteCountDelta`, `applyCommentCountDelta` 逻辑高度相似，都是：
- 检查 delta 是否为 0
- 根据正负值决定 increment/decrement
- 递减时检查防止负数

### 5. 批量状态检查重复

`checkStatusBatch` 方法在 `LikeService` 和 `FavoriteService` 中几乎完全相同。

## 重复代码统计

| 重复模式 | 出现次数 | 影响文件数 | 严重程度 |
|----------|----------|------------|----------|
| 目标类型映射 | 5+ | 5 | 高 |
| 目标存在性验证 | 2+ | 2 | 中 |
| 重复错误检测 | 2+ | 2 | 低 |
| 计数更新逻辑 | 3+ | 3 | 高 |
| 批量状态检查 | 2 | 2 | 中 |

## 需求理解

### 业务需求
- 支持对多种目标类型（漫画、小说、章节、论坛主题）的交互操作
- 统一的计数管理和状态查询
- 一致的错误处理和验证逻辑

### 技术约束
- 保持现有 API 接口不变（向后兼容）
- 使用 Prisma 作为 ORM
- 保持 NestJS 依赖注入模式
- 不影响现有功能

## 优化目标

1. **消除重复代码**: 将重复逻辑提取到共享服务/工具类
2. **提高可维护性**: 修改目标类型映射时只需修改一处
3. **增强可扩展性**: 新增目标类型时改动最小化
4. **保持功能一致**: 确保重构后行为完全一致

## 疑问澄清

### 已确认
- ✅ 需要保持现有 API 不变
- ✅ 可以创建新的共享服务
- ✅ 优先复用现有 `CounterService`

### 待确认
- 是否需要支持新的目标类型？（暂按不需要处理）
- 错误消息是否需要统一？（建议统一）
