import { Testing } from "cdktf";
import "cdktf/lib/testing/adapters/jest";
import { Duration } from "../../../src/";
import { notify, AwsSpec } from "../../../src/aws";

const environmentName = "Test";
const gridUUID = "123e4567-e89b-12d3";
const gridBackendConfig = {
  address: "http://localhost:3000",
};
const providerConfig = { region: "us-east-1" };
describe("Queue", () => {
  test("Should synth and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    new notify.Queue(spec, "HelloWorld");
    // THEN
    spec.prepareStack(); // may generate additional resources
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should synth and match SnapShot with prefix", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    new notify.Queue(spec, "HelloWorld", {
      namePrefix: "hello-world",
      // encryption: QueueEncryption.KMS_MANAGED, //TODO: Re-add KMS encryption
      messageRetentionSeconds: Duration.days(14).toSeconds(),
      visibilityTimeoutSeconds: Duration.minutes(15).toSeconds(),
    });
    // THEN
    spec.prepareStack(); // may generate additional resources
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should synth with DLQ and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    const deadLetterQueue = new notify.Queue(spec, "DLQ", {
      // encryption: QueueEncryption.KMS_MANAGED, //TODO: Re-add KMS encryption
      messageRetentionSeconds: Duration.days(14).toSeconds(),
      visibilityTimeoutSeconds: Duration.minutes(15).toSeconds(),
    });
    new notify.Queue(spec, "Queue", {
      deadLetterQueue: {
        maxReceiveCount: 5,
        queue: deadLetterQueue,
      },
      // encryption: QueueEncryption.KMS_MANAGED, //TODO: Re-add KMS encryption
      messageRetentionSeconds: Duration.days(14).toSeconds(),
      visibilityTimeoutSeconds: Duration.minutes(15).toSeconds(),
    });
    // THEN
    spec.prepareStack(); // may generate additional resources
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should synth with fifo suffix and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    new notify.Queue(spec, "Queue", {
      namePrefix: "queue.fifo",
      // encryption: QueueEncryption.KMS_MANAGED, //TODO: Re-add KMS encryption
      messageRetentionSeconds: Duration.days(14).toSeconds(),
      visibilityTimeoutSeconds: Duration.minutes(15).toSeconds(),
    });
    // THEN
    spec.prepareStack(); // may generate additional resources
    expect(Testing.synth(spec)).toMatchSnapshot();
  });
  test("Should synth with contentBasedDeduplication and match SnapShot", () => {
    // GIVEN
    const spec = getAwsSpec();
    // WHEN
    new notify.Queue(spec, "Queue", {
      // encryption: QueueEncryption.KMS_MANAGED, //TODO: Re-add KMS encryption
      contentBasedDeduplication: true,
      messageRetentionSeconds: Duration.days(14).toSeconds(),
      visibilityTimeoutSeconds: Duration.minutes(15).toSeconds(),
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
