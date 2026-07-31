use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use anyhow::{anyhow, bail, Context, Result};
use russh::client::{self, Config, Handle};
#[cfg(unix)]
use russh::keys::agent::client::AgentClient;
#[cfg(unix)]
use russh::keys::agent::AgentIdentity;
use russh::keys::{check_known_hosts, load_secret_key, HashAlg, PrivateKeyWithHashAlg};
use russh::{ChannelMsg, Disconnect};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener as TokioTcpListener, TcpStream};

#[derive(Debug)]
pub struct SshTunnel {
    pub local_port: u16,
    stop_signal: Arc<AtomicBool>,
    handle: Option<thread::JoinHandle<()>>,
}

struct Client {
    host: String,
    port: u16,
    expected_fingerprint: Option<String>,
}

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let fingerprint = server_public_key.fingerprint(HashAlg::Sha256).to_string();

        if let Some(expected) = self.expected_fingerprint.as_deref() {
            let expected = expected.trim();
            let matches = fingerprint.eq_ignore_ascii_case(expected);
            if !matches {
                log::error!(
                    "SSH host key mismatch for {}:{}: expected {}, received {}",
                    self.host,
                    self.port,
                    expected,
                    fingerprint
                );
            }
            return Ok(matches);
        }

        match check_known_hosts(&self.host, self.port, server_public_key) {
            Ok(true) => Ok(true),
            Ok(false) => {
                log::error!(
                    "Unknown SSH host key for {}:{} (fingerprint {}). Add it to ~/.ssh/known_hosts or pin this fingerprint in the connection.",
                    self.host,
                    self.port,
                    fingerprint
                );
                Ok(false)
            }
            Err(error) => {
                log::error!(
                    "SSH host key verification failed for {}:{} (fingerprint {}): {}",
                    self.host,
                    self.port,
                    fingerprint,
                    error
                );
                Ok(false)
            }
        }
    }
}

impl SshTunnel {
    #[allow(clippy::too_many_arguments)]
    pub fn start(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_key_path: Option<&str>,
        ssh_password: Option<&str>,
        host_key_fingerprint: Option<&str>,
        remote_host: String,
        remote_port: u16,
    ) -> Result<Self> {
        let listener = TcpListener::bind("127.0.0.1:0").context("Failed to bind local port")?;
        let local_port = listener.local_addr()?.port();

        let stop_signal = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_signal.clone();

        let host = ssh_host.to_string();
        let user = ssh_user.to_string();
        let key = ssh_key_path.map(|s| s.to_string());
        let pass = ssh_password.map(|s| s.to_string());
        let expected_fingerprint = host_key_fingerprint
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        let handle = thread::spawn(move || {
            let runtime = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(rt) => rt,
                Err(e) => {
                    log::error!("Failed to build SSH tunnel runtime: {}", e);
                    return;
                }
            };

            let result = runtime.block_on(run_tunnel(
                listener,
                host,
                ssh_port,
                user,
                key,
                pass,
                expected_fingerprint,
                remote_host,
                remote_port,
                stop_clone,
            ));

            match result {
                Ok(_) => log::info!("SSH Tunnel finished gracefully"),
                Err(e) => log::error!("SSH Tunnel failed: {}", e),
            }
        });

