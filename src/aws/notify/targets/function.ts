import { RuleTargetInput } from "../input";
import { IRule } from "../rule";
import { IRuleTarget, RuleTargetConfig } from "../target";
import {
  addLambdaPermission,
  addToDeadLetterQueueResourcePolicy,
  TargetBaseProps,
  bindBaseTargetConfig,
} from "./util";
import * as compute from "../../compute";

/**
 * Customize the Lambda Event Target
 */
export interface LambdaFunctionProps extends TargetBaseProps {
  /**
   * The event to send to the Lambda
   *
   * This will be the payload sent to the Lambda Function.
   *
   * @default the entire EventBridge event
   */
  readonly event?: RuleTargetInput;
}

/**
 * Use an AWS Lambda function as an event rule target.
 */
export class LambdaFunction implements IRuleTarget {
  constructor(
    private readonly handler: compute.IFunction,
    private readonly props: LambdaFunctionProps = {},
  ) {}

  /**
   * Returns a RuleTarget that can be used to trigger this Lambda as a
   * result from an EventBridge event.
   */
  public bind(rule: IRule, _id?: string): RuleTargetConfig {
    // Allow handler to be called from rule
    addLambdaPermission(rule, this.handler);

    if (this.props.deadLetterQueue) {
      addToDeadLetterQueueResourcePolicy(rule, this.props.deadLetterQueue);
    }

    return {
      ...bindBaseTargetConfig(this.props),
      arn: this.handler.functionArn,
      input: this.props.event,
      targetResource: this.handler,
    };
  }
}
