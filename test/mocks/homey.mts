// Stand-in for the `homey` module, which only exists inside the Homey runtime.
// Aliased in vitest.config.mjs. TasksApp only needs App's constructor, log and error.
class App {
  homey: unknown

  constructor(homey: unknown) {
    this.homey = homey
  }

  log(...args: unknown[]) {}

  error(...args: unknown[]) {}
}

export default { App }
