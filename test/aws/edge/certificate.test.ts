import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { edge, AwsSpec } from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const gridBackendConfig = {
  address: "http://localhost:3000",
};
const providerConfig = { region: "us-east-1" };
describe("PublicCertificate", () => {
  test("Create should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    const zone = new edge.DnsZone(spec, "Zone", {
      zoneName: "example.com",
    });
    // WHEN
    new edge.PublicCertificate(spec, "Certificate", {
      domainName: "example.com",
      subjectAlternativeNames: ["*.example.com"],
      validation: {
        method: edge.ValidationMethod.DNS,
        hostedZone: zone,
      },
      lifecycle: {
        createBeforeDestroy: true,
      },
    });
    // THEN
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Create multi-zone should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    const zone1 = new edge.DnsZone(spec, "ExampleNetZone", {
      zoneName: "example.net",
    });
    const zone2 = new edge.DnsZone(spec, "ExampleComZone", {
      zoneName: "example.com",
    });
    // WHEN
    new edge.PublicCertificate(spec, "Certificate", {
      domainName: "example.net",
      subjectAlternativeNames: [
        "*.example.net",
        "example.com",
        "*.example.com",
      ],
      validation: {
        method: edge.ValidationMethod.DNS,
        hostedZones: {
          "example.net": zone1,
          "example.com": zone2,
        },
      },
      lifecycle: {
        createBeforeDestroy: true,
      },
    });
    // THEN
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Imported DnsZone should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    const zone = edge.DnsZone.fromZoneId(spec, "Zone", "Z1234567890");
    // WHEN
    new edge.PublicCertificate(spec, "Certificate", {
      domainName: "example.com",
      subjectAlternativeNames: ["*.example.com"],
      validation: {
        method: edge.ValidationMethod.DNS,
        hostedZone: zone,
      },
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
    gridBackendConfig,
  });
}
