export default function DownloadsView() {
    return (
        <main className="content-page">
            <p className="eyebrow">Downloads</p>
            <h1>Download Dora</h1>
            <p className="lead">
                Download links belong here once release artifacts are published.
            </p>
            <section aria-label="Download targets" className="section-grid">
                <article className="tile">
                    <h2>macOS</h2>
                    <p>
                        Installer placeholder for Apple Silicon and Intel
                        builds.
                    </p>
                </article>
                <article className="tile">
                    <h2>Windows</h2>
                    <p>Installer placeholder for Windows desktop releases.</p>
                </article>
                <article className="tile">
                    <h2>Linux</h2>
                    <p>Installer placeholder for Linux desktop packages.</p>
                </article>
            </section>
        </main>
    )
}
