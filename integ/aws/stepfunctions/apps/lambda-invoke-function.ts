// https://github.com/aws/aws-cdk/blob/v2.164.1/packages/%40aws-cdk-testing/framework-integ/test/aws-stepfunctions-tasks/test/lambda/integ.invoke-function.ts
import * as path from "path";
import { App, LocalBackend } from "cdktf";
import { aws, Duration } from "../../../../src";

const environmentName = process.env.ENVIRONMENT_NAME ?? "test";
const region = process.env.AWS_REGION ?? "us-east-1";
const outdir = process.env.OUT_DIR ?? "cdktf.out";
const stackName = process.env.STACK_NAME ?? "lambda-invoke-function";

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

const submitJob = new aws.compute.tasks.LambdaInvoke(spec, "InvokeHandler", {
  lambdaFunction: new aws.compute.NodejsFunction(spec, "Handler", {
    path: path.join(__dirname, "handlers", "hello-world", "index.ts"),
  }),
  resultPath: "$.response",
});

const callBackHandler = new aws.compute.NodejsFunction(
  spec,
  "CallbackHandler",
  {
    path: path.join(__dirname, "handlers", "callback", "index.ts"),
  },
);
callBackHandler.addToRolePolicy(
  new aws.iam.PolicyStatement({
    actions: ["states:SendTaskSuccess", "states:SendTaskFailure"],
    resources: ["*"],
  }),
);
const taskTokenHandler = new aws.compute.tasks.LambdaInvoke(
  spec,
  "InvokeHandlerWithTaskToken",
  {
    lambdaFunction: callBackHandler,
    integrationPattern: aws.compute.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    payload: aws.compute.TaskInput.fromObject({
      token: aws.compute.JsonPath.taskToken,
    }),
    inputPath: "$.guid",
    resultPath: "$.callback",
  },
);

const isComplete = new aws.compute.Choice(spec, "Job Complete?");
const jobFailed = new aws.compute.Fail(spec, "Job Failed", {
  cause: "AWS Batch Job Failed",
  error: "DescribeJob returned FAILED",
});
const finalStatus = new aws.compute.Pass(spec, "Final step");

const chain = aws.compute.Chain.start(submitJob)
  .next(taskTokenHandler)
  .next(
    isComplete
      .when(
        aws.compute.Condition.stringEquals("$.callback.status", "FAILED"),
        jobFailed,
      )
      .when(
        aws.compute.Condition.stringEquals("$.callback.status", "SUCCEEDED"),
        finalStatus,
      ),
  );

new aws.compute.StateMachine(spec, "StateMachine", {
  definitionBody: aws.compute.DefinitionBody.fromChainable(chain),
  timeout: Duration.seconds(30),
  registerOutputs: true,
  outputName: "state_machine",
});

app.synth();
