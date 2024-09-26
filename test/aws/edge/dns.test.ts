import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { edge, storage, AwsSpec } from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const gridBackendConfig = {
  address: "http://localhost:3000",
};
const providerConfig = { region: "us-east-1" };
const ipAddress = "123.123.123.0";
describe("DnsZone", () => {
  test("Create should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    const bucket = new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      websiteConfig: {
        enabled: true,
      },
    });
    const distribution = new edge.Distribution(spec, "HelloWorldDistribution", {
      defaultBehavior: {
        origin: new edge.S3Origin(bucket),
      },
    });
    // WHEN
    const zone = new edge.DnsZone(spec, "Zone", {
      zoneName: "example.com",
    });
    new edge.ARecord(spec, "ARecordApex", {
      zone,
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    new edge.ARecord(spec, "ARecordBar", {
      zone,
      recordName: "bar",
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    new edge.ARecord(spec, "BucketAlias", {
      zone,
      recordName: "hello-world-bucket",
      target: edge.RecordTarget.fromAlias(new edge.BucketWebsiteTarget(bucket)),
    });
    new edge.ARecord(spec, "CdnAlias", {
      zone,
      recordName: "hello-world-cdn",
      target: edge.RecordTarget.fromAlias(
        new edge.DistributionTarget(distribution),
      ),
    });
    // Weighted routing policy
    new edge.ARecord(spec, "WeightedA", {
      zone,
      recordName: "weighted",
      weight: 80,
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    new edge.ARecord(spec, "WeightedB", {
      zone,
      recordName: "weighted",
      weight: 20,
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    // Latency routing policy
    new edge.ARecord(spec, "LatencyA", {
      zone,
      recordName: "latency",
      region: "us-east-1",
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    new edge.ARecord(spec, "LatencyB", {
      zone,
      recordName: "latency",
      region: "ap-southeast-1",
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    // THEN
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Import should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    const zone = edge.DnsZone.fromZoneId(spec, "Zone", "Z1234567890");
    new edge.ARecord(spec, "ARecordApex", {
      zone, // without recordName should point to data source zoneName
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    new edge.ARecord(spec, "ARecordBar", {
      zone, // with recordName
      recordName: "bar",
      target: edge.RecordTarget.fromValues(ipAddress),
    });
    // THEN
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should throw error if bucket has no website config", () => {
    // GIVEN
    const spec = getAwsSpec();
    const zone = edge.DnsZone.fromZoneId(spec, "Zone", "Z1234567890");
    // WHEN
    const bucket = new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
    });
    // THEN
    expect(() => {
      new edge.ARecord(spec, "HelloWorldAlias", {
        zone,
        target: edge.RecordTarget.fromAlias(
          new edge.BucketWebsiteTarget(bucket),
        ),
      });
    }).toThrow("Cannot use a non-website bucket");
  });
  test("Should throw error if multiple routing policies are provided", () => {
    // GIVEN
    const spec = getAwsSpec();
    const zone = edge.DnsZone.fromZoneId(spec, "Zone", "Z1234567890");
    // THEN
    expect(() => {
      new edge.ARecord(spec, "HelloWorldRouting", {
        zone,
        weight: 80,
        region: "us-east-1",
        target: edge.RecordTarget.fromValues(ipAddress),
      });
    }).toThrow("Only one of");
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
