# Work Forum Fixes TODO

## 当前范围状态

- 用户指定的 4 项论坛整改已完成：
  - user level rule / section 约束已接入公开主题访问、发帖、回帖与公开搜索
  - `forum_topic.sensitiveWordHits` 已按结构化 JSON 写入，并补齐 DTO / controller 返回契约
  - forum search 已补齐 admin/app controller，统一返回 `ForumSearchResultDto`
  - forum notification / moderator application 已补齐 service、module、admin/app controller

## 后续可选跟进

- 若后续需要更高信心，可补充以下验证：
  - forum topic 发帖/回帖的等级规则与频控集成用例
  - forum search 的 admin/app 接口快照与访问边界用例
  - forum notification / moderator application 的创建、审核、已读状态用例
