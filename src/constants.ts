export const STUDY_MILESTONES = [
  { threshold: 3600, label: '1h', reward: 900, labelZH: '连续学习≥1h', labelEN: 'Continuous study ≥1h' },
  { threshold: 10800, label: '3h', reward: 2700, labelZH: '连续学习≥3h', labelEN: 'Continuous study ≥3h' },
  { threshold: 18000, label: '5h', reward: 3600, labelZH: '连续学习≥5h', labelEN: 'Continuous study ≥5h' },
] as const;

export const HOBBY_MILESTONES = [
  { threshold: 3600, label: '1h', reward: 600, labelZH: '连续爱好≥1h', labelEN: 'Continuous hobby ≥1h' },
  { threshold: 10800, label: '3h', reward: 1800, labelZH: '连续爱好≥3h', labelEN: 'Continuous hobby ≥3h' },
  { threshold: 18000, label: '5h', reward: 2700, labelZH: '连续爱好≥5h', labelEN: 'Continuous hobby ≥5h' },
] as const;
