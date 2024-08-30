import path from "path";
import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { staticsite, AwsSpec } from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const providerConfig = { region: "us-east-1" };
describe("Bucket", () => {
  test("Should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    new staticsite.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      path: path.join(__dirname, "fixtures", "site"),
      websiteConfig: {
        enabled: true,
      },
      public: true,
    });
    // THEN
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
});

function getAwsSpec(): AwsSpec {
  const app = Testing.app();
  return new AwsSpec(app, "TestSpec", {
    environmentName,
    gridUUID,
    providerConfig,
  });
}
