# TODO List

## 建议后续优化项

1. **Token 清理任务**
   - [x] 实现定时任务（Cron），定期删除 `admin_user_token` 表中 `expires_at < NOW()` 的记录。
   - [x] 建议保留 `revoked_at` 不为空的记录一段时间用于审计，之后再删除。

2. **性能优化**
   - [ ] 考虑在 `AdminTokenStorageService` 中增加 Redis 缓存层，减少高并发下的数据库查询（虽然 `AuthStrategy` 已有 Blacklist 机制，但 Token 有效性检查目前直连 DB）。

3. **监控与审计**
   - [ ] 可以在 Token 撤销或异常登录时增加审计日志（目前已有 Login/Logout 审计）。
