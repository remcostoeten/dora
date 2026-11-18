use serde::Serialize;
use specta::Type;
use std::{
    collections::{BTreeMap, VecDeque},
    sync::Mutex,
    time::Instant,
};
use uuid::Uuid;

const LIMIT: usize = 500;
static SAMPLES: Mutex<VecDeque<PerfSample>> = Mutex::new(VecDeque::new());

#[derive(Clone, Serialize, Type)]
pub struct PerfSample {
    metric: String,
    duration_ms: f64,
    connection_id: Option<Uuid>,
    engine: Option<String>,
    timestamp_ms: f64,
}

#[derive(Serialize, Type)]
pub struct PerfSummary {
    count: usize,
    p50: f64,
    p95: f64,
    max: f64,
}

#[derive(Serialize, Type)]
pub struct PerfReport {
    samples: Vec<PerfSample>,
    summary: BTreeMap<String, PerfSummary>,
    process_rss_bytes: Option<f64>,
}

fn append<T>(buffer: &mut VecDeque<T>, sample: T) {
    if buffer.len() == LIMIT {
        buffer.pop_front();
    }
    buffer.push_back(sample);
}

pub(crate) fn record(metric: &str, started: Instant, connection_id: Uuid) {
    let sample = PerfSample {
        duration_ms: started.elapsed().as_secs_f64() * 1000.0,
        timestamp_ms: chrono::Utc::now().timestamp_millis() as f64,
        metric: metric.into(),
        connection_id: Some(connection_id),
        engine: None,
    };
    append(&mut SAMPLES.lock().unwrap(), sample);
}

fn summarize(mut values: Vec<f64>) -> PerfSummary {
    values.sort_unstable_by(f64::total_cmp);
    let count = values.len();
    let percentile = |p: usize| values[(count * p).div_ceil(100usize) - 1];
    PerfSummary {
        count,
        p50: percentile(50),
        p95: percentile(95),
        max: values[count - 1],
    }
}

fn process_rss() -> Option<f64> {
    use sysinfo::{Pid, ProcessRefreshKind, RefreshKind, System};
    let system = System::new_with_specifics(
        RefreshKind::nothing()
            .with_processes(ProcessRefreshKind::nothing().with_memory().without_tasks()),
    );
    let root = Pid::from_u32(std::process::id());
    system.process(root)?;
    let mut children = BTreeMap::<Pid, Vec<Pid>>::new();
    for (pid, process) in system.processes() {
        if let Some(parent) = process.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }
    let mut pending = vec![root];
    let mut total = 0;
    while let Some(pid) = pending.pop() {
        total += system.process(pid)?.memory();
        pending.extend(children.remove(&pid).unwrap_or_default());
    }
    Some(total as f64)
}

#[tauri::command]
#[specta::specta]
pub async fn get_perf_report() -> PerfReport {
    let samples: Vec<_> = SAMPLES.lock().unwrap().iter().cloned().collect();
    let mut groups = BTreeMap::<String, Vec<f64>>::new();
    for sample in &samples {
        groups
            .entry(sample.metric.clone())
            .or_default()
            .push(sample.duration_ms);
    }
    PerfReport {
        samples,
        summary: groups
            .into_iter()
            .map(|(metric, values)| (metric, summarize(values)))
            .collect(),
        process_rss_bytes: process_rss(),
    }
}

#[tauri::command]
#[specta::specta]
pub fn clear_perf_samples() {
    SAMPLES.lock().unwrap().clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nearest_rank_percentiles() {
        let s = summarize((1..=20).rev().map(f64::from).collect());
        assert_eq!((s.count, s.p50, s.p95, s.max), (20, 10., 19., 20.));
        assert_eq!(summarize(vec![0.25]).p95, 0.25);
    }

    #[test]
    fn retains_newest_samples_in_order() {
        let mut buffer = VecDeque::new();
        for n in 0..LIMIT + 2 {
            append(&mut buffer, n);
        }
        assert!(buffer.into_iter().eq(2..LIMIT + 2));
    }
}
