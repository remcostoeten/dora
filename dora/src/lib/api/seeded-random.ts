// Seeded pseudo-random number generator for deterministic data
export class SeededRandom {
  private seed: number

  constructor(seed: string | number) {
    this.seed = typeof seed === "string" ? this.hashString(seed) : seed
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  // Linear congruential generator
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296
    return this.seed / 4294967296
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  nextBoolean(probability = 0.5): boolean {
    return this.next() < probability
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)]
  }

  date(start: Date, end: Date): Date {
    const startTime = start.getTime()
    const endTime = end.getTime()
    const randomTime = startTime + this.next() * (endTime - startTime)
    return new Date(randomTime)
  }
}
