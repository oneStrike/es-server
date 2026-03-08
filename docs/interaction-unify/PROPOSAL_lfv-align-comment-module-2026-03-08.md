# 点赞/收藏/浏览模块治理方案（参考评论模式）

## 1. 范围边界

本次仅改造 LFV（Like/Favorite/View）模块，参考评论模块的治理方式，不与评论模块做业务耦合。

- 不改评论主表：`user_comment`
- 评论点赞数据统一到：`user_like`（通过 `targetType=COMMENT` 区分）
- `InteractionEventEmitter` 已废弃，不引入事件总线
- 采用“服务内直调”处理副作用
- app-api 通过 3 个独立 controller 对外开放（like/favorite/view）
- 浏览模块不启用去重窗口

## 2. 设计原则

- Permission 层：用户状态、配额、目标合法性
- Core 层：事务写入与计数
- Interaction 层：通知 / outbox / 行为编排
- Growth 层：积分经验奖励与等级刷新
- 幂等错误语义：重复操作、未操作、目标不存在

## 3. 当前结论

- 点赞数据统一方案已确认执行：`user_comment_like` 合并到 `user_like`
- 新增点赞目标类型：`InteractionTargetTypeEnum.COMMENT = 6`
- 迁移脚本由你手动执行；本轮不包含迁移脚本创建与执行

## 4. 实施阶段

1. 分层重构（已完成）
2. app-api 三个独立 controller 对外（已完成）
3. 清理旧 interaction handler 代码与注释（已完成）
4. 点赞数据统一（进行中，本次交付代码切换，不含迁移执行）

## 5. 验收标准

- LFV 三模块具备 Permission/Core/Interaction/Growth 分层
- 点赞/收藏/浏览行为与计数不回归
- 日限额规则生效
- 评论/回复点赞已走 `user_like` 统一路径