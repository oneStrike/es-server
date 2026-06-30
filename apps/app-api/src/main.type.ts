/** Webpack HMR 注入的 module.hot 最小接口，仅供入口启动文件声明合并使用。 */
export interface HotModule {
  accept: () => void
  dispose: (callback: () => void | Promise<void>) => void
}
