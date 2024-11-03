import { Construct } from "constructs";
import { StateType } from "./private/state-type";
import { renderJsonPath, State } from "./state";
import { Duration } from "../../..";
import { Chain } from "../chain";
// import { TaskStateBase, TaskStateBaseProps } from "./task-base";
import { FieldUtils } from "../fields";
import { noEmptyObject } from "../private/util";
import { StateGraph } from "../state-graph";
import {
  IStepFunctionsTask,
  StepFunctionsTaskConfig,
} from "../step-functions-task";
import { CatchProps, IChainable, INextable, RetryProps } from "../types";

// TODO: replace by service integration specific classes (i.e. LambdaInvoke, SnsPublish)
// https://github.com/aws/aws-cdk/blob/v2.160.0/packages/aws-cdk-lib/aws-stepfunctions-tasks/README.md

/**
 * Props that are common to all tasks
 */
export interface TaskProps {
  /**
   * Actual task to be invoked in this workflow
   */
  readonly task: IStepFunctionsTask;

  /**
   * Optional name for this state
   *
   * @default - The construct ID will be used as state name
   */
  readonly stateName?: string;

  /**
   * An optional description for this state
   *
   * @default No comment
   */
  readonly comment?: string;

  /**
   * JSONPath expression to select part of the state to be the input to this state.
   *
   * May also be the special value JsonPath.DISCARD, which will cause the effective
   * input to be the empty object {}.
   *
   * @default $
   */
  readonly inputPath?: string;

  /**
   * JSONPath expression to select part of the state to be the output to this state.
   *
   * May also be the special value JsonPath.DISCARD, which will cause the effective
   * output to be the empty object {}.
   *
   * @default $
   */
  readonly outputPath?: string;

  /**
   * JSONPath expression to indicate where to inject the state's output
   *
   * May also be the special value JsonPath.DISCARD, which will cause the state's
   * input to become its output.
   *
   * @default $
   */
  readonly resultPath?: string;

  /**
   * Parameters to invoke the task with
   *
   * It is not recommended to use this field. The object that is passed in
   * the `task` property will take care of returning the right values for the
   * `Parameters` field in the Step Functions definition.
   *
   * The various classes that implement `IStepFunctionsTask` will take a
   * properties which make sense for the task type. For example, for
   * `InvokeFunction` the field that populates the `parameters` field will be
   * called `payload`, and for the `PublishToTopic` the `parameters` field
   * will be populated via a combination of the referenced topic, subject and
   * message.
   *
   * If passed anyway, the keys in this map will override the parameters
   * returned by the task object.
   *
   * @see
   * https://docs.aws.amazon.com/step-functions/latest/dg/input-output-inputpath-params.html#input-output-parameters
   *
   * @default - Use the parameters implied by the `task` property
   */
  readonly parameters?: { [name: string]: any };

  /**
   * Maximum run time of this state
   *
   * If the state takes longer than this amount of time to complete, a 'Timeout' error is raised.
   *
   * @default 60
   */
  readonly timeout?: Duration;
}

/**
 * Define a Task state in the state machine
 *
 * Reaching a Task state causes some work to be executed, represented by the
 * Task's resource property. Task constructs represent a generic Amazon
 * States Language Task.
 *
 * For some resource types, more specific subclasses of Task may be available
 * which are more convenient to use.
 */
export class Task extends State implements INextable {
  // TODO: replace by service integration specific classes (i.e. LambdaInvoke, SnsPublish)
  // ref: aws-stepfunctions-tasks/README.md
  public readonly endStates: INextable[];
  private readonly timeout?: Duration;
  private readonly taskProps: StepFunctionsTaskConfig;

  constructor(scope: Construct, id: string, props: TaskProps) {
    super(scope, id, props);

    this.timeout = props.timeout;
    const taskProps = props.task.bind(this);

    this.taskProps = {
      ...taskProps,
      parameters: noEmptyObject({
        ...(taskProps.parameters || {}),
        ...(props.parameters || {}),
      }),
    };
    this.endStates = [this];
  }

  /**
   * Add retry configuration for this state
   *
   * This controls if and how the execution will be retried if a particular
   * error occurs.
   */
  public addRetry(props: RetryProps = {}): Task {
    super._addRetry(props);
    return this;
  }

  /**
   * Add a recovery handler for this state
   *
   * When a particular error occurs, execution will continue at the error
   * handler instead of failing the state machine execution.
   */
  public addCatch(handler: IChainable, props: CatchProps = {}): Task {
    super._addCatch(handler.startState, props);
    return this;
  }

  /**
   * Continue normal execution with the given state
   */
  public next(next: IChainable): Chain {
    super.makeNext(next.startState);
    return Chain.sequence(this, next);
  }

  /**
   * Return the Amazon States Language object for this state
   */
  public toStateJson(): object {
    return {
      ...this.renderNextEnd(),
      ...this.renderRetryCatch(),
      ...this.renderInputOutput(),
      Type: StateType.TASK,
      Comment: this.comment,
      Resource: this.taskProps.resourceArn,
      Parameters:
        this.taskProps.parameters &&
        FieldUtils.renderObject(this.taskProps.parameters),
      ResultPath: renderJsonPath(this.resultPath),
      TimeoutSeconds: this.timeout && this.timeout.toSeconds(),
      HeartbeatSeconds:
        this.taskProps.heartbeat && this.taskProps.heartbeat.toSeconds(),
    };
  }

  // TODO: Re-add CloudWatch metrics

  protected whenBoundToGraph(graph: StateGraph) {
    super.whenBoundToGraph(graph);
    for (const policyStatement of this.taskProps.policyStatements || []) {
      graph.registerPolicyStatement(policyStatement);
    }
  }
}
