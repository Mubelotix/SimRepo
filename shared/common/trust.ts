// Crawler trust score (0-1) below which a repository is labelled "Suspicious".
// Repos with trust_p strictly below this threshold appear in the
// suspicious-repos leaderboard; TrustNotice uses it as the lower bound of the
// "Low" tier. Single source of truth shared by the backend query and the
// frontend tiers.
export const SUSPICIOUS_TRUST_THRESHOLD = 0.01;
