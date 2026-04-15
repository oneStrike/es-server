# Test Spec: forum-home-feed-tabs

## Scope

覆盖 app 侧论坛 feed 接口新增/调整所影响的 DTO、controller、service 行为。

## Cases

1. 综合 feed 在未传 `sectionId` 时：
   - 读取当前用户可访问板块范围
   - 返回跨板块主题
   - 登录用户可拿到点赞/收藏状态

2. 综合 feed 在传入 `sectionId` 时：
   - 保持现有单板块权限校验路径

3. 热门 feed：
   - 使用热门排序回退规则
   - 结果仍为公开主题列表模型

4. 关注 feed：
   - 读取当前用户关注的用户与板块
   - 合并两类来源主题
   - 对重复主题去重
   - 若没有任何关注目标，直接返回空分页

5. DTO 契约：
   - `sectionId` 在公开 feed 查询中为可选

## Verification Commands

- `pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/forum-topic.service.spec.ts`
- `pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/dto/forum-topic.dto.spec.ts`
- `pnpm type-check`
