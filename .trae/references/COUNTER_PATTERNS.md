# 项目计数器实现参考

本文件是计数器实现参考资料，不是规范来源；硬约束以 `../rules/COUNTER_SPEC.md` 为准。

本文件提供计数器的推荐实现模式、迁移方式和最小模板。

## 1. 分层模型

| 层 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `db/extensions` helper | 原子增减、`returning` 校验、事务兼容、通用技术能力 | 业务口径、字段归属、联动规则 |
| 领域 `CounterService` | 某组计数字段的唯一写入口、口径定义、repair / rebuild | 接收 HTTP 入参、鉴权、复杂应用编排 |
| 业务 service | 事实表写入、事务编排、调用多个 owner service | 底层通用 delta 技术细节 |
| Controller / Resolver | 入参、上下文、委托 | 直接写计数字段、临时拼 SQL |

判断标准：

- 纯技术复用，放 helper。
- 某组字段的唯一 owner，放领域 `CounterService`。
- 业务动作触发的事务流程，放业务 service。

## 2. 模式 A：事实表 + 对象冗余计数 + 用户聚合计数

适用场景：点赞、收藏、关注等标准交互动作。

推荐流程：

1. 在事务中写入事实表。
2. 调用对象 owner service 更新目标对象计数。
3. 若口径已定义，再调用用户聚合 owner service 更新用户计数。
4. 取消动作保持完全对称。

示意：

```ts
await this.db.transaction(async (tx) => {
  await tx.insert(this.userLike).values({ userId, targetType, targetId })
  await this.workCounterService.updateWorkLikeCount(tx, targetId, 1)
  await this.appUserCountService.updateLikeCount(tx, userId, 1)
})
```

适合该模式的字段：

- `likeCount`
- `favoriteCount`
- `followersCount`
- `followingCount`
- `commentReceivedLikeCount`

## 3. 模式 B：可见态驱动的同步重算

适用场景：计数口径依赖审核态、隐藏态、软删、最后回复人、最后回复时间等复合状态。

推荐做法：

1. 先写事实表或状态表。
2. 在同一事务里调用同步方法，按事实表重算受影响对象。
3. 一次性落库多个相关字段，而不是盲目 `+/-1`。

这种模式优先于简单 delta 的情况：

- `replyCount` 还要联动 `commentCount`
- 板块 `topicCount` / `replyCount` 受主题可见态影响
- 最后回复人、最后回复时间需要一起更新

## 4. 模式 C：浏览计数

适用场景：`viewCount`、阅读记录、浏览行为。

推荐流程：

1. 详情链路收集请求元信息。
2. 统一走 `BrowseLogService.recordBrowseLog(...)`。
3. 由 browse target resolver 或对应 owner service 更新目标 `viewCount`。

注意：

- 当前仓库的 browse 语义更接近“已接入链路上的用户浏览行为”，不是天然全量 PV。
- 若要做匿名 PV，需要新增独立事实设计，不应直接复用当前登录用户 browse log 语义。
- 不推荐继续新增裸 `increment-view-count` 风格入口。

## 5. 模式 D：状态缓存计数

适用场景：未读数、会话状态、局部同步计数。

推荐做法：

- 可以由本域 service 直接维护，不强制拆成通用 `CounterService`。
- 允许在关键动作里按上下文重算。
- 仍需满足：
  - 事务内更新
  - 原子增减或原子重算
  - 已读位置、防回退等领域约束

代表场景：

- `chat_conversation_member.unreadCount`

## 6. 模式 E：repair / rebuild

每个核心冗余计数，至少落这两层能力：

1. 单条 rebuild：`rebuildXxxCount(id)`
2. 批量 repair：脚本或管理端批次重建

推荐流程：

1. 基于事实表重新聚合。
2. 直接覆盖目标字段，而不是在旧值基础上增减修补。
3. 输出批次大小、扫描范围和处理日志。

示意：

```ts
async rebuildSectionFollowersCount(tx: Db | undefined, sectionId: number) {
  const followersCount = await this.countFollowersFromFactTable(tx, sectionId)
  await this.persistFollowersCount(tx, sectionId, followersCount)
  return { sectionId, followersCount }
}
```

## 7. 历史路径迁移方式

适用场景：当前 resolver 里已经有手写 `sql\`${count} + ${delta}\``。

建议迁移顺序：

1. 保留 resolver 接口不变。
2. 新增或补齐领域 `CounterService`。
3. 把 resolver 里的 SQL 挪到 owner service。
4. resolver 只保留目标校验和委托。
5. 再补单条 rebuild 和批量 repair。

这样可以在不破坏外部交互接口的前提下，逐步收口写路径。

## 8. 不推荐的模式

- 只有 helper、没有 owner service，导致所有模块都直接调用底层技术方法。
- 所有领域共用一个超级 `CounterService`，把用户、论坛、内容、消息耦合在一起。
- 在 Controller 里直接写 `count + 1`。
- 浏览量一部分走 browse log，一部分走裸更新，且没有口径说明。
- 修复脚本根据另一份冗余计数继续修冗余计数。
- 先把 DTO 字段暴露出去，后面再补写链路。

## 9. 新增计数器时的最小检查

1. 这个字段是不是必须落库，还是运行时聚合就够。
2. 它属于哪个 owner service。
3. 它的事实来源是什么。
4. 它是否需要联动用户聚合计数。
5. 它能否基于事实表 rebuild。
6. 它是否需要数据库级非负保护或索引。
