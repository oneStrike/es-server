# 代码重构待办清单

## 已完成 ✅

1. ✅ CounterService 增强 - 新增通用方法
2. ✅ LikeService 重构 - 使用 CounterService
3. ✅ ViewService 重构 - 使用 CounterService
4. ✅ FavoriteService 重构 - 使用 CounterService
5. ✅ CommentCountService 重构 - 使用 CounterService

## 待办事项 (可选优化)

### 低优先级
- [ ] **添加单元测试**: 为 CounterService 的新增方法添加单元测试
  - 位置: `libs/interaction/src/counter/counter.service.spec.ts`
  - 覆盖: getModel, getWhere, ensureTargetExists, isDuplicateError, applyCountDelta

- [ ] **提取批量状态检查**: LikeService 和 FavoriteService 的 checkStatusBatch 方法逻辑相似，可考虑提取
  - 建议位置: CounterService 或新建 InteractionStatusService

### 技术债务
- [ ] **修复现有编译错误**: 
  - `libs/base/src/constant/index.ts` - InteractionTargetTypeEnum 重复导出
  - `libs/base/src/modules/upload/upload.service.ts` - FastifyRequest 类型问题

## 配置说明

### 无需额外配置
- CounterModule 已标记为 `@Global()`，自动全局可用
- 所有服务已通过依赖注入使用 CounterService

### 依赖关系
```
LikeService -> CounterService
ViewService -> CounterService
FavoriteService -> CounterService
CommentCountService -> CounterService
```

## 验证命令

```bash
# 编译检查
npx tsc --noEmit -p libs/interaction/tsconfig.lib.json

# 运行测试（如果有）
npx jest libs/interaction
```

## 注意事项

1. **API 兼容性**: 所有公共方法签名保持不变，无需修改调用方代码
2. **错误消息**: 保持原有错误消息，用户无感知
3. **数据库**: 无数据库 schema 变更

## 后续扩展建议

如需支持新的目标类型（如视频、音频等）：

1. 在 `InteractionTargetTypeEnum` 中添加新类型
2. 在 `CounterService` 的 `getModel` 和 `getWhere` 中添加对应 case
3. 完成！其他服务自动支持新类型
