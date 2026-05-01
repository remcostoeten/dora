export default function AppView() {
    return (
        <main className="page-shell app-preview">
            <p className="eyebrow">Mock app</p>
            <h1>Dora app preview</h1>
            <p className="lead">
                A non-indexed product preview route for shaping the real
                application surface.
            </p>
            <section aria-label="Mock database explorer" className="mock-frame">
                <div className="mock-toolbar" aria-hidden="true">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                </div>
                <div className="mock-body">
                    <aside className="mock-sidebar">
                        connections / local / production
                    </aside>
                    <div className="mock-main">
                        <table className="mock-table">
                            <thead>
                                <tr>
                                    <th>table</th>
                                    <th>rows</th>
                                    <th>status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>users</td>
                                    <td>24,812</td>
                                    <td>ready</td>
                                </tr>
                                <tr>
                                    <td>projects</td>
                                    <td>1,204</td>
                                    <td>ready</td>
                                </tr>
                                <tr>
                                    <td>events</td>
                                    <td>985,430</td>
                                    <td>indexed</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </main>
    )
}
