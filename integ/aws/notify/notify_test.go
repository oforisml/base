package test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/environment-toolkit/go-synth"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/environment-toolkit/go-synth/models"
	util "github.com/envtio/base/integ/aws"
	"github.com/gruntwork-io/terratest/modules/aws"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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

// Test the fifo-queue app
func TestFifoQueue(t *testing.T) {
	t.Parallel()
	testApp := "fifo-queue"
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

	// Confirm the FIFO queue is working as expected
	test_structure.RunTestStage(t, "validate", func() {
		testFifoQueue(t, awsRegion, "fifo_queue", tfWorkingDir)
	})
}

// Test the dlq-queue app
func TestDlqQueue(t *testing.T) {
	t.Parallel()
	testApp := "dlq-queue"
	tfWorkingDir := filepath.Join("tf", testApp)
	awsRegion := "us-east-1"
	maxReceiveCount := 2
	visibilityTimeoutSeconds := 5

	envVars := executors.EnvMap(os.Environ())
	envVars["AWS_REGION"] = awsRegion
	envVars["ENVIRONMENT_NAME"] = "test"
	envVars["STACK_NAME"] = testApp

	// set low maxReceiveCount to trigger DLQ
	envVars["MAX_RECEIVE_COUNT"] = strconv.Itoa(maxReceiveCount)
	envVars["VISIBILITY_TIMEOUT_SECONDS"] = strconv.Itoa(visibilityTimeoutSeconds)

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

	// Confirm the DLQ queue is working as expected
	test_structure.RunTestStage(t, "validate", func() {
		testDlqQueue(t, awsRegion, "queue", "dlq_queue", maxReceiveCount, visibilityTimeoutSeconds, tfWorkingDir)
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

func testFifoQueue(t *testing.T, awsRegion string, queueKey string, workingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	queueUrl := LoadQueueURL(t, terraformOptions, queueKey)
	messageBody := "Test message"
	// NOTE: either you pass in deduplicationId or set content based deduplication in the apps/fifo-queue.ts code
	util.SendMessageFifoToQueueWithDeduplicationId(t, awsRegion, queueUrl, messageBody, "test-group-id", "test-deduplication-id")
	resp := aws.WaitForQueueMessage(t, awsRegion, queueUrl, 5)
	// TODO: should we validate deduplication prevents sending the same message?

	// Verify the message body matches
	assert.Equal(t, messageBody, resp.MessageBody, "Message body should match")
	t.Logf("Message successfully received from Fifo Queue: %s", resp.MessageBody)
}

func testDlqQueue(t *testing.T, awsRegion string, queueKey string, dlqKey string, maxReceiveCount int, visibilityTimeoutSeconds int, workingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	queueUrl := LoadQueueURL(t, terraformOptions, queueKey)
	dlqUrl := LoadQueueURL(t, terraformOptions, dlqKey)
	messageBody := "Test message"
	aws.SendMessageToQueue(t, awsRegion, queueUrl, messageBody)

	// Attempt to exceed the maxReceiveCount message without deleting it (trigger DLQ policy)
	for i := 0; i < maxReceiveCount; i++ {
		msgResponse := util.WaitForQueueMessage(t, awsRegion, queueUrl, 5)
		if msgResponse.Error != nil {
			t.Fatalf("Failed to receive message from queue: %v", msgResponse.Error)
		}
		terratestLogger.Logf(t, "Received message attempt %d/%d (approx receipts: %d): %s", i+1, maxReceiveCount, msgResponse.ApproximateReceiveCount, msgResponse.MessageBody)
		// Indicate message processing failure by setting visibility timeout to 0
		util.ChangeMessageVisibility(t, awsRegion, queueUrl, msgResponse.ReceiptHandle, 0)
	}

	// this should fail, or at least trigger the DLQ policy
	srcMsgResponse := util.WaitForQueueMessage(t, awsRegion, queueUrl, 1)
	if srcMsgResponse.Error == nil {
		t.Fatalf("Received message from queue after maxReceiveCount (approx receipts: %d): %s", srcMsgResponse.ApproximateReceiveCount, srcMsgResponse.MessageBody)
	}

	// Verify the message is moved to DLQ
	dlqMsgResponse := util.WaitForQueueMessage(t, awsRegion, dlqUrl, 60)
	if dlqMsgResponse.Error != nil {
		t.Fatalf("Failed to receive message from DLQ: %v", dlqMsgResponse.Error)
	}

	// Verify the message body matches
	assert.Equal(t, messageBody, dlqMsgResponse.MessageBody, "Message body should match in DLQ")
	terratestLogger.Logf(t, "Message was successfully moved to DLQ: %s (approx receipts: %d)", dlqMsgResponse.MessageBody, dlqMsgResponse.ApproximateReceiveCount)

	// Delete the message from the DLQ
	aws.DeleteMessageFromQueue(t, awsRegion, dlqUrl, dlqMsgResponse.ReceiptHandle)
}

// LoadQueueURL loads the URL of a queue from Terraform outputs and ensures it is not empty.
func LoadQueueURL(t *testing.T, terraformOptions *terraform.Options, key string) string {
	outputs := terraform.OutputMap(t, terraformOptions, key)
	url := outputs["url"]
	require.NotEmpty(t, url, fmt.Sprintf("Queue URL for key %s should not be empty", key))
	return url
}
