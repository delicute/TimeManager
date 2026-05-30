export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
  if (mins > 0) return secs > 0 ? `${mins}m${secs}s` : `${mins}m`;
  return `${secs}s`;
}

export function formatDurationFull(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatWeight(val: number): string {
  return val % 1 === 0 ? `${val.toFixed(0)}s` : `${val.toFixed(1)}s`;
}

export function activityColor(type: string): string {
  switch (type) {
    case 'Study': return '#5db872';
    case 'Hobby': return '#5db8a6';
    case 'Entertainment': return '#e8a55a';
    default: return '#6c6a64';
  }
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
