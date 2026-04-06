# User Module Result Checklist

生成时间：2026-04-06

## 处理范围

- `libs/user/src/dto/*`
- `libs/user/src/user.service.ts`
- `libs/user/src/app-user-count.service.ts`
- `libs/user/src/app-user-count.type.ts`
- `libs/user/src/app-user.constant.ts`
- `libs/user/src/index.ts`
- `libs/user/src/test/*`
- `apps/admin-api/src/modules/app-user/app-user.service.ts`
- `apps/admin-api/src/modules/app-user/app-user.controller.ts`
- DTO 复用入口相关依赖文件（改为 `@libs/user/core`）

## 已完成项

- 为 `BaseAppUserDto.deletedAt` 增加 `contract: false`，避免进入 Swagger / 请求契约。
- 调整 `UserService.mapBaseUser()`，运行时不再返回 `deletedAt`。
- 移除 app/admin 用户成长记录 DTO 中对 `bizKey` 的暴露。
- 将多处长列表 `PickType` 改为更符合规则的 `OmitType`。
- `QueryMyPointRecordDto` / `QueryMyExperienceRecordDto` 改为复用 growth 域现有 Query DTO，再裁掉 `userId`。
- `UserAssetsSummaryDto` 改为直接复用 `BaseUserAssetsSummaryDto`，去掉无实际裁剪的 helper 包装。
- 调整 `libs/user/src/index.ts` 导出顺序，降低循环依赖触发概率。
- 新增 `@libs/user/core` 入口，供其他 lib 只复用用户基础 DTO，避免 DTO 侧直接依赖完整 root barrel。
- 为 `libs/user` 补充 DTO contract 测试和 `mapBaseUser` 单测。
- 按 `COMMENT_SPEC.md` 补充 `UserService`、`AppUserCountService` 关键方法注释。
- 将 `app-user-count.service.ts` 内部聚合类型迁移到 `app-user-count.type.ts`，避免在 service 文件内定义业务类型。
- 将 `admin-app-user.dto.ts` 内联枚举与正则常量迁移到 `app-user.constant.ts`。
- 将后台用户删除态筛选改为数字枚举（`0=未删除`、`1=已删除`、`2=全部`），不再使用单词值。
- 删除 `user` 模块中对 growth DTO 的纯中转别名导出，改为 `admin-api` 直接依赖 growth 模块原始 DTO。

## 新增/更新文件

- `libs/user/src/test/user.dto-contract.spec.ts`
- `libs/user/src/test/user.service.spec.ts`
- `libs/user/src/core/index.ts`
- `libs/user/src/dto/base-app-user.dto.ts`
- `libs/user/src/dto/admin-app-user.dto.ts`
- `libs/user/src/dto/user-self.dto.ts`
- `libs/user/src/user.service.ts`
- `libs/user/src/app-user-count.service.ts`
- `libs/user/src/app-user-count.type.ts`
- `libs/user/src/app-user.constant.ts`
- `libs/user/src/index.ts`
- `apps/admin-api/src/modules/app-user/app-user.service.ts`
- `apps/admin-api/src/modules/app-user/app-user.controller.ts`

## 验证结果

- `pnpm test -- --runInBand libs/user/src/test/user.dto-contract.spec.ts libs/user/src/test/user.service.spec.ts`
  - 结果：通过（2 个 test suites，5 个 tests）
- `pnpm exec eslint --fix ...`
  - 结果：通过
- `pnpm type-check`
  - 结果：通过

## 本次保留的取舍

- `AdminAppUserLevelDto` / `UserLevelSummaryDto` 以及 `AdminAppUserCountDto` / `UserCountDto` 仍保留各自具名类，没有进一步抽成单一共享 fragment。
- 原因：本轮优先修复 contract 泄露、mapped type 违规和循环依赖触发点；若继续强行抽公共类，会连带改动 Swagger schema 命名，影响面更大。

## 备注

- 工作区存在其他未由本次任务引入的改动；本清单只覆盖本次围绕 `user` 模块的处理结果。