        Ok(Self {
            local_port,
            stop_signal,
            handle: Some(handle),
        })
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_tunnel(
    listener: TcpListener,
    host: String,
    port: u16,
    username: String,
    key_path: Option<String>,
    password: Option<String>,
    expected_fingerprint: Option<String>,
    remote_host: String,
    remote_port: u16,
    stop_signal: Arc<AtomicBool>,
) -> Result<()> {
    listener.set_nonblocking(true)?;
    let listener = TokioTcpListener::from_std(listener)?;

    log::info!("Connecting to SSH server {}:{}", host, port);
    let config = Arc::new(Config {
        nodelay: true,
        ..Default::default()
    });

    let handler = Client {
        host: host.clone(),
        port,
        expected_fingerprint,
    };
    let mut session = client::connect(config, (host.as_str(), port), handler)
        .await
        .context("Failed to connect to SSH server")?;

    authenticate(&mut session, &username, key_path.as_deref(), password.as_deref()).await?;

    log::info!(
        "SSH Tunnel established. Listening on 127.0.0.1:{}",
        listener.local_addr()?.port()
    );

    loop {
        if stop_signal.load(Ordering::Relaxed) {
            break;
        }

        let accepted = match tokio::time::timeout(Duration::from_millis(200), listener.accept()).await
        {
            Ok(Ok(pair)) => pair,
            Ok(Err(e)) => {
                log::error!("Tunnel accept error: {}", e);
                break;
            }
            Err(_) => continue,
        };

        let (socket, origin) = accepted;
        let channel = session
            .channel_open_direct_tcpip(
                remote_host.clone(),
                remote_port as u32,
                origin.ip().to_string(),
                origin.port() as u32,
            )
            .await
            .context("Failed to open direct-tcpip channel")?;

        tokio::spawn(async move {
            if let Err(e) = forward(socket, channel).await {
                log::warn!("Tunnel connection error: {}", e);
            }
        });
    }

    session
        .disconnect(Disconnect::ByApplication, "", "")
        .await
        .ok();

    Ok(())
}

async fn authenticate(
    session: &mut Handle<Client>,
    username: &str,
    key_path: Option<&str>,
    password: Option<&str>,
) -> Result<()> {
    if let Some(path) = key_path {
        log::info!("Authenticating with private key: {}", path);
        let key = load_secret_key(path, None).context("Failed to load SSH private key")?;
        let hash_alg = session.best_supported_rsa_hash().await?.flatten();
        let result = session
            .authenticate_publickey(
                username,
                PrivateKeyWithHashAlg::new(Arc::new(key), hash_alg),
            )
            .await
            .context("SSH key auth failed")?;
        if !result.success() {
            bail!("SSH key authentication rejected");
        }
    } else if let Some(pw) = password {
        log::info!("Authenticating with password");
        let result = session
            .authenticate_password(username, pw)
            .await
            .context("SSH password auth failed")?;
        if !result.success() {
            bail!("SSH password authentication rejected");
        }
    } else {
        // SSH agent auth relies on russh's `AgentClient::connect_env`, which is
        // Unix-only (it reads SSH_AUTH_SOCK). Windows exposes the agent over a
        // named pipe that russh does not wire up here, so agent auth is gated to
        // Unix; Windows callers fall back to explicit key or password auth.
        #[cfg(unix)]
        {
            log::info!("Authenticating with agent");
            let mut agent = AgentClient::connect_env()
                .await
                .context("Failed to connect to SSH agent")?;
            let identities = agent
                .request_identities()
                .await
                .context("Failed to list SSH agent identities")?;

            let mut authenticated = false;
            for identity in identities {
                if let AgentIdentity::PublicKey { key, .. } = identity {
                    let result = session
                        .authenticate_publickey_with(username, key, None, &mut agent)
                        .await
                        .map_err(|e| anyhow!("SSH agent auth failed: {}", e))?;
                    if result.success() {
                        authenticated = true;
                        break;
                    }
                }
            }

            if !authenticated {
                bail!("SSH agent authentication rejected");
            }
        }
        #[cfg(not(unix))]
        {
            bail!(
                "SSH agent authentication is not supported on this platform; \
                 provide a private key or password instead"
            );
        }
    }

    Ok(())
}

async fn forward(mut socket: TcpStream, mut channel: russh::Channel<client::Msg>) -> Result<()> {
    let mut buffer = vec![0u8; 65536];
    let mut socket_closed = false;

    loop {
        tokio::select! {
            read = socket.read(&mut buffer), if !socket_closed => {
                match read {
                    Ok(0) => {
                        socket_closed = true;
                        channel.eof().await?;
                    }
                    Ok(n) => channel.data(&buffer[..n]).await?,
                    Err(e) => return Err(e.into()),
                }
            }
            msg = channel.wait() => {
                match msg {
                    Some(ChannelMsg::Data { ref data }) => {
                        socket.write_all(data).await?;
                    }
                    Some(ChannelMsg::Eof) => {
                        if !socket_closed {
                            channel.eof().await?;
                        }
                        break;
                    }
                    Some(ChannelMsg::Close) | None => break,
                    Some(_) => {}
                }
            }
        }
    }

    Ok(())
}

impl Drop for SshTunnel {
    fn drop(&mut self) {
        self.stop_signal.store(true, Ordering::Relaxed);
        let _ = self.handle.take();
    }
}
