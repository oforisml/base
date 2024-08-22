import * as path from "path";
import { App, LocalBackend } from "cdktf";
import { aws } from "../../../../src";

const environmentName = process.env.ENVIRONMENT_NAME ?? "test";
const region = process.env.AWS_REGION ?? "us-east-1";
const outdir = process.env.OUT_DIR ?? "cdktf.out";
const stackName = process.env.STACK_NAME ?? "nodejs-function-url";

const app = new App({
  outdir,
});
const stack = new aws.AwsSpec(app, stackName, {
  gridUUID: "12345678-1234",
  environmentName,
  // gridBackendConfig: {
  //   address: "localhost:3234",
  // },
  providerConfig: {
    region,
  },
});
// TODO: use E.T. e2e s3 backend?
new LocalBackend(stack, {
  path: `${stackName}.tfstate`,
});

// create a VPC with 2 AZs
const azCount = 2;
const network = new aws.network.SimpleIPv4Vpc(stack, "default", {
  internalDomain: "example.com",
  ipv4CidrBlock: "10.0.0.0/16",
  natGatewayOption: aws.network.NatGatewayOption.SINGLE_NAT_GATEWAY,
  azCount,
});

// add a public echo endpoint for network connectivity tests
const echoLambda = new aws.compute.NodejsFunction(stack, "Echo", {
  path: path.join(__dirname, "handlers", "echo", "index.ts"),
  environment: {
    NAME: "simple-ipv4-test",
  },
  registerOutputs: true,
  outputName: "echo",
});
echoLambda.addUrl({
  authorizationType: "NONE",
  cors: {
    allowCredentials: true,
    allowOrigins: ["*"],
    allowMethods: ["*"],
    allowHeaders: ["date", "keep-alive"],
    exposeHeaders: ["keep-alive", "date"],
    maxAge: 86400,
  },
});

// add lambdas to test connectivity from all private subnets to public echo endpoint
for (let i = 0; i < azCount; i++) {
  new aws.compute.NodejsFunction(stack, `PrivateFetchIp${i}`, {
    path: path.join(__dirname, "handlers", "fetch-ip", "index.ts"),
    networkConfig: {
      vpcId: network.vpcId, // errors if not set :( - ideally this could be inferred?
      subnetIds: [network.privateSubnets[i].subnetId],
    },
    registerOutputs: true,
    outputName: "private_fetch_ip_" + i,
  });
  new aws.compute.NodejsFunction(stack, `DataFetchIp${i}`, {
    path: path.join(__dirname, "handlers", "fetch-ip", "index.ts"),
    networkConfig: {
      vpcId: network.vpcId,
      subnetIds: [network.dataSubnets[i].subnetId],
    },
    registerOutputs: true,
    outputName: "data_fetch_ip_" + i,
  });
}

app.synth();
