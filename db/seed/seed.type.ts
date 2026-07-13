import type { RegisteredDisposableDatabaseTarget } from '../targets/registered-disposable-target'

/** Demo seed 的显式运行边界；只能接收登记且可销毁的 target。 */
export interface DemoSeedRunOptions {
  environment: NodeJS.ProcessEnv
  target: RegisteredDisposableDatabaseTarget
}
