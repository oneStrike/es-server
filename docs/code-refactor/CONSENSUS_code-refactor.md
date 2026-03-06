# 代码重构共识文档

## 明确需求描述

将交互模块（interaction）中多处重复的代码提取为可复用的共享服务，消除以下重复模式：
1. 目标类型到 Prisma 模型的映射逻辑
2. 目标存在性验证逻辑
3. 重复错误检测逻辑
4. 计数更新逻辑

## 验收标准

- [ ] 所有重复的目标类型映射逻辑集中到单一服务
- [ ] `LikeService`, `ViewService`, `FavoriteService`, `CommentCountService` 使用新的共享服务
- [ ] 现有 API 接口行为保持不变
- [ ] 所有现有测试通过
- [ ] 代码行数减少 20% 以上（交互模块）

## 技术实现方案

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Interaction Module                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ LikeService  │  │ ViewService  │  │FavoriteService│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           ▼                                 │
│              ┌─────────────────────────┐                   │
│              │   TargetResolverService │                   │
│              │   (目标解析服务)         │                   │
│              ├─────────────────────────┤                   │
│              │ - getModel()            │                   │
│              │ - getWhere()            │                   │
│              │ - ensureExists()        │                   │
│              │ - applyCountDelta()     │                   │
│              └─────────────────────────┘                   │
│                           │                                 │
│                           ▼                                 │
│              ┌─────────────────────────┐                   │
│              │    CounterService       │                   │
│              │   (现有-增强)            │                   │
│              └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 方案决策

**决策1**: 复用并增强现有的 `CounterService`，而非创建新服务
- 理由：`CounterService` 已包含 `getModelInfo` 方法，只需扩展
- 优点：减少服务数量，保持架构简洁

**决策2**: 在 `CounterService` 中添加以下方法：
- `getModel(targetType)` - 获取 Prisma 模型
- `getWhere(targetType, targetId)` - 获取查询条件
- `ensureTargetExists(targetType, targetId)` - 验证目标存在
- `isDuplicateError(error)` - 检测重复错误
- `applyCountDelta(tx, targetType, targetId, field, delta)` - 通用计数更新

**决策3**: 保持向后兼容
- 所有现有方法保留
- 逐步替换内部实现

## 技术约束

1. **Prisma 版本**: 保持当前版本
2. **NestJS 模式**: 使用依赖注入
3. **错误消息**: 保持现有用户可见错误消息不变
4. **事务处理**: 支持 Prisma 事务

## 集成方案

### 改造后的 CounterService 接口

```typescript
@Injectable()
export class CounterService extends BaseService {
  // 现有方法保持不变...
  
  // 新增/增强方法
  getModel(client: any, targetType: InteractionTargetTypeEnum): any
  getWhere(targetType: InteractionTargetTypeEnum, targetId: number): any
  ensureTargetExists(targetType: InteractionTargetTypeEnum, targetId: number): Promise<void>
  isDuplicateError(error: unknown): boolean
  applyCountDelta(tx: any, targetType: InteractionTargetTypeEnum, targetId: number, field: string, delta: number): Promise<void>
}
```

### 使用示例

```typescript
// LikeService 改造前
private getTargetCountModel(tx: any, targetType: InteractionTargetTypeEnum) {
  switch (targetType) { /* ... */ }
}

// LikeService 改造后
private getTargetCountModel(tx: any, targetType: InteractionTargetTypeEnum) {
  return this.counterService.getModel(tx, targetType)
}
```

## 任务边界限制

### 范围内
- `libs/interaction/src/` 目录下的服务优化
- `CounterService` 的增强
- 重复代码的提取和复用

### 范围外
- 不涉及数据库 schema 变更
- 不涉及 API 接口变更
- 不涉及业务逻辑变更
- 不涉及其他模块（content, forum 等）

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 功能回归 | 高 | 保持现有测试通过，逐步替换 |
| 性能下降 | 低 | 方法调用开销可忽略 |
| 代码冲突 | 中 | 与团队成员沟通，选择合适时机 |
