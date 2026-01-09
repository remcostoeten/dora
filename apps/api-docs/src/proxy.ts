import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
    const pathname = req.nextUrl.pathname

    if (pathname === '/') {
        const url = req.nextUrl.clone()
        url.pathname = '/docs'
        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}
