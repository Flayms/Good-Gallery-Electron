/** Reports idle after `delayMs` without `poke()`, and active again on the next `poke()`. */
export class IdleTimer {
  readonly #delayMs: number
  readonly #onChange: (idle: boolean) => void
  #timer: ReturnType<typeof setTimeout> | undefined
  #idle = false

  constructor(delayMs: number, onChange: (idle: boolean) => void) {
    this.#delayMs = delayMs
    this.#onChange = onChange
  }

  /** Records activity: ends idleness and starts the delay over. */
  poke(): void {
    if (this.#idle) {
      this.#idle = false
      this.#onChange(false)
    }
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      this.#idle = true
      this.#onChange(true)
    }, this.#delayMs)
  }

  stop(): void {
    clearTimeout(this.#timer)
  }
}

/** The viewer's controls step aside while the user is idle, unless they are in use or needed. */
export function controlsHidden(state: {
  idle: boolean
  hovering: boolean
  infoOpen: boolean
  videoPaused: boolean
}): boolean {
  return state.idle && !state.hovering && !state.infoOpen && !state.videoPaused
}
