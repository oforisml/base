// source: https://github.com/cdktf-plus/cdktf-plus/blob/586aabad3ab2fb2a2e93e05ed33f94474ebe9397/packages/%40cdktf-plus/aws/lib/nodejs-function/index.ts
import * as path from "path";
import { TerraformAsset, AssetType } from "cdktf";
import { Construct } from "constructs";
// This might be 10x slower than a native build - see https://esbuild.github.io/getting-started/#wasm
import { buildSync } from "esbuild-wasm";
import { LambdaFunction, FunctionProps } from "./function";
import { IFunction } from "./function-base";

export interface NodejsFunctionProps extends FunctionProps {
  /**
   * The path to the Handler entry point script, relative to the Spec file.
   *
   * This script will be bundled using
   * [esbuild-wasm](https://esbuild.github.io/getting-started/#wasm).
   */
  readonly path: string;
  /**
   * You can mark a file or a package as external to exclude it from your
   * build. Instead of being bundled, the import will be preserved (using
   * require for the iife and cjs formats and using import for the esm
   * format) and will be evaluated at run time instead.
   *
   * @link https://esbuild.github.io/api/#external
   *
   * @default []
   */
  readonly external?: string[];
  /**
   * The NodeJS runtime for the Lambda function.
   *
   * @link https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html#runtimes-supported
   *
   * @default "nodejs20.x"
   */
  readonly runtime?: "nodejs18.x" | "nodejs20.x";
}

const bundle = (
  workingDirectory: string,
  entryPoint: string,
  external?: string[],
) => {
  buildSync({
    entryPoints: [entryPoint],
    platform: "node",
    target: "es2018",
    bundle: true,
    format: "cjs",
    sourcemap: "external",
    external,
    outdir: "dist",
    absWorkingDir: workingDirectory,
  });

  return path.join(workingDirectory, "dist");
};

/**
 * Provides a NodeJS Lambda Function. Lambda allows you to trigger execution
 * of code in response to events in AWS, enabling serverless backend solutions.
 *
 * The Lambda Function itself will be bundled using
 * [esbuild-wasm](https://esbuild.github.io/getting-started/#wasm).
 *
 * For example:
 *
 * ```ts
 * const fn = new compute.NodejsFunction(spec, "HelloWorld", {
 *   path: path.join(__dirname, "handlers", "hello-world.ts"),
 * });
 * ```
 *
 * @resource aws_lambda_function
 * @beacon-class compute.IFunction
 */
export class NodejsFunction extends LambdaFunction implements IFunction {
  public readonly asset: TerraformAsset;
  public readonly bundledPath: string;

  constructor(scope: Construct, id: string, config: NodejsFunctionProps) {
    const { path: filePath, ...rest } = config;
    super(scope, id, rest);

    const workingDirectory = path.resolve(path.dirname(config.path));
    const distPath = bundle(
      workingDirectory,
      path.basename(config.path),
      config.external,
    );
    this.bundledPath = path.join(
      distPath,
      `${path.basename(config.path, ".ts")}.js`,
    );

    // TODO: Implement Code && Runtime
    // https://github.com/aws/aws-cdk/blob/v2.156.0/packages/aws-cdk-lib/aws-lambda/lib/code.ts
    this.asset = new TerraformAsset(this, "NodejsAsset", {
      path: distPath,
      type: AssetType.ARCHIVE,
    });

    const fileName = path.basename(config.path, ".ts");

    this.resource.handler = `${fileName}.handler`;
    // NOTE: for the underlaying resource, Exactly one of filename, image_uri, or s3_bucket must be specified
    this.resource.filename = this.asset.path;
    this.resource.sourceCodeHash = this.asset.assetHash;
    // https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html#runtimes-supported
    // https://docs.aws.amazon.com/lambda/latest/api/API_CreateFunction.html#lambda-CreateFunction-request-Runtime
    this.resource.runtime = config.runtime ?? "nodejs20.x";
  }
}
