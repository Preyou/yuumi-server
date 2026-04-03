export const REALTIME_DOMAINS = {
  USER_PROFILE: 'user.profile',
} as const

export type RealtimeDomain = (typeof REALTIME_DOMAINS)[keyof typeof REALTIME_DOMAINS]

export const ALL_REALTIME_DOMAINS = Object.values(REALTIME_DOMAINS) as RealtimeDomain[]
