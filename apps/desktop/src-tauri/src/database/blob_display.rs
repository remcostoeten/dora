//! Human-readable rendering of binary/blob cell values for the data grid.
//!
//! Small blobs render as an inline uppercase hex string (`0x…`) so they can be
//! read and copied directly; larger ones render as a `<type — size>` summary
//! using magic-byte detection, so the grid shows something meaningful instead
//! of a bare byte count.

/// Blobs up to this size are rendered inline as hex; larger ones get a summary.
const INLINE_HEX_MAX: usize = 64;

/// Renders a binary value for display in a result cell.
pub fn describe_blob(bytes: &[u8]) -> String {
    if bytes.len() <= INLINE_HEX_MAX {
        return format!("0x{}", to_hex_upper(bytes));
    }
    format!("<{} — {}>", detect_kind(bytes), human_size(bytes.len()))
}

fn to_hex_upper(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write;
        let _ = write!(out, "{byte:02X}");
    }
    out
}

/// Identifies common formats by their leading magic bytes.
fn detect_kind(bytes: &[u8]) -> &'static str {
    const SIGNATURES: &[(&[u8], &str)] = &[
        (&[0x89, 0x50, 0x4E, 0x47], "PNG image"),
        (&[0xFF, 0xD8, 0xFF], "JPEG image"),
        (&[0x47, 0x49, 0x46, 0x38], "GIF image"),
        (&[0x42, 0x4D], "BMP image"),
        (&[0x25, 0x50, 0x44, 0x46], "PDF"),
        (&[0x1F, 0x8B], "GZIP archive"),
        (&[0x50, 0x4B, 0x03, 0x04], "ZIP archive"),
        (&[0x4F, 0x67, 0x67, 0x53], "OGG"),
        (&[0x66, 0x4C, 0x61, 0x43], "FLAC audio"),
        (&[0x49, 0x44, 0x33], "MP3 audio"),
        (&[0x00, 0x61, 0x73, 0x6D], "WASM module"),
    ];

    for (signature, label) in SIGNATURES {
        if bytes.starts_with(signature) {
            return label;
        }
    }

    // RIFF containers: "RIFF" <size> "WEBP" / "WAVE".
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") {
        match &bytes[8..12] {
            b"WEBP" => return "WEBP image",
            b"WAVE" => return "WAV audio",
            _ => {}
        }
    }

    "binary"
}

fn human_size(len: usize) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    let n = len as f64;
    if n < KB {
        format!("{len} B")
    } else if n < MB {
        format!("{:.1} KB", n / KB)
    } else if n < GB {
        format!("{:.1} MB", n / MB)
    } else {
        format!("{:.1} GB", n / GB)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn small_blob_renders_inline_hex() {
        assert_eq!(describe_blob(&[0xDE, 0xAD, 0xBE, 0xEF]), "0xDEADBEEF");
        assert_eq!(describe_blob(&[]), "0x");
    }

    #[test]
    fn blob_at_inline_boundary_is_still_hex() {
        let bytes = vec![0xABu8; INLINE_HEX_MAX];
        assert!(describe_blob(&bytes).starts_with("0x"));
        assert_eq!(describe_blob(&bytes).len(), 2 + INLINE_HEX_MAX * 2);
    }

    #[test]
    fn large_blob_detects_type_and_size() {
        let mut png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend(std::iter::repeat(0u8).take(100_000));
        let described = describe_blob(&png);
        assert!(described.contains("PNG image"), "{described}");
        assert!(described.contains("KB"), "{described}");
    }

    #[test]
    fn unknown_large_blob_is_binary() {
        let bytes = vec![0x01u8; 5000];
        let described = describe_blob(&bytes);
        assert!(described.starts_with("<binary — "), "{described}");
        assert!(described.contains("4.9 KB"), "{described}");
    }

    #[test]
    fn detects_webp_riff_container() {
        let mut webp = b"RIFF\0\0\0\0WEBP".to_vec();
        webp.extend(std::iter::repeat(0u8).take(200));
        assert!(describe_blob(&webp).contains("WEBP image"));
    }

    #[test]
    fn human_size_thresholds() {
        assert_eq!(human_size(512), "512 B");
        assert_eq!(human_size(1536), "1.5 KB");
        assert_eq!(human_size(5 * 1024 * 1024), "5.0 MB");
    }
}
