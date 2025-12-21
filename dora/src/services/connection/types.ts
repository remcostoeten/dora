export type ConnType = "postgres" | "sqlite" | "libsql"

export type ConnConfig = {
  type: ConnType
  name: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  filepath?: string
  url?: string
}

export type ConnStatus = {
  id: string
  name: string
  type: ConnType
  connected: boolean
  lastUsed?: Date
  favorite?: boolean
  color?: string
}

export type ConnService = {
  test: (config: ConnConfig) => Promise<boolean>
  connect: (config: ConnConfig) => Promise<string>
  disconnect: (id: string) => Promise<void>
  list: () => Promise<ConnStatus[]>
  remove: (id: string) => Promise<void>
  setActive: (id: string) => void
  getActive: () => string | null
}
