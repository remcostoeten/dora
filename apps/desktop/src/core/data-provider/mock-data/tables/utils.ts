export function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDate(daysAgo: number): string {
    const date = new Date(Date.now() - Math.random() * daysAgo * 86400000);
    return date.toISOString();
}

export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomBool(): boolean {
    return Math.random() > 0.5;
}

export function randomFloat(min: number, max: number, decimals: number = 2): number {
    const val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals));
}

export function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}
