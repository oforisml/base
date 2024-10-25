package test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/environment-toolkit/go-synth"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/environment-toolkit/go-synth/models"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	"github.com/stretchr/testify/require"

	util "github.com/envtio/base/integ/aws"
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

// Test the bucket-notifications integration
func TestBucketNotifications(t *testing.T) {
	t.Parallel()
	testApp := "bucket-notifications"
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
		deployUsingTerraform(t, tfWorkingDir, map[string]string{
			// TODO: Fix Dependency tree to avoid this error :(
			".*The EventInvokeConfig for function .* could not be updated due to a concurrent update operation.*": "Failed due to concurrent update operation.",
		})
	})

	// Validate the bucket-notifications integration test
	test_structure.RunTestStage(t, "validate", func() {
		validateBucketNotifications(t, tfWorkingDir, awsRegion)
	})
}

// Synth app
func synthApp(t *testing.T, testApp, tfWorkingDir string, env map[string]string) {
	zapLogger := util.ForwardingLogger(t, terratestLogger)
	ctx := context.Background()
	// path from integ/aws/compute/apps/*.ts to repo root src
	mainPathToSrc := filepath.Join("..", repoRoot, "src")
	if _, err := os.Stat(filepath.Join(repoRoot, "lib")); err != nil {
		t.Fatal("No lib folder, run pnpm compile before go test")
	}
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
			return e.CopyFrom(ctx, thisFs, repoRoot, relPath, defaultCopyOptions)
		},
		Dependencies: map[string]string{
			"@envtio/base": relPath,
		},
	})
	// replace the path to src with relative package "@envtio/base"
	mainTs := strings.ReplaceAll(string(mainTsBytes), mainPathToSrc, "@envtio/base")
	err = app.Eval(ctx, thisFs, mainTs, "cdktf.out/stacks/"+testApp, tfWorkingDir)
	if err != nil {
		t.Fatal("Failed to synth app", err)
	}
}

func deployUsingTerraform(t *testing.T, workingDir string, additionalRetryableErrors map[string]string) {
	// Construct the terraform options with default retryable errors to handle the most common retryable errors in
	// terraform testing.
	terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir:    workingDir,
		TerraformBinary: "tofu",
	})

	for k, v := range additionalRetryableErrors {
		terraformOptions.RetryableTerraformErrors[k] = v
	}

	// Save the Terraform Options struct, so future test stages can use it
	test_structure.SaveTerraformOptions(t, workingDir, terraformOptions)
	terraform.InitAndApply(t, terraformOptions)
}

func undeployUsingTerraform(t *testing.T, workingDir string) {
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	terraform.Destroy(t, terraformOptions)
}

// Validate the Destionation integration test
func validateBucketNotifications(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	bucketName := loadOutputAttribute(t, terraformOptions, "bucket", "name")
	util.AssertS3BucketNotificationExists(t, awsRegion, bucketName)
}

// loadOutputAttribute loads the name of a role from Terraform outputs and ensures it is not empty.
func loadOutputAttribute(t *testing.T, terraformOptions *terraform.Options, key, attribute string) string {
	outputs := terraform.OutputMap(t, terraformOptions, key)
	value := outputs[attribute]
	require.NotEmpty(t, value, fmt.Sprintf("Output %s.%s should not be empty", key, attribute))
	return value
}
