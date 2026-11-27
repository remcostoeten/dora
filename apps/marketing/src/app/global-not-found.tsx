import { SiteDocument } from '@/components/site-document'
import { NotFound } from '@/views'

export {
    rootMetadata as metadata,
    rootViewport as viewport
} from '@/core/config/root-metadata'

export default function GlobalNotFound() {
    return (
        <SiteDocument>
            <NotFound />
        </SiteDocument>
    )
}
