mod service;
mod types;

pub use service::{classify_raw_command, parse_raw_command, KvService};
pub use types::*;

pub type KvConnection = KvService;
