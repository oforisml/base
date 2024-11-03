import { Construct } from "constructs";
import { iam, compute } from "../../../../src/aws";

export interface FakeTaskProps extends compute.TaskStateBaseProps {
  // readonly metrics?: compute.TaskMetricsConfig;
  readonly policies?: iam.PolicyStatement[];
}

export class FakeTask extends compute.TaskStateBase {
  // protected readonly taskMetrics?: compute.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  constructor(scope: Construct, id: string, props: FakeTaskProps = {}) {
    super(scope, id, props);
    // this.taskMetrics = props.metrics;
    this.taskPolicies = props.policies;
  }

  /**
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: "my-resource",
      Parameters: compute.FieldUtils.renderObject({
        MyParameter: "myParameter",
      }),
    };
  }
}
