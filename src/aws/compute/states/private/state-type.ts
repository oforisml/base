// https://github.com/aws/aws-cdk/blob/v2.160.0/packages/aws-cdk-lib/aws-stepfunctions/lib/states/private/state-type.ts

/**
 * State types
 */
export enum StateType {
  PASS = "Pass",
  TASK = "Task",
  CHOICE = "Choice",
  WAIT = "Wait",
  SUCCEED = "Succeed",
  FAIL = "Fail",
  PARALLEL = "Parallel",
  MAP = "Map",
}
