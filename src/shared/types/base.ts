export type UUID = string
export type ID = string
export type Timestamp = string

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type Timestamps = {
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type Entity = {
  id: ID
} & Timestamps

export type Driver = string
export type Postgres = Driver
export type Sqlite = Driver
export type Cockroach = Driver
