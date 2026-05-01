import Link from 'next/link'

export default function NotFound() {
    return (
        <main className="page-shell content-page">
            <p className="eyebrow">404</p>
            <h1>Page not found</h1>
            <p className="lead">This Dora page does not exist.</p>
            <div className="actions">
                <Link className="button" href="/">
                    Go home
                </Link>
            </div>
        </main>
    )
}
