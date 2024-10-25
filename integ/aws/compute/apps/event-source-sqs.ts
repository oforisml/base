// https://github.com/aws/aws-cdk/blob/v2.161.1/packages/%40aws-cdk-testing/framework-integ/test/aws-lambda-event-sources/test/integ.sqs.ts
import * as path from "path";
import { App, LocalBackend, TerraformOutput } from "cdktf";
import { Construct } from "constructs";
import { aws } from "../../../../src";

const environmentName = process.env.ENVIRONMENT_NAME ?? "test";
const region = process.env.AWS_REGION ?? "us-east-1";
const outdir = process.env.OUT_DIR ?? "cdktf.out";
const stackName = process.env.STACK_NAME ?? "event-source-sqs";

class SqsEventSourceTest extends aws.AwsSpec {
  constructor(scope: Construct, id: string, props: aws.AwsSpecProps) {
    super(scope, id, props);

    const fn = new aws.compute.NodejsFunction(this, "F", {
      path: path.join(__dirname, "handlers", "log-event", "index.ts"),
      loggingFormat: aws.compute.LoggingFormat.JSON,
      registerOutputs: true,
      outputName: "function",
    });
    const queue = new aws.notify.Queue(this, "Q", {
      registerOutputs: true,
      outputName: "queue",
    });
    const eventSource = new aws.compute.sources.SqsEventSource(queue, {
      batchSize: 5,
    });

    fn.addEventSource(eventSource);

    new TerraformOutput(this, "OutputEventSourceMappingArn", {
      value: eventSource.eventSourceMappingArn,
      staticId: true,
    });
  }
}

const app = new App({
  outdir,
});

const spec = new SqsEventSourceTest(app, stackName, {
  gridUUID: "12345678-1234",
  environmentName,
  providerConfig: {
    region,
  },
});
new LocalBackend(spec, {
  path: `${stackName}.tfstate`,
});

app.synth();