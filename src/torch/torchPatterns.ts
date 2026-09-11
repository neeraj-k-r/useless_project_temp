export interface BlinkConfig {
  blinks: number;
  onDurationMs: number;
  offDurationMs: number;
  finalState: 'ON' | 'OFF';
}

export const TORCH_PATTERNS: Record<string, BlinkConfig> = {
  '3_BLINKS': {
    blinks: 3,
    onDurationMs: 400,
    offDurationMs: 400,
    finalState: 'ON'
  },
  'QUICK_ALERT': {
    blinks: 2,
    onDurationMs: 250,
    offDurationMs: 250,
    finalState: 'ON'
  },
  'SOS': {
    blinks: 3,
    onDurationMs: 200,
    offDurationMs: 200,
    finalState: 'OFF'
  }
};
