# 券定义闭环破坏性迁移

本迁移把券定义收敛为四类券：`1=阅读券`、`2=折扣券`、`3=VIP 试用卡`、`4=补签卡`。旧 `4=免广告卡` 被删除，旧 `5=补签卡` 迁移为新 `4`。旧广告 `target_scope=3` 被删除，旧签到 `target_scope=4` 迁移为新 `3`。

`pnpm db:generate` 在当前非 TTY 执行环境中触发 Drizzle 交互保护而退出，因此本迁移手写 DDL 和数据修复 SQL。迁移保持破坏性语义，不提供旧值兼容层。

## 迁移前核对

```sql
select count(*) as old_no_ad_definition_count from coupon_definition where coupon_type = 4;
select count(*) as old_no_ad_instance_count from user_coupon_instance where coupon_type = 4;
select count(*) as old_no_ad_redemption_count from coupon_redemption_record where coupon_type = 4;

select count(*) as old_makeup_definition_count from coupon_definition where coupon_type = 5;
select count(*) as old_makeup_instance_count from user_coupon_instance where coupon_type = 5;
select count(*) as old_makeup_redemption_count from coupon_redemption_record where coupon_type = 5;

select count(*) as old_ad_scope_definition_count from coupon_definition where target_scope = 3;
select count(*) as old_check_in_scope_definition_count from coupon_definition where target_scope = 4;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'coupon_definition'
  and column_name in ('budget_limit', 'config_payload');
```

若 preflight 报错，需要先人工核对异常旧组合，不能绕过迁移脚本静默转换。

## 迁移后断言

迁移完成后执行同目录 `reconcile.sql`。它会证明：

- 三张券表都只剩 `coupon_type in (1,2,3,4)`。
- 券定义只剩 `target_scope in (1,2,3)`。
- 快照中不再残留旧 `couponType=5` 或旧 `targetScope=4`。
- `budget_limit` 与 `config_payload` 列已删除。
- 发放幂等索引 `user_coupon_instance_user_grant_key_unique_idx` 已存在。

## OpenAPI / Admin 后续

迁移落地后继续执行 server API 生成和 Admin `att`，并在 Admin 表单中删除免广告、JSON、预算、targetScope 等运营不应配置的字段。
