import * as path from "path";
import { App, LocalBackend } from "cdktf";
import { aws } from "../../../../src";

// Define the output directory (outdir/stackName)
const outdir = "cdktf.out";
const stackName = "simple-ipv4-vpc";

const app = new App({
  outdir,
});
const stack = new aws.AwsSpec(app, stackName, {
  environmentName: "test",
  gridUUID: "12345678-1234",
  // gridBackendConfig: {
  //   address: "localhost:3234",
  // },
  providerConfig: {
    region: "us-east-1",
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
