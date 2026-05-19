-- 破坏性数据清理：清空内容导入 workflow runtime 和三方来源绑定历史。
-- 用于解除历史过期/归档任务、导入记录和 active 三方绑定对重新解析提交的阻塞。
-- 不删除作品、章节、图片文件、系统三方解析配置或其他业务数据。

TRUNCATE TABLE
  "content_import_residue",
  "content_import_item_attempt",
  "content_import_item",
  "content_import_preview_item",
  "content_import_job",
  "workflow_conflict_key",
  "workflow_event",
  "workflow_attempt",
  "workflow_job",
  "work_third_party_chapter_binding",
  "work_third_party_source_binding"
RESTART IDENTITY;
