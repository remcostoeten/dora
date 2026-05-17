use crate::{database::Certificates, error::Error};

use anyhow::Context;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, SignatureScheme};
use std::sync::Arc;
use tauri::async_runtime::JoinHandle;
use tokio_postgres::{tls::MakeTlsConnect, Client, Connection, NoTls, Socket};
use tokio_postgres_rustls::MakeRustlsConnect;

pub type ConnectionCheck = JoinHandle<()>;

/// No-op certificate verifier for `sslmode=require` / `sslmode=prefer`.
///
/// PostgreSQL's `require` mode means "encrypt the wire, but do NOT verify the
/// server certificate". rustls always verifies by default, which causes
/// handshake failures with some providers (e.g. Supabase's PgBouncer pooler).
/// This is encrypt-only TLS and does not protect against on-path attackers.
#[derive(Debug)]
struct AcceptAllServerCerts(Arc<rustls::crypto::CryptoProvider>);

impl ServerCertVerifier for AcceptAllServerCerts {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(
            message,
            cert,
            dss,
            &self.0.signature_verification_algorithms,
        )
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(
            message,
            cert,
            dss,
            &self.0.signature_verification_algorithms,
        )
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

pub(crate) fn no_verify_tls() -> MakeRustlsConnect {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(AcceptAllServerCerts(provider)))
        .with_no_client_auth();
    MakeRustlsConnect::new(config)
}

pub(crate) fn verified_tls(certificate_store: Arc<rustls::RootCertStore>) -> MakeRustlsConnect {
    let config = rustls::ClientConfig::builder()
        .with_root_certificates(certificate_store)
        .with_no_client_auth();
    MakeRustlsConnect::new(config)
}

pub async fn connect(
    config: &tokio_postgres::Config,
    certificates: &Certificates,
    verify_tls: bool,
) -> Result<(Client, ConnectionCheck), Error> {
    use tokio_postgres::config::SslMode;

    let client = match config.get_ssl_mode() {
        SslMode::Require if verify_tls => {
            let certificate_store = certificates.read().await?;
            let tls = verified_tls(certificate_store);
            let (client, conn) = config.connect(tls).await.map_err(|e| {
                anyhow::anyhow!(
                    "Failed to connect to Postgres with verified TLS: {e} | detail: {e:?}"
                )
            })?;
            let conn_check =
                tauri::async_runtime::spawn(check_connection::<MakeRustlsConnect>(conn));
            (client, conn_check)
        }
        // require / prefer: encrypt but do NOT verify the cert chain (libpq semantics).
        SslMode::Require | SslMode::Prefer => {
            let tls = no_verify_tls();
            let (client, conn) = config.connect(tls).await.map_err(|e| {
                anyhow::anyhow!("Failed to connect to Postgres: {e} | detail: {e:?}")
            })?;
            let conn_check =
                tauri::async_runtime::spawn(check_connection::<MakeRustlsConnect>(conn));
            (client, conn_check)
        }
        // Mostly SslMode::Disable/Allow, but the enum is non_exhaustive.
        _other => {
            let (client, conn) = config
                .connect(NoTls)
                .await
                .with_context(|| format!("Failed to connect to Postgres '{config:?}'"))?;
            let conn_check = tauri::async_runtime::spawn(check_connection::<NoTls>(conn));
            (client, conn_check)
        }
    };

    Ok(client)
}

async fn check_connection<T>(conn: Connection<Socket, T::Stream>)
where
    T: MakeTlsConnect<Socket>,
{
    let res = conn.await;
    log::info!("Connection finished");
    match res {
        Ok(()) => println!("Connected successfully"),
        Err(err) => eprintln!("Error or disconnect: {err:?}"),
    }
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_connect() {
        let connection_string = "postgres://postgres@localhost:5432/postgres";
        let config: tokio_postgres::Config = connection_string.parse().unwrap();
        assert_eq!(config.get_password(), None);

        let connection_string = "postgres://postgres:postgres@localhost:5432/postgres";
        let config: tokio_postgres::Config = connection_string.parse().unwrap();
        assert_eq!(config.get_password(), Some(&b"postgres"[..]));
    }
}
