package test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/environment-toolkit/go-synth"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/environment-toolkit/go-synth/models"
	"github.com/gruntwork-io/terratest/modules/aws"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/envtio/base/integ"
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

	invocationTypeEvent util.InvocationTypeOption = util.InvocationTypeEvent
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
		deployUsingTerraform(t, tfWorkingDir, nil)
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

// Test the destinations integrations
func TestDestinations(t *testing.T) {
	t.Parallel()
	testApp := "destinations"
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

	// Validate the destinations integration test
	test_structure.RunTestStage(t, "validate", func() {
		validateDestinations(t, tfWorkingDir, awsRegion)
	})
}

// Test the lambda-chain integration
func TestLambdaChain(t *testing.T) {
	t.Parallel()
	testApp := "lambda-chain"
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

	// Validate the lambda-chain integration test
	test_structure.RunTestStage(t, "validate", func() {
		// sleep for event bridge rules to be ready
		time.Sleep(10 * time.Second)
		validateLambdaChainSuccess(t, tfWorkingDir, awsRegion)
		validateLambdaChainFailure(t, tfWorkingDir, awsRegion)
	})
}

// Test the event-source-sqs integration
func TestEventSourceSqs(t *testing.T) {
	t.Parallel()
	testApp := "event-source-sqs"
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

	// Validate the event-source-sqs integration test
	test_structure.RunTestStage(t, "validate", func() {
		validateEventSourceSqs(t, tfWorkingDir, awsRegion)
	})
}

// Test the event-source-sqs-filtered integration
func TestEventSourceSqsFiltered(t *testing.T) {
	t.Parallel()
	testApp := "event-source-sqs-filtered"
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

	// Validate the event-source-sqs-filtered integration test
	test_structure.RunTestStage(t, "validate", func() {
		validateEventSourceSqsFiltered(t, tfWorkingDir, awsRegion)
	})
}

// Test the event-source-s3 integration
func TestEventSourceS3(t *testing.T) {
	t.Parallel()
	testApp := "event-source-s3"
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

	// Validate the event-source-sqs integration test
	test_structure.RunTestStage(t, "validate", func() {
		validateEventSourceS3(t, tfWorkingDir, awsRegion)
	})
}

// Synth app after copying in the handlers directory and @envtio/base
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

// Ensure Function URL works
func testFunctionUrl(t *testing.T, tfWorkingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	outputMap := terraform.OutputMap(t, terraformOptions, "echo")
	responseCode, response := http_helper.HttpGet(t, outputMap["url"], nil)
	assert.Equal(t, 200, responseCode)
	terratestLogger.Logf(t, "Response from %s: %v", outputMap["url"], string(response))
}

// Validate the Destionation integration test
func validateDestinations(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	functionName := loadOutputAttribute(t, terraformOptions, "function", "name")
	queueUrl := loadOutputAttribute(t, terraformOptions, "queue", "url")

	// https://github.com/aws/aws-cdk/blob/v2.161.1/packages/%40aws-cdk-testing/framework-integ/test/aws-lambda-destinations/test/integ.destinations.ts#L88
	util.InvokeFunctionWithParams(t, awsRegion, functionName, &util.LambdaOptions{
		InvocationType: &invocationTypeEvent,
		Payload:        map[string]interface{}{"status": "OK"},
	})
	resp := util.WaitForQueueMessage(t, awsRegion, queueUrl, 20)
	var messageBody map[string]interface{}
	err := json.Unmarshal([]byte(resp.MessageBody), &messageBody)
	require.NoError(t, err, "Failed to unmarshal message body")
	integ.Assert(t, messageBody, []integ.Assertion{
		{
			Path:           "requestContext.condition",
			ExpectedRegexp: "Success",
		},
		{
			Path:           "requestPayload.status",
			ExpectedRegexp: "OK",
		},
		{
			Path:           "responseContext.statusCode",
			ExpectedRegexp: "200",
		},
		{
			Path:           "responsePayload",
			ExpectedRegexp: "success",
		},
	})
}

// Validate the LambdaChain integration test happy path
func validateLambdaChainSuccess(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	firstFunctionName := loadOutputAttribute(t, terraformOptions, "first_function", "name")
	thirdFunctionName := loadOutputAttribute(t, terraformOptions, "third_function", "name")
	thirdFunctionLogGroup := fmt.Sprintf("/aws/lambda/%s", thirdFunctionName)
	// https://github.com/aws/aws-cdk/blob/v2.161.1/packages/%40aws-cdk-testing/framework-integ/test/aws-lambda-destinations/test/integ.lambda-chain.ts#L65
	util.InvokeFunctionWithParams(t, awsRegion, firstFunctionName, &util.LambdaOptions{
		InvocationType: &invocationTypeEvent,
		Payload:        map[string]interface{}{"status": "success"},
	})
	messages := util.WaitForLogEvents(t, awsRegion, thirdFunctionLogGroup, 12, 5*time.Second)
	for _, message := range messages {
		// we log only, no messages fails the test anyway
		terratestLogger.Logf(t, "Success Test: Message: %s", message)
	}
}

