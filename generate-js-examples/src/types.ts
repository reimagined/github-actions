export type Logger = {
  debug: (msg: string) => void
  error: (msg: string) => void
  warn: (msg: string) => void
}

export type PathResolver = (file: string) => string
