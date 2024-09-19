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
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	util "github.com/envtio/base/integ/aws"
	http_helper "github.com/gruntwork-io/terratest/modules/http-helper"
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
func TestNodeJsFunctionUrl(t *testing.T) {
	t.Parallel()
	testApp := "nodejs-function-url"
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

	// Validate the function URL
	test_structure.RunTestStage(t, "validate", func() {
		testFunctionUrl(t, tfWorkingDir)
	})

	// rename the environment name
	envVars["ENVIRONMENT_NAME"] = "renamed"
	test_structure.RunTestStage(t, "rename_app", func() {
		synthApp(t, testApp, tfWorkingDir, envVars)
	})

	// confirm no changes in plan
	test_structure.RunTestStage(t, "validate_rename", func() {
		replanUsingTerraform(t, tfWorkingDir)
	})
}

func synthApp(t *testing.T, testApp, tfWorkingDir string, env map[string]string) {
	zapLogger := util.ForwardingLogger(t, terratestLogger)
	ctx := context.Background()
	// path from integ/aws/compute/apps/*.ts to repo root src
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
	// replace the path to src with relative package "@envtio/base"
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

// Ensure Function URL works
func testFunctionUrl(t *testing.T, tfWorkingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	outputMap := terraform.OutputMap(t, terraformOptions, "echo")
	responseCode, response := http_helper.HttpGet(t, outputMap["url"], nil)
	assert.Equal(t, 200, responseCode)
	terratestLogger.Logf(t, "Response from %s: %v", outputMap["url"], string(response))
}

func replanUsingTerraform(t *testing.T, workingDir string) {
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	plan := terraform.InitAndPlanAndShowWithStructNoLogTempPlanFile(t, terraformOptions)
	// validate no replace in plan struct
	summarizePlan(t, plan)
	require.Equal(t, 0, countReplaceActions(plan))
}

func summarizePlan(t *testing.T, plan *terraform.PlanStruct) int {
	count := 0
	for _, change := range plan.ResourceChangesMap {
		addres := change.Address
		if change.Change.Actions.Create() {
			terratestLogger.Logf(t, "Create Action: %v", addres)
		} else if change.Change.Actions.Delete() {
			terratestLogger.Logf(t, "Delete Action: %v", addres)
		} else if change.Change.Actions.Replace() {
			prettyDiff, err := util.PrettyPrintResourceChange(change)
			require.NoError(t, err)
			terratestLogger.Logf(t, "Replace Action:  %v - %v", addres, prettyDiff)
		} else if change.Change.Actions.Update() {
			prettyDiff, err := util.PrettyPrintResourceChange(change)
			require.NoError(t, err)
			terratestLogger.Logf(t, "Update Action: %v - %v", addres, prettyDiff)
		}
	}
	return count
}

func countReplaceActions(plan *terraform.PlanStruct) int {
	count := 0
	for _, change := range plan.ResourceChangesMap {
		if change.Change.Actions.Replace() {
			count++
		}
	}
	return count
}
