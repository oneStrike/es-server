# Schema / Relations 前端破坏性更新索引

本轮改造按“破坏性更新”执行，不提供任何兼容层，不接受旧字符串枚举，也不保留双读双写。

请分别查看：

- [Admin 前端破坏性更新清单](/D:/code/es/es-server/docs/reviews/2026-04-14-schema-relations-admin-breaking.md)
- [App 前端破坏性更新清单](/D:/code/es/es-server/docs/reviews/2026-04-14-schema-relations-app-breaking.md)

共同前提如下：

- 闭集状态 / 类型 / 模式字段统一改为数字码，对外接口直接返回数字，不再返回旧字符串。
- `eventKey`、`categoryKey`、`projectionKey`、`domain`、`packageMimeType`、弹窗位置等开放业务键继续保持字符串。
- 前端需要和后端一起按新枚举表更新筛选项、表单值、状态标签、轮询状态机和本地缓存。
