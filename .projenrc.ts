import { cdk, javascript, TextFile } from "projen";
import { AwsProviderStructBuilder } from "./projenrc/aws-provider-struct-builder";

// set strict node version
const nodeVersion = "20";

const project = new cdk.JsiiProject({
  name: "@envtio/base",
  npmAccess: javascript.NpmAccess.PUBLIC,
  author: "Vincent De Smet",
  authorAddress: "vincent.drl@gmail.com",
  repositoryUrl: "https://github.com/envtio/base",
  defaultReleaseBranch: "main",
  typescriptVersion: "~5.4",
  jsiiVersion: "~5.4",
  packageManager: javascript.NodePackageManager.PNPM,
  pnpmVersion: "9",
  projenrcTs: true,
  prettier: true,
  eslint: true,

  // release config
  release: true,
  releaseToNpm: true,
  // disable auto generation of API reference for now
  docgen: false,

  // cdktf construct lib config
  peerDeps: [
    "cdktf@^0.20.8",
    "@cdktf/provider-aws@^19.28.0",
    "constructs@^10.3.0",
  ],
  devDeps: [
    "cdktf@^0.20.8",
    "@cdktf/provider-aws@^19.28.0",
    "constructs@^10.3.0",
    "@mrgrain/jsii-struct-builder",
  ],

  workflowNodeVersion: nodeVersion,

  jestOptions: {
    jestConfig: {
      setupFilesAfterEnv: ["<rootDir>/setup.js"],
    },
  },

  licensed: true,
  license: "GPL-3.0-or-later",

  // disable autoMerge for now
  autoMerge: false,
});

// override harcoded jest testMatch patterns :(
// https://github.com/projen/projen/blob/8b225dcdacb3aacebf368b2e06abdbb39d62c0dc/src/javascript/jest.ts#L861
project.tryFindObjectFile("package.json")?.addOverride("jest.testMatch", [
  "<rootDir>/@(src|test)/**/*(*.)@(test).ts?(x)", // remove spec.ts from pattern
  "<rootDir>/@(src|test)/**/__tests__/**/*.ts?(x)", // default
  "<rootDir>/@(projenrc)/**/*(*.)@(test).ts?(x)", // remove spec.ts from pattern
  "<rootDir>/@(projenrc)/**/__tests__/**/*.ts?(x)", // default
]);

project.gitignore.exclude(".env");

project.package.addEngine("node", nodeVersion);
new TextFile(project, ".nvmrc", {
  lines: [nodeVersion],
});

// required to support bundled dependencies
// https://github.com/pnpm/pnpm/issues/844#issuecomment-1120104431
project.npmrc?.addConfig("node-linker", "hoisted");

new AwsProviderStructBuilder(project);

project.synth();
