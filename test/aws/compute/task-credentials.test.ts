import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { iam, compute, AwsSpec } from "../../../src/aws";

const gridUUID = "123e4567-e89b-12d3";
describe("TaskRole", () => {
  let spec: AwsSpec;
  beforeEach(() => {
    // GIVEN
    const app = Testing.app();
    spec = new AwsSpec(app, `TestSpec`, {
      environmentName: "Test",
      gridUUID,
      providerConfig: {
        region: "us-east-1",
      },
      gridBackendConfig: {
        address: "http://localhost:3000",
      },
    });
  });

  describe("fromRole()", () => {
    test("returns expected roleArn and resource", () => {
      const iamRole = iam.Role.fromRoleArn(
        spec,
        "Role",
        "arn:aws:iam::123456789012:role/example-role",
      );
      const role = compute.TaskRole.fromRole(iamRole);

      expect(spec.resolve(role.roleArn)).toEqual(
        "arn:aws:iam::123456789012:role/example-role",
      );
      expect(role.resource).toEqual(
        "arn:aws:iam::123456789012:role/example-role",
      );
    });
  });

  describe("fromRoleArnJsonPath()", () => {
    test("returns expected roleArn and resource", () => {
      const role = compute.TaskRole.fromRoleArnJsonPath("$.RoleArn");

      expect(spec.resolve(role.roleArn)).toEqual("$.RoleArn");
      expect(role.resource).toEqual("*");
    });

    test("returns expected roleArn and resource", () => {
      expect(() => compute.TaskRole.fromRoleArnJsonPath("RoleArn")).toThrow();
    });
  });
});
