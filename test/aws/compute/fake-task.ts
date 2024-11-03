import { Construct } from "constructs";
import { iam, compute } from "../../../src/aws";

export interface FakeTaskProps extends compute.TaskStateBaseProps {
  parameters?: { [key: string]: string };
}

/**
 * Task extending compute.TaskStateBase to facilitate integ testing setting credentials
 */
export class FakeTask extends compute.TaskStateBase {
  // protected readonly taskMetrics?: compute.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];
  protected readonly parameters?: { [key: string]: string };

  constructor(scope: Construct, id: string, props: FakeTaskProps = {}) {
    super(scope, id, props);
    this.parameters = props.parameters;
  }

  protected _renderTask(): any {
    return {
      Type: "Task",
      Resource: "arn:aws:states:::dynamodb:putItem",
      Parameters: {
        TableName: "my-cool-table",
        Item: {
          id: {
            S: "my-entry",
          },
        },
        ...this.parameters,
      },
    };
  }
}
