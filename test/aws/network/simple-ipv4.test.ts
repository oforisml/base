import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { network, AwsSpec } from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const providerConfig = { region: "us-east-1" };
describe("Environment", () => {
  test("Should synth and match SnapShot", () => {
    // GIVEN
    const app = Testing.app();
    const spec = new AwsSpec(app, "TestSpec", {
      providerConfig,
    });
    // WHEN
    new network.SimpleIPv4(spec, "network", {
      environmentName,
      gridUUID,
      config: {
        ipv4CidrBlock: "10.0.0.0/16",
        internalDomain: "example.local",
      },
    });
    // THEN
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should support adding subnet groups", () => {
    // GIVEN
    const app = Testing.app();
    const spec = new AwsSpec(app, "TestSpec", {
      providerConfig,
    });
    // WHEN
    const vpc = new network.SimpleIPv4(spec, "network", {
      environmentName,
      gridUUID,
      config: {
        ipv4CidrBlock: "10.0.0.0/16",
        internalDomain: "example.local",
      },
    });
    vpc.enableDbSubnetGroup();
    vpc.enableElastiCacheSubnetGroup();
    // THEN
    expect(Testing.synth(spec)).toHaveResource({
      tfResourceType: "aws_db_subnet_group",
    });
    expect(Testing.synth(spec)).toHaveResource({
      tfResourceType: "aws_elasticache_subnet_group",
    });
  });
});
