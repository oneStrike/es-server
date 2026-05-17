/** 后台任务执行期的当前 worker claim 所有权快照。 */
export interface BackgroundTaskExecutionLease {
  taskId: string
  ownerWorkerId: string
  claimLost: boolean
}
