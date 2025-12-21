import type { BaseEntity, TabType } from "./base"

export type Tab = BaseEntity & {
  name: string
  type: TabType
}
