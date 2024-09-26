// https://github.com/aws/aws-cdk/blob/v2.154.1/packages/aws-cdk-lib/aws-logs/lib/log-retention.ts
/**
 * How long, in days, the log contents will be retained.
 */
export enum RetentionDays {
  /**
   * 1 day
   */
  ONE_DAY = 1,

  /**
   * 3 days
   */
  THREE_DAYS = 3,

  /**
   * 5 days
   */
  FIVE_DAYS = 5,

  /**
   * 1 week
   */
  ONE_WEEK = 7,

  /**
   * 2 weeks
   */
  TWO_WEEKS = 14,

  /**
   * 1 month
   */
  ONE_MONTH = 30,

  /**
   * 2 months
   */
  TWO_MONTHS = 60,

  /**
   * 3 months
   */
  THREE_MONTHS = 90,

  /**
   * 4 months
   */
  FOUR_MONTHS = 120,

  /**
   * 5 months
   */
  FIVE_MONTHS = 150,

  /**
   * 6 months
   */
  SIX_MONTHS = 180,

  /**
   * 1 year
   */
  ONE_YEAR = 365,

  /**
   * 13 months
   */
  THIRTEEN_MONTHS = 400,

  /**
   * 18 months
   */
  EIGHTEEN_MONTHS = 545,

  /**
   * 2 years
   */
  TWO_YEARS = 731,

  /**
   * 3 years
   */
  THREE_YEARS = 1096,

  /**
   * 5 years
   */
  FIVE_YEARS = 1827,

  /**
   * 6 years
   */
  SIX_YEARS = 2192,

  /**
   * 7 years
   */
  SEVEN_YEARS = 2557,

  /**
   * 8 years
   */
  EIGHT_YEARS = 2922,

  /**
   * 9 years
   */
  NINE_YEARS = 3288,

  /**
   * 10 years
   */
  TEN_YEARS = 3653,

  /**
   * Retain logs forever
   */
  INFINITE = 9999,
}
