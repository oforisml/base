// https://github.com/aws/aws-cdk/blob/24adca3385e2321eac7e034d90a53b4290c048f1/packages/aws-cdk-lib/aws-logs/lib/policy.ts

import { CloudwatchLogSubscriptionFilter } from "@cdktf/provider-aws/lib/cloudwatch-log-subscription-filter";
import { Token } from "cdktf";
import { Construct } from "constructs";
import { AwsBeaconBase, AwsBeaconProps } from "..";
import { ILogGroup, SubscriptionFilterOptions } from "./log-group";
import * as iam from "../iam";

//TODO: manage the KinesisDestination
// import { KinesisDestination } from "../../aws-logs-destinations";

// eslint-disable-next-line prettier/prettier
// import { CfnSubscriptionFilter } from './logs.generated';

/**
 * Interface for classes that can be the destination of a log Subscription
 */
export interface ILogSubscriptionDestination {
  /**
   * Return the properties required to send subscription events to this destination.
   *
   * If necessary, the destination can use the properties of the SubscriptionFilter
   * object itself to configure its permissions to allow the subscription to write
   * to it.
   *
   * The destination may reconfigure its own permissions in response to this
   * function call.
   */
  bind(
    scope: Construct,
    sourceLogGroup: ILogGroup,
  ): LogSubscriptionDestinationConfig;
}

/**
 * Properties returned by a Subscription destination
 */
export interface LogSubscriptionDestinationConfig {
  /**
   * The ARN of the subscription's destination
   */
  readonly arn: string;

  /**
   * The role to assume to write log events to the destination
   *
   * @default No role assumed
   */
  readonly role?: iam.IRole;
}

/**
 * Properties for a SubscriptionFilter
 */
export interface SubscriptionFilterProps
  extends SubscriptionFilterOptions,
    AwsBeaconProps {
  /**
   * The log group to create the subscription on.
   */
  readonly logGroup: ILogGroup;
}

/**
 * A new Subscription on a CloudWatch log group.
 */
export class SubscriptionFilter extends AwsBeaconBase {
  public get outputs(): Record<string, any> {
    return {
      logGroupName: this.friendlyName,
      destinationArn: this.env.account,
    };
  }
  physicalName: string;
  constructor(scope: Construct, id: string, props: SubscriptionFilterProps) {
    super(scope, id);

    if (
      props.distribution &&
      !Token.isUnresolved(props.distribution) &&
      !Token.isUnresolved(props.destination)
      // && !(props.destination instanceof KinesisDestination)
    ) {
      throw new Error(
        "distribution property can only be used with KinesisDestination.",
      );
    }

    const destProps = props.destination.bind(this, props.logGroup);

    new CloudwatchLogSubscriptionFilter(this, "Resource", {
      logGroupName: props.logGroup.logGroupName,
      destinationArn: destProps.arn,
      roleArn: destProps.role && destProps.role.roleArn,
      filterPattern: props.filterPattern.logPatternString,
      name: this.physicalName,
      distribution: props.distribution,
    });
  }
}
