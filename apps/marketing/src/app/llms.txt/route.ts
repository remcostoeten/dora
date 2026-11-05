import { docsLlms } from '@/modules/docs/server/llms'

export function GET() {
    return new Response(docsLlms.index(), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
    })
}
