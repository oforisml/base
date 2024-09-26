import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { storage, AwsSpec } from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const gridBackendConfig = {
  address: "http://localhost:3000",
};
const providerConfig = { region: "us-east-1" };
describe("Bucket", () => {
  test("Should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      sources: path.join(__dirname, "fixtures", "site"),
      websiteConfig: {
        enabled: true,
      },
      public: true,
    });
    // THEN
    spec.prepareStack(); // required to generate S3Objects
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should support multiple sources", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    const tempfile = new TempFile("sample.html", "sample");
    new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      sources: [path.join(__dirname, "fixtures", "site"), tempfile.dir],
      websiteConfig: {
        enabled: true,
      },
      versioned: true,
      registerOutputs: true,
    });
    // THEN
    spec.prepareStack(); // required to generate S3Objects
    // const result = Testing.synth(spec);

    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should throw error if bucket source is a file", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    const tempfile = new TempFile("sample.html", "sample");
    // THEN
    new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      sources: tempfile.path,
    });
    expect(() => {
      spec.prepareStack();
    }).toThrow("expects path to point to a directory");
  });
  test("Should sleep on versioning if enabled", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    new storage.Bucket(spec, "HelloWorld", {
      namePrefix: "hello-world",
      sources: path.join(__dirname, "fixtures", "site"),
      websiteConfig: {
        enabled: true,
      },
      versioned: true,
    });
    // THEN
    spec.prepareStack(); // required to generate S3Objects
    const result = Testing.synth(spec);
    expect(result).toHaveResource({
      tfResourceType: "time_sleep",
    });
    expect(result).toHaveResourceWithProperties(
      {
        tfResourceType: "aws_s3_object",
      },
      {
        depends_on: expect.arrayContaining([
          expect.stringContaining("time_sleep"),
        ]),
      },
    );
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

export class TempFile {
  public readonly path: string;
  public readonly dir: string;
  public constructor(filename: string, content: string) {
    this.dir = mkdtempSync(path.join(tmpdir(), "chtempfile"));
    this.path = path.join(this.dir, filename);
    writeFileSync(this.path, content);
  }
}
