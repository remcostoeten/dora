//! Length-prefixed JSON framing over any async byte stream.
//!
//! Frame layout: a big-endian `u32` payload length followed by exactly that
//! many bytes of UTF-8 JSON. Used in both directions — the main app writes
//! [`RequestFrame`]s and reads [`ResponseFrame`]s; the helper does the reverse.

use std::io;

use serde::{de::DeserializeOwned, Serialize};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use super::proto::MAX_FRAME_LEN;

/// Serialise `value` to JSON and write it as one length-prefixed frame.
pub async fn write_frame<W, T>(w: &mut W, value: &T) -> io::Result<()>
where
    W: AsyncWrite + Unpin,
    T: Serialize,
{
    let bytes =
        serde_json::to_vec(value).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let len = u32::try_from(bytes.len())
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "frame exceeds u32 length"))?;
    w.write_all(&len.to_be_bytes()).await?;
    w.write_all(&bytes).await?;
    w.flush().await
}

/// Read one length-prefixed frame and deserialise it. Returns `Ok(None)` on a
/// clean EOF before any bytes of the next frame arrive (peer closed the pipe).
pub async fn read_frame<R, T>(r: &mut R) -> io::Result<Option<T>>
where
    R: AsyncRead + Unpin,
    T: DeserializeOwned,
{
    let mut len_buf = [0u8; 4];
    match r.read_exact(&mut len_buf).await {
        Ok(_) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_be_bytes(len_buf);
    if len > MAX_FRAME_LEN {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("frame length {len} exceeds maximum {MAX_FRAME_LEN}"),
        ));
    }
    let mut payload = vec![0u8; len as usize];
    r.read_exact(&mut payload).await?;
    let value = serde_json::from_slice(&payload)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    Ok(Some(value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::duckdb_ipc::proto::{RespPayload, ResponseFrame, ResponseMsg};

    #[tokio::test]
    async fn frames_round_trip_over_a_buffer() {
        let mut buf: Vec<u8> = Vec::new();
        let f1 = ResponseFrame {
            id: 7,
            msg: ResponseMsg::Done(Ok(RespPayload::ExecRaw { affected: 3 })),
        };
        let f2 = ResponseFrame {
            id: 8,
            msg: ResponseMsg::Done(Ok(RespPayload::Hash(42))),
        };
        write_frame(&mut buf, &f1).await.unwrap();
        write_frame(&mut buf, &f2).await.unwrap();

        let mut cursor = std::io::Cursor::new(buf);
        let got1: ResponseFrame = read_frame(&mut cursor).await.unwrap().unwrap();
        let got2: ResponseFrame = read_frame(&mut cursor).await.unwrap().unwrap();
        let eof: Option<ResponseFrame> = read_frame(&mut cursor).await.unwrap();

        assert_eq!(got1.id, 7);
        assert!(matches!(
            got1.msg,
            ResponseMsg::Done(Ok(RespPayload::ExecRaw { affected: 3 }))
        ));
        assert_eq!(got2.id, 8);
        assert!(matches!(
            got2.msg,
            ResponseMsg::Done(Ok(RespPayload::Hash(42)))
        ));
        assert!(eof.is_none());
    }
}
