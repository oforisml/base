// https://github.com/aws/aws-cdk/blob/v2.164.1/packages/%40aws-cdk-testing/framework-integ/test/aws-stepfunctions-tasks/test/aws-sdk/integ.call-aws-service-sfn.ts
import { App, LocalBackend } from "cdktf";
import { aws } from "../../../../src";

const environmentName = process.env.ENVIRONMENT_NAME ?? "test";
const region = process.env.AWS_REGION ?? "us-east-1";
const outdir = process.env.OUT_DIR ?? "cdktf.out";
const stackName = process.env.STACK_NAME ?? "call-aws-service-sfn";

const app = new App({
  outdir,
});
const spec = new aws.AwsSpec(app, stackName, {
  gridUUID: "12345678-1234",
  environmentName,
  providerConfig: {
    region,
  },
});
new LocalBackend(spec, {
  path: `${stackName}.tfstate`,
});

const task = new aws.compute.tasks.CallAwsService(spec, "SendTaskSuccess", {
  service: "sfn",
  action: "sendTaskSuccess",
  iamResources: ["*"],
  parameters: {
    Output: aws.compute.JsonPath.objectAt("$.output"),
    TaskToken: aws.compute.JsonPath.stringAt("$.taskToken"),
  },
});

const childStateMachine = new aws.compute.StateMachine(
  spec,
  "ChildStateMachine",
  {
    definitionBody: aws.compute.DefinitionBody.fromChainable(task),
  },
);

new aws.compute.StateMachine(spec, "ParentStateMachine", {
  definitionBody: aws.compute.DefinitionBody.fromChainable(
    new aws.compute.tasks.StepFunctionsStartExecution(
      spec,
      "StepFunctionsStartExecution",
      {
        stateMachine: childStateMachine,
        integrationPattern: aws.compute.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        input: aws.compute.TaskInput.fromObject({
          output: aws.compute.JsonPath.entirePayload,
          taskToken: aws.compute.JsonPath.taskToken,
        }),
      },
    ),
  ),
  registerOutputs: true,
  outputName: "state_machine",
});

app.synth();
