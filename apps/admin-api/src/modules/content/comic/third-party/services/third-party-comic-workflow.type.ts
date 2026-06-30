/** 三方内容导入/同步 workflow 刷新任务进度时使用的内部进度状态。 */
export type ContentImportTaskProgressState =
  'cancelled' | 'prepare-failed' | 'updated'
