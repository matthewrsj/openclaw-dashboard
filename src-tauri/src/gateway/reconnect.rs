//! Reconnection strategy with exponential backoff and jitter.

use std::time::Duration;

/// Configuration for reconnection behavior.
pub struct ReconnectConfig {
    /// Initial delay before first reconnection attempt.
    pub initial_delay: Duration,
    /// Maximum delay between reconnection attempts.
    pub max_delay: Duration,
    /// Backoff multiplier applied after each attempt.
    pub multiplier: f64,
    /// Jitter range (±percentage, e.g., 0.2 = ±20%).
    pub jitter: f64,
}

impl Default for ReconnectConfig {
    fn default() -> Self {
        Self {
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(30),
            multiplier: 2.0,
            jitter: 0.2,
        }
    }
}

impl ReconnectConfig {
    /// Calculate the delay for a given attempt number (0-indexed).
    ///
    /// Uses exponential backoff with random jitter to prevent thundering herd.
    pub fn delay_for_attempt(&self, attempt: u32) -> Duration {
        let base = self.initial_delay.as_secs_f64() * self.multiplier.powi(attempt as i32);
        let capped = base.min(self.max_delay.as_secs_f64());

        // Apply jitter: ±jitter%
        let jitter_range = capped * self.jitter;
        let jitter_offset = (rand_simple() * 2.0 - 1.0) * jitter_range;
        let final_delay = (capped + jitter_offset).max(0.1);

        Duration::from_secs_f64(final_delay)
    }
}

/// Simple pseudo-random number generator (0.0..1.0) that doesn't require
/// an external crate. Uses the current time as entropy source.
fn rand_simple() -> f64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    // Simple hash-like mixing
    let mixed = nanos.wrapping_mul(2654435761);
    (mixed as f64) / (u32::MAX as f64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn default_config_has_correct_values() {
        let config = ReconnectConfig::default();
        assert_eq!(config.initial_delay, Duration::from_secs(1));
        assert_eq!(config.max_delay, Duration::from_secs(30));
        assert!((config.multiplier - 2.0).abs() < f64::EPSILON);
        assert!((config.jitter - 0.2).abs() < f64::EPSILON);
    }

    #[test]
    fn attempt_0_returns_near_initial_delay() {
        let config = ReconnectConfig {
            jitter: 0.0, // disable jitter for deterministic test
            ..Default::default()
        };
        let delay = config.delay_for_attempt(0);
        // With 0 jitter: base = 1 * 2^0 = 1.0s
        assert!((delay.as_secs_f64() - 1.0).abs() < 0.01);
    }

    #[test]
    fn exponential_backoff_doubles_each_attempt() {
        let config = ReconnectConfig {
            jitter: 0.0,
            ..Default::default()
        };
        let d0 = config.delay_for_attempt(0).as_secs_f64();
        let d1 = config.delay_for_attempt(1).as_secs_f64();
        let d2 = config.delay_for_attempt(2).as_secs_f64();
        let d3 = config.delay_for_attempt(3).as_secs_f64();

        assert!((d0 - 1.0).abs() < 0.01);
        assert!((d1 - 2.0).abs() < 0.01);
        assert!((d2 - 4.0).abs() < 0.01);
        assert!((d3 - 8.0).abs() < 0.01);
    }

    #[test]
    fn delay_is_capped_at_max_delay() {
        let config = ReconnectConfig {
            jitter: 0.0,
            ..Default::default()
        };
        // Attempt 10: 1 * 2^10 = 1024, should be capped at 30s
        let delay = config.delay_for_attempt(10);
        assert!((delay.as_secs_f64() - 30.0).abs() < 0.01);
    }

    #[test]
    fn high_attempt_number_stays_at_max() {
        let config = ReconnectConfig {
            jitter: 0.0,
            ..Default::default()
        };
        let d100 = config.delay_for_attempt(100);
        assert!((d100.as_secs_f64() - 30.0).abs() < 0.01);
    }

    #[test]
    fn jitter_stays_within_bounds() {
        let config = ReconnectConfig::default(); // 20% jitter
        // Run multiple attempts and check jitter bounds
        for attempt in 0..10 {
            let delay = config.delay_for_attempt(attempt);
            let base = (config.initial_delay.as_secs_f64() * config.multiplier.powi(attempt as i32))
                .min(config.max_delay.as_secs_f64());
            let jitter_range = base * config.jitter;
            let min_expected = (base - jitter_range).max(0.1);
            let max_expected = base + jitter_range;

            let secs = delay.as_secs_f64();
            assert!(
                secs >= min_expected - 0.001 && secs <= max_expected + 0.001,
                "attempt {attempt}: delay {secs:.3}s not in [{min_expected:.3}, {max_expected:.3}]"
            );
        }
    }

    #[test]
    fn delay_is_never_negative() {
        let config = ReconnectConfig {
            initial_delay: Duration::from_millis(1),
            max_delay: Duration::from_millis(10),
            multiplier: 1.1,
            jitter: 0.99, // extreme jitter
        };
        for attempt in 0..20 {
            let delay = config.delay_for_attempt(attempt);
            assert!(delay.as_secs_f64() >= 0.1,
                "attempt {attempt}: delay was {:.3}s, expected >= 0.1",
                delay.as_secs_f64());
        }
    }

    #[test]
    fn custom_config_works() {
        let config = ReconnectConfig {
            initial_delay: Duration::from_millis(500),
            max_delay: Duration::from_secs(10),
            multiplier: 3.0,
            jitter: 0.0,
        };
        let d0 = config.delay_for_attempt(0).as_secs_f64();
        let d1 = config.delay_for_attempt(1).as_secs_f64();
        let d2 = config.delay_for_attempt(2).as_secs_f64();

        assert!((d0 - 0.5).abs() < 0.01);   // 0.5 * 3^0 = 0.5
        assert!((d1 - 1.5).abs() < 0.01);   // 0.5 * 3^1 = 1.5
        assert!((d2 - 4.5).abs() < 0.01);   // 0.5 * 3^2 = 4.5
    }
}
