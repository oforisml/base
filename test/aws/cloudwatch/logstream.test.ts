// import { Template } from "../../assertions";
import { Testing } from "cdktf";
import { AwsSpec } from "../../../src/aws";
import { LogGroup, LogStream } from "../../../src/aws/cloudwatch";

const gridUUID = "123e4567-e89b-12d3";

describe("log stream", () => {
  test("simple instantiation", () => {
    // GIVEN
    const app = Testing.app();
    const spec = new AwsSpec(app, `TestSpec`, {
      environmentName: "Test",
      gridUUID,
      providerConfig: {
        region: "us-east-1",
      },
      gridBackendConfig: {
        address: "http://localhost:3000",
      },
    });

    // WHEN
    const logGroup = new LogGroup(spec, "LogGroup");

    new LogStream(spec, "Stream", {
      logGroup,
    });

    // THEN
    // Do prepare run to resolve all Terraform resources
    spec.prepareStack();
    const synthesized = Testing.synth(spec);
    expect(synthesized).toMatchSnapshot();
    // Template.fromStack(spec).hasResourceProperties("AWS::Logs::LogStream", {});
  });
});
