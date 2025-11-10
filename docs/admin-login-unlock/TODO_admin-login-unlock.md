# TODO（待办与配置缺失）

## 待办事项

- 是否在锁定期内的登录尝试继续累加失败计数：若需改为“不累加”，请确认策略（将仅记录日志，不递增计数）。
- 增加管理员接口返回锁定剩余时间（用于前端展示）：可选增强项。
- 为客户端登录模块复用同策略（若有需要）。

## 环境变量配置指引

- `ADMIN_LOGIN_LOCK_COUNT`：失败次数阈值（默认 5）。
- `ADMIN_LOGIN_LOCK_DURATION_MIN`：锁定时长（分钟，默认 30）。

示例（.env.development）：

```
ADMIN_LOGIN_LOCK_COUNT=5
ADMIN_LOGIN_LOCK_DURATION_MIN=30
```
