import { createProxy } from '@spoar/sdk/proxy'

export const POST = createProxy({
    secret: process.env.RA_SECRET,
    endpoint: 'https://api.analytics.remcostoeten.nl'
})
