export enum PassTone {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

const SUCCESS_THRESHOLD = 80;
const WARNING_THRESHOLD = 50;

/**
 * Maps a pass percentage to a badge tone: ≥80 success, 50–79 warning, <50 error.
 * @param percent - pass percentage, 0–100
 */
export const getPassTone = (percent: number): PassTone => {
  if (percent >= SUCCESS_THRESHOLD) return PassTone.Success;
  if (percent >= WARNING_THRESHOLD) return PassTone.Warning;
  return PassTone.Error;
};
