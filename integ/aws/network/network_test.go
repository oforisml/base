package test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/environment-toolkit/go-synth"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/environment-toolkit/go-synth/models"
	util "github.com/envtio/base/integ/aws"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	"github.com/stretchr/testify/require"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/terraform"
	test_structure "github.com/gruntwork-io/terratest/modules/test-structure"
	"github.com/spf13/afero"
)

var terratestLogger = loggers.Default

const (
	// path from integ/aws/network to repo root
	repoRoot = "../../../"
	// copy the root as relative Path for bun install
	relPath = "./envtio/base"
)

var (
	// Directories to skip when copying files to the synth app fs
	defaultCopyOptions = models.CopyOptions{
		SkipDirs: []string{
			"integ", // ignore self - prevent recursive loops
			"src",   // package.json entrypoint is lib/index.js!
			".git",
			".github",
			".vscode",
			".projen",
			"projenrc",
			"node_modules",
			"test-reports",
			"dist",
			"test",
			"coverage",
		},
	}
)

// Test the simple-ipv4-vpc app
func TestSimpleIPv4Vpc(t *testing.T) {
	t.Parallel()
	testApp := "simple-ipv4-vpc"
	tfWorkingDir := filepath.Join("tf", testApp)
	awsRegion := "us-east-1"

	envVars := executors.EnvMap(os.Environ())
	envVars["AWS_REGION"] = awsRegion
	envVars["ENVIRONMENT_NAME"] = "test"
	envVars["STACK_NAME"] = testApp

	// At the end of the test, destroy all the resources
	defer test_structure.RunTestStage(t, "cleanup_terraform", func() {
		undeployUsingTerraform(t, tfWorkingDir)
	})

	// Synth the CDKTF app under test
	test_structure.RunTestStage(t, "synth_app", func() {
		synthApp(t, testApp, tfWorkingDir, envVars)
	})

	// Deploy using Terraform
	test_structure.RunTestStage(t, "deploy_terraform", func() {
		deployUsingTerraform(t, tfWorkingDir)
	})

	// Validate the network connectivity
	test_structure.RunTestStage(t, "validate", func() {
		testLambdaInvocations(t, awsRegion, tfWorkingDir)
	})

}

func synthApp(t *testing.T, testApp, tfWorkingDir string, env map[string]string) {
	zapLogger := util.ForwardingLogger(t, terratestLogger)
	ctx := context.Background()
	// path from integ/aws/network/apps/*.ts to repo root src
	mainPathToSrc := filepath.Join("..", repoRoot, "src")
	if _, err := os.Stat(filepath.Join(repoRoot, "lib")); err != nil {
		t.Fatal("No lib folder, run pnpm compile before go test")
	}
	handlersDir := filepath.Join("apps", "handlers")
	mainTsFile := filepath.Join("apps", testApp+".ts")
	mainTsBytes, err := os.ReadFile(mainTsFile)
	if err != nil {
		t.Fatal("Failed to read" + mainTsFile)
	}

	thisFs := afero.NewOsFs()
	app := synth.NewApp(executors.NewBunExecutor, zapLogger)
	app.Configure(ctx, models.AppConfig{
		EnvVars: env,
		// copy handlers and @envtio/base to synth App fs
		PreSetupFn: func(e models.Executor) error {
			if err := e.CopyFrom(ctx, thisFs, handlersDir, "handlers", defaultCopyOptions); err != nil {
				return err
			}
			return e.CopyFrom(ctx, thisFs, repoRoot, relPath, defaultCopyOptions)
		},
		Dependencies: map[string]string{
			"@envtio/base": relPath,
		},
	})
	mainTs := strings.ReplaceAll(string(mainTsBytes), mainPathToSrc, "@envtio/base")
	err = app.Eval(ctx, thisFs, mainTs, "cdktf.out/stacks/"+testApp, tfWorkingDir)
	if err != nil {
		t.Fatal("Failed to synth app", err)
	}
}

func deployUsingTerraform(t *testing.T, workingDir string) {
	// Construct the terraform options with default retryable errors to handle the most common retryable errors in
	// terraform testing.
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir:    workingDir,
		TerraformBinary: "tofu",
	})

	// Save the Terraform Options struct, so future test stages can use it
	test_structure.SaveTerraformOptions(t, workingDir, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)
}

func undeployUsingTerraform(t *testing.T, workingDir string) {
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	terraform.Destroy(t, terraformOptions)
}

// fetchFunctionPayload is the payload for the fetch function
type fetchFunctionPayload struct {
	URL string `json:"url"`
}

// ensure all fetch functions can be invoked correctly
func testLambdaInvocations(t *testing.T, awsRegion string, workingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	echoOutputMap := terraform.OutputMap(t, terraformOptions, "echo")
	fetchFunctionOutputs := []string{"data_fetch_ip_0", "data_fetch_ip_1", "private_fetch_ip_0", "private_fetch_ip_1"}

	for _, fetchFunctionOutput := range fetchFunctionOutputs {
		outputMap := terraform.OutputMap(t, terraformOptions, fetchFunctionOutput)
		response, err := aws.InvokeFunctionE(t, awsRegion, outputMap["name"], fetchFunctionPayload{
			URL: echoOutputMap["url"],
		})
		require.NoError(t, err)
		terratestLogger.Logf(t, "Response from %s: %v", outputMap["name"], string(response))
	}
}
