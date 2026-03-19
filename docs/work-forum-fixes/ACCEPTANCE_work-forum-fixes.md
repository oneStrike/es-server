# Work Forum Fixes Acceptance

## 验收结果

- [x] 作品发布状态更新时同步 forum section 启停
- [x] 删除 forum topic 时仅软删 `targetType=FORUM_TOPIC` 的评论
- [x] app 侧未发布作品详情/作品论坛入口不可见
- [x] app 侧 forum topic 的点赞/收藏/评论/浏览/举报统一收口到公开可见主题
- [x] forum topic 更新 DTO 仅允许修改标题与内容
- [x] forum reply 的 topic/section/profile 计数与最近活跃字段形成闭环
- [x] app 侧补齐 forum topic page/detail/create/update/delete 接口
- [x] work/forum/like/favorite/admin forum detail 的 DTO/Swagger 与真实返回结构对齐
- [x] `getWorkPage` 支持 DTO 暴露的筛选条件，并优化作者/标签过滤查询方式

## 实际验证

- 已执行：
  - `pnpm exec tsc -p apps\app-api\tsconfig.app.json --noEmit`
  - `pnpm exec tsc -p apps\admin-api\tsconfig.app.json --noEmit`
- 未执行：
  - 单元测试/集成测试代码新增与运行

## 说明

- 根据当前任务约束，项目处于开发阶段，允许必要重构。
- 根据用户要求，本次未补测试相关代码，仅做最小编译验证。