// Validate the LambdaChain integration test failure path
func validateLambdaChainFailure(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	firstFunctionName := loadOutputAttribute(t, terraformOptions, "first_function", "name")
	errorFunctionName := loadOutputAttribute(t, terraformOptions, "error_function", "name")
	errorLogGroup := fmt.Sprintf("/aws/lambda/%s", errorFunctionName)
	util.InvokeFunctionWithParams(t, awsRegion, firstFunctionName, &util.LambdaOptions{
		InvocationType: &invocationTypeEvent,
		Payload:        map[string]interface{}{"status": "error"},
	})
	messages := util.WaitForLogEvents(t, awsRegion, errorLogGroup, 12, 5*time.Second)
	for _, message := range messages {
		// we log only, no messages fails the test anyway
		terratestLogger.Logf(t, "Failure Test: Message: %s", message)
	}
}

// Validate the Destionation integration test
func validateEventSourceSqs(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	functionName := loadOutputAttribute(t, terraformOptions, "function", "name")
	queueUrl := loadOutputAttribute(t, terraformOptions, "queue", "url")
	functionLogGroup := fmt.Sprintf("/aws/lambda/%s", functionName)

	messageBody := "Test message"
	aws.SendMessageToQueue(t, awsRegion, queueUrl, messageBody)
	logEntries := util.WaitForLogEvents(t, awsRegion, functionLogGroup, 12, 5*time.Second)
	var logMessage map[string]interface{}
	for _, entry := range logEntries {
		err := json.Unmarshal([]byte(entry), &logMessage)
		if err != nil {
			// ignore, this shouldn't happen (but sometimes lambda system start message is unstructured)
			terratestLogger.Logf(t, "Ignoring log message: %s", entry)
			continue
		}
		if _, ok := logMessage["message"]; ok {
			var event map[string]interface{}
			err := json.Unmarshal([]byte(logMessage["message"].(string)), &event)
			require.NoError(t, err, "Failed to unmarshal event data")
			integ.Assert(t, event, []integ.Assertion{
				{
					Path:           "Records[0].body",
					ExpectedRegexp: messageBody,
				},
			})
		}
	}
}

// Validate the Destionation integration test
func validateEventSourceSqsFiltered(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	functionName := loadOutputAttribute(t, terraformOptions, "function", "name")
	queueUrl := loadOutputAttribute(t, terraformOptions, "queue", "url")
	functionLogGroup := fmt.Sprintf("/aws/lambda/%s", functionName)

	messageBody := `{"id": "test"}`
	aws.SendMessageToQueue(t, awsRegion, queueUrl, "random message") // should not trigger function
	aws.SendMessageToQueue(t, awsRegion, queueUrl, messageBody)
	logEntries := util.WaitForLogEvents(t, awsRegion, functionLogGroup, 12, 5*time.Second)
	var logMessage map[string]interface{}
	for _, entry := range logEntries {
		err := json.Unmarshal([]byte(entry), &logMessage)
		if err != nil {
			// ignore, this shouldn't happen (but sometimes lambda system start message is unstructured)
			terratestLogger.Logf(t, "Ignoring log message: %s", entry)
			continue
		}
		if _, ok := logMessage["message"]; ok {
			var event map[string]interface{}
			err := json.Unmarshal([]byte(logMessage["message"].(string)), &event)
			require.NoError(t, err, "Failed to unmarshal event data")
			integ.Assert(t, event, []integ.Assertion{
				{
					Path:           "Records[0].body",
					ExpectedRegexp: messageBody,
				},
			})
		}
	}
}

// Validate the Destionation integration test
func validateEventSourceS3(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	functionName := loadOutputAttribute(t, terraformOptions, "function", "name")
	bucketName := loadOutputAttribute(t, terraformOptions, "bucket", "name")
	functionLogGroup := fmt.Sprintf("/aws/lambda/%s", functionName)

	objectKey := "subdir/test.txt"
	util.UploadS3File(t, awsRegion, bucketName, objectKey, "sample content")
	logEntries := util.WaitForLogEvents(t, awsRegion, functionLogGroup, 12, 5*time.Second)
	// clean up to avoid Terraform destroy failure
	aws.EmptyS3Bucket(t, awsRegion, bucketName)
	var logMessage map[string]interface{}
	for _, entry := range logEntries {
		err := json.Unmarshal([]byte(entry), &logMessage)
		if err != nil {
			// ignore, this shouldn't happen (but sometimes lambda system start message is unstructured)
			terratestLogger.Logf(t, "Ignoring log message: %s", entry)
			continue
		}
		if _, ok := logMessage["message"]; ok {
			var event map[string]interface{}
			err := json.Unmarshal([]byte(logMessage["message"].(string)), &event)
			require.NoError(t, err, "Failed to unmarshal event data")
			integ.Assert(t, event, []integ.Assertion{
				{
					Path:           "Records[0].s3.object.key",
					ExpectedRegexp: objectKey,
				},
			})
		}
	}
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

// loadOutputAttribute loads the name of a role from Terraform outputs and ensures it is not empty.
func loadOutputAttribute(t *testing.T, terraformOptions *terraform.Options, key, attribute string) string {
	outputs := terraform.OutputMap(t, terraformOptions, key)
	value := outputs[attribute]
	require.NotEmpty(t, value, fmt.Sprintf("Output %s.%s should not be empty", key, attribute))
	return value
}
