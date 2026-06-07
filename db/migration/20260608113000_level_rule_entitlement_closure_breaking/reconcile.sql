SELECT
  COALESCE(business, '') AS business_key,
  count(*) AS enabled_level_count,
  count(*) FILTER (WHERE required_experience = 0) AS enabled_base_level_count
FROM user_level_rule
WHERE is_enabled = true
GROUP BY COALESCE(business, '')
HAVING count(*) FILTER (WHERE required_experience = 0) <> 1
ORDER BY business_key;

SELECT
  COALESCE(business, '') AS business_key,
  required_experience,
  count(*) AS duplicate_count
FROM user_level_rule
WHERE is_enabled = true
GROUP BY COALESCE(business, ''), required_experience
HAVING count(*) > 1
ORDER BY business_key, required_experience;

SELECT id, name, business, required_experience, is_enabled
FROM user_level_rule
ORDER BY COALESCE(business, ''), required_experience, id;
