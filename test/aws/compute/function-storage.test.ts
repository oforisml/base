import path from "path";
import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { Duration } from "../../../src/";
import {
  compute,
  storage,
  notify,
  AwsSpec,
  AwsAccessLevels,
} from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const gridBackendConfig = {
  address: "http://localhost:3000",
};
const providerConfig = { region: "us-east-1" };
describe("Function with Storage", () => {
  test("Should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    const fn = new compute.NodejsFunction(spec, "HelloWorld", {
      path: path.join(__dirname, "fixtures", "hello-world.ts"),
    });
    const bucket = new storage.Bucket(spec, "HelloWorldBucket", {
      namePrefix: "hello-world",
    });
    fn.bucketPermissions(bucket, AwsAccessLevels.READ);
    // THEN
    spec.prepareStack(); // required to add last minute resources to the stack
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
});

describe("Function with event rules", () => {
  test("Should handle dependencies on permissions", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    const fn = new compute.NodejsFunction(spec, "HelloWorld", {
      path: path.join(__dirname, "fixtures", "hello-world.ts"),
    });
    const rule = new notify.Rule(spec, "HelloWorldRule", {
      schedule: notify.Schedule.rate(Duration.days(1)),
      targets: {
        follower: {
          arn: fn.functionOutputs.arn,
        },
      },
    });
    fn.addPermission("InvokeByCloudwatch", {
      principal: "events.amazonaws.com",
      action: "lambda:InvokeFunction",
      sourceArn: rule.ruleOutputs.arn,
      dependees: [rule.resource],
    });
    // THEN
    spec.prepareStack(); // required to add last minute resources to the stack
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
});

function getAwsSpec(): AwsSpec {
  const app = Testing.app();
  return new AwsSpec(app, "TestSpec", {
    environmentName,
    gridUUID,
    providerConfig,
    gridBackendConfig,
  });
}
