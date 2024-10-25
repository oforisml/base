import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { edge, storage, AwsSpec } from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const gridBackendConfig = {
  address: "http://localhost:3000",
};
const providerConfig = { region: "us-east-1" };
describe("Distribution", () => {
  test("Should synth with OAI and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    const bucket = new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      cloudfrontAccess: {
        enabled: true,
      },
    });
    // WHEN
    new edge.Distribution(spec, "HelloWorldDistribution", {
      defaultBehavior: {
        origin: new edge.S3Origin(bucket),
      },
    });
    // THEN
    spec.prepareStack(); // may generate additional resources
    const result = Testing.synth(spec);
    expect(result).toMatchSnapshot();
    expect(result).toHaveDataSourceWithProperties(
      {
        tfResourceType: "aws_iam_policy_document",
      },
      {
        statement: [
          {
            actions: ["s3:GetObject"],
            effect: "Allow",
            principals: [
              {
                identifiers: [
                  "${aws_cloudfront_origin_access_identity.HelloWorld_OriginAccessIdentity_5B20D425.iam_arn}",
                ],
                type: "AWS",
              },
            ],
            resources: ["${aws_s3_bucket.HelloWorld_7964D1E8.arn}/*"],
          },
        ],
      },
    );
  });
  test("Should synth with websiteConfig and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    const bucket = new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      websiteConfig: {
        enabled: true,
      },
    });
    // WHEN
    new edge.Distribution(spec, "HelloWorldDistribution", {
      defaultBehavior: {
        origin: new edge.S3Origin(bucket),
      },
    });
    // THEN
    spec.prepareStack(); // may generate additional resources
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should throw error if bucket has no OAI or website config", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    const bucket = new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
    });
    // THEN
    expect(() => {
      new edge.Distribution(spec, "HelloWorldDistribution", {
        defaultBehavior: {
          origin: new edge.S3Origin(bucket),
        },
      });
    }).toThrow("must have an origin access identity");
  });
  test("Should support multiple origins and cache behaviors", () => {
    // GIVEN
    const spec = getAwsSpec();
    const bucket0 = new storage.Bucket(spec, "Bucket0", {
      namePrefix: "bucket-0",
      websiteConfig: {
        enabled: true,
      },
    });
    const bucket1 = new storage.Bucket(spec, "Bucket1", {
      namePrefix: "bucket-1",
      websiteConfig: {
        enabled: true,
      },
    });
    // WHEN
    new edge.Distribution(spec, "HelloWorldDistribution", {
      defaultBehavior: {
        origin: new edge.S3Origin(bucket0),
      },
      additionalBehaviors: {
        "/images/*": {
          origin: new edge.S3Origin(bucket1),
        },
      },
    });
    // THEN
    spec.prepareStack(); // may generate additional resources
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
