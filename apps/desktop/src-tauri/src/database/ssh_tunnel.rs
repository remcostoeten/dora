use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use anyhow::{Context, Result};
use ssh2::Session;

#[derive(Debug)]
pub struct SshTunnel {
    pub local_port: u16,
    stop_signal: Arc<AtomicBool>,
    handle: Option<thread::JoinHandle<()>>,
}

impl SshTunnel {
    #[allow(clippy::too_many_arguments)]
    pub fn start(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_key_path: Option<&str>,
        ssh_password: Option<&str>,
        remote_host: String,
        remote_port: u16,
    ) -> Result<Self> {
        // Bind a random local port
        let listener = TcpListener::bind("127.0.0.1:0").context("Failed to bind local port")?;
        let local_port = listener.local_addr()?.port();
        
        let stop_signal = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_signal.clone();
        
        let host = ssh_host.to_string();
        let user = ssh_user.to_string();
        let key = ssh_key_path.map(|s| s.to_string());
        let pass = ssh_password.map(|s| s.to_string());

        let handle = thread::spawn(move || {
            match Self::run_tunnel_loop(listener, &host, ssh_port, &user, key.as_deref(), pass.as_deref(), remote_host, remote_port, stop_clone) {
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


    #[allow(clippy::too_many_arguments)]
    fn run_tunnel_loop(
        listener: TcpListener,
        host: &str,
        port: u16,
        username: &str,
        key_path: Option<&str>,
        password: Option<&str>,
        remote_host: String,
        remote_port: u16,
        stop_signal: Arc<AtomicBool>,
    ) -> Result<()> {
        log::info!("Connecting to SSH server {}:{}", host, port);
        let tcp = TcpStream::connect(format!("{}:{}", host, port))
            .context("Failed to connect to SSH server")?;
        
        let mut sess = Session::new().context("Failed to create SSH session")?;
        sess.set_tcp_stream(tcp);
        sess.handshake().context("SSH handshake failed")?;

        if let Some(path) = key_path {
            log::info!("Authenticating with private key: {}", path);
            sess.userauth_pubkey_file(username, None, std::path::Path::new(path), None)
                .context("SSH key auth failed")?;
        } else if let Some(pw) = password {
            log::info!("Authenticating with password");
            sess.userauth_password(username, pw)
                .context("SSH password auth failed")?;
        } else {
             log::info!("Authenticating with agent");
            sess.userauth_agent(username)
                .context("SSH agent auth failed")?;
        }

        if !sess.authenticated() {
            return Err(anyhow::anyhow!("SSH authentication failed"));
        }
        
        // Arc the session to share across threads? 
        // ssh2 structures are generally not Sync. We might need a mutex or a single-threaded approach with non-blocking IO.
        // For simplicity in this first version, we'll use a simple approach:
        // We can't easily share Session across threads for concurrent forwarding without Mutex.
        // But Mutex<Session> would serialize usage.
        
        // Actually, for a desktop app connection pool, we might just need one channel at a time or few.
        // Let's wrap session in Arc<Mutex<>>.
        
        let sess = Arc::new(std::sync::Mutex::new(sess));

        listener.set_nonblocking(true)?;
        
        log::info!("SSH Tunnel established. Listening on 127.0.0.1:{}", listener.local_addr()?.port());

        loop {
            if stop_signal.load(Ordering::Relaxed) {
                break;
            }

            match listener.accept() {
                Ok((stream, _)) => {
                    let sess_clone = sess.clone();
                    let r_host = remote_host.clone();
                    // Spawn a thread to handle this connection
                    thread::spawn(move || {
                        if let Err(e) = Self::forward_stream(stream, sess_clone, &r_host, remote_port) {
                            log::warn!("Tunnel connection error: {}", e);
                        }
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(100));
                }
                Err(e) => {
                    log::error!("Tunnel accept error: {}", e);
                    break;
                }
            }
        }
        
        Ok(())
    }

    fn forward_stream(mut stream: TcpStream, sess: Arc<std::sync::Mutex<Session>>, remote_host: &str, remote_port: u16) -> Result<()> {
        // Lock session to create channel
        let mut channel = {
            let sess_guard = sess.lock().unwrap();
            sess_guard.channel_direct_tcpip(remote_host, remote_port, None)
                .context("Failed to create SSH channel")?
        };
        
        // We now have a channel. 
        // We need to pipe stream <-> channel.
        // Using built-in stream/io generic copying is tricky because Channel incorporates both Read and Write.
        // We can set non-blocking on both and select?
        // Or standard blocking copy with threads?
        // Channel is not Send? "Channel implements Read and Write". 
        // The problem is Channel borrows Session. So we can't release the generic mutex lock while using Channel if Channel lifetime is tied to Session guard.
        
        // ssh2-rs: Channel<'session>. 
        // This means we must hold the lock for the entire duration of the connection if we use Mutex<Session>.
        // This effectively serializes all DB queries through one SSH channel at a time.
        // For a basic implementation, this is acceptable but suboptimal (concurrent queries will block each other).
        
        // To support true concurrency we'd need multiple Sessions or libssh2 raw usage.
        // OR we just assume this limitation for V1.
        
        let mut buffer = [0u8; 4096];
        stream.set_nonblocking(true)?;
        // Channel doesn't support set_nonblocking directly in the wrapper easily? 
        // Actually it does interact with Session set_blocking.
        
        // Simplest fallback: Just proxy data.
        // Since we hold the Mutex<Session>, we block other connections.
        // Let's implement full blocking copy for reliability first.
        
        // Since we can't hold mutex for long, we are stuck.
        // Real solution: Create a NEW Session for every connection?
        // Expensive handshake every time.
        
        // Let's stick to the limitation: Serialized tunneling.
        // Ideally we use a pool of sessions if needed.
        
        // Actually, let's relax. tokio-postgres connects ONCE per Client. 
        // connection.rs holds ONE client.
        // So we only ever have ONE active TCP stream through the tunnel per DatabaseConnection.
        // So serializing is NOT a problem for a single connection!
        // We just need to ensure the tunnel thread handles that one stream.
        
        // But what if we open multiple connections in the app?
        // connection.rs creates a NEW SshTunnel for each `connect_to_database` call?
        // Yes! `DatabaseInfo` is per connection.
        // So each `DatabaseConnection` will have its OWN `SshTunnel` instance and its OWN `Session`.
        // So we don't need to share Session across threads!
        
        // We still need to handle the `listener.accept()` loop.
        // `tokio-postgres` might open multiple streams? No, usually just one TCP stream.
        // So really, the loop will accept 1 connection and then satisfy it.
        
        // So we can simplify:
        // We don't need Arc<Mutex<Session>> if we move Session into the handling thread?
        // But we want the listener to stay open just in case connection drops and reconnects? 
        // No, `tokio-postgres` usually fails if connection drops.
        
        // Let's keep the loop but use Arc<Mutex<Session>>. 
        // Since there is only 1 active stream expected, the lock contention is zero.
        
        let mut stream_clone = stream.try_clone()?;
        
        // Simple bidirectional copy loop
        // We can't use std::io::copy because it blocks one way.
        // We need non-blocking or two threads.
        // Channel is NOT Send, so we can't split it into reader/writer thread easily.
        
        // We will use non-blocking polling.
        
        loop {
            let mut close = false;
            // Read from socket, write to channel
            match stream.read(&mut buffer) {
                Ok(0) => { close = true; } // EOF
                Ok(n) => {
                    channel.write_all(&buffer[..n])?;
                    channel.flush()?;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(_) => { close = true; }
            }
            
            // Read from channel, write to socket
            match channel.read(&mut buffer) {
                 Ok(0) => { close = true; }
                 Ok(n) => {
                     stream_clone.write_all(&buffer[..n])?;
                     stream_clone.flush()?;
                 }
                 Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                 Err(_) => { close = true; }
            }
            
            if close { break; }
            thread::sleep(Duration::from_millis(1));
        }
        
        Ok(())
    }
}

impl Drop for SshTunnel {
    fn drop(&mut self) {
        self.stop_signal.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            // Signal stop and wait (optional, might block UI if loop is sleeping)
            // handle.join(); 
        }
    }
}
