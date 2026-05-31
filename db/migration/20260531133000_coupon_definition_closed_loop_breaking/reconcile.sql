select 'coupon_definition.invalid_coupon_type' as check_name, count(*) as issue_count
from coupon_definition
where coupon_type not in (1, 2, 3, 4)
union all
select 'coupon_definition.invalid_target_scope' as check_name, count(*) as issue_count
from coupon_definition
where target_scope not in (1, 2, 3)
union all
select 'user_coupon_instance.invalid_coupon_type' as check_name, count(*) as issue_count
from user_coupon_instance
where coupon_type not in (1, 2, 3, 4)
union all
select 'coupon_redemption_record.invalid_coupon_type' as check_name, count(*) as issue_count
from coupon_redemption_record
where coupon_type not in (1, 2, 3, 4)
union all
select 'user_coupon_instance.old_snapshot_coupon_type' as check_name, count(*) as issue_count
from user_coupon_instance
where (grant_snapshot->>'couponType') = '5'
union all
select 'user_coupon_instance.old_snapshot_target_scope' as check_name, count(*) as issue_count
from user_coupon_instance
where (grant_snapshot->>'targetScope') = '4'
union all
select 'user_coupon_instance.open_grant_snapshot' as check_name, count(*) as issue_count
from user_coupon_instance
where grant_snapshot is null
  or not (
  grant_snapshot ? 'name'
  and grant_snapshot ? 'couponType'
  and grant_snapshot ? 'targetScope'
  and grant_snapshot ? 'usageLimit'
  and grant_snapshot ? 'discountRateBps'
  and grant_snapshot ? 'discountAmount'
  and grant_snapshot ? 'benefitDays'
  and grant_snapshot ? 'benefitCount'
  and grant_snapshot ? 'validDays'
  and grant_snapshot ? 'issuedAt'
)
union all
select 'coupon_redemption_record.old_snapshot_coupon_type' as check_name, count(*) as issue_count
from coupon_redemption_record
where (redemption_snapshot->>'couponType') = '5'
union all
select 'coupon_redemption_record.old_snapshot_target_scope' as check_name, count(*) as issue_count
from coupon_redemption_record
where (redemption_snapshot->>'targetScope') = '4'
union all
select 'coupon_definition.deleted_columns_remaining' as check_name, count(*) as issue_count
from information_schema.columns
where table_schema = 'public'
  and table_name = 'coupon_definition'
  and column_name in ('budget_limit', 'config_payload')
union all
select 'user_coupon_instance.missing_grant_key_unique_idx' as check_name,
  case when exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_coupon_instance'
      and indexname = 'user_coupon_instance_user_grant_key_unique_idx'
  ) then 0 else 1 end as issue_count;
