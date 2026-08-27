use std::sync::OnceLock;
use std::time::Duration;

/// How long any outbound dial (TCP/TLS) may take before failing. Shared by the
/// HTTP clients and the database connect paths so a black-holed host errors out
/// instead of hanging the invoking command forever.
pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Total per-request budget for provider API calls (list databases, exchange
/// tokens, ...). These are small JSON round-trips; 30s is generous.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Total per-request budget for query-over-HTTP engines (D1, PostHog HogQL),
/// where a single request can legitimately run a slow analytical query.
pub const QUERY_TIMEOUT: Duration = Duration::from_secs(60);

/// Shared client for provider API calls. One client means one connection pool,
/// so TLS sessions and keep-alives are reused across calls, and every request
/// inherits the connect/request timeouts.
pub fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("default reqwest client with timeouts")
    })
}

/// Shared client for HTTP query engines (D1, PostHog): same connect timeout,
/// longer request budget. One process-wide client means TLS sessions and
/// keep-alives are reused across connect, introspection and queries; cloning a
/// `reqwest::Client` shares its pool.
pub fn query_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(QUERY_TIMEOUT)
            .build()
            .expect("default reqwest client with timeouts")
    })
}
