/* eslint-disable no-bitwise */
/**
 * AWS Access Levels
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_understand-policy-summary-access-level-summaries.html#access_policies_access-level
 */
export enum AwsAccessLevels {
  LIST = 1 << 0,
  READ = 1 << 1,
  TAGGING = 1 << 2,
  WRITE = 1 << 3,
  PERMISSION_MANAGEMENT = 1 << 4,
}
/* eslint-enable no-bitwise */
