package test

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/environment-toolkit/go-synth/executors"
	util "github.com/envtio/base/integ/aws"
	"github.com/gruntwork-io/terratest/modules/aws"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	"github.com/stretchr/testify/assert"

	test_structure "github.com/gruntwork-io/terratest/modules/test-structure"
)

var terratestLogger = loggers.Default

// Test the fifo-queue app
func TestFifoQueue(t *testing.T) {
	envVars := executors.EnvMap(os.Environ())
	// Confirm the FIFO queue is working as expected
	runNotifyIntegrationTest(t, "fifo-queue", "us-east-1", envVars, validateFifoQueue)
}

// Test the dlq-queue app
func TestDlqQueue(t *testing.T) {
	testApp := "dlq-queue"
	awsRegion := "us-east-1"
	// set low maxReceiveCount to trigger DLQ
	maxReceiveCount := 2
	visibilityTimeoutSeconds := 5

	envVars := executors.EnvMap(os.Environ())
	envVars["MAX_RECEIVE_COUNT"] = strconv.Itoa(maxReceiveCount)
	envVars["VISIBILITY_TIMEOUT_SECONDS"] = strconv.Itoa(visibilityTimeoutSeconds)

	// save maxReceiveCount for future stages
	tfWorkingDir := filepath.Join("tf", testApp)
	test_structure.SaveInt(t, tfWorkingDir, "max_receive_count", maxReceiveCount)
	// Confirm the DLQ queue is working as expected
	runNotifyIntegrationTest(t, testApp, awsRegion, envVars, validateDlqQueue)
}

func validateFifoQueue(t *testing.T, workingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	queueUrl := util.LoadOutputAttribute(t, terraformOptions, "fifo_queue", "url")
	messageBody := "Test message"
	// NOTE: either you pass in deduplicationId or set content based deduplication in the apps/fifo-queue.ts code
	util.SendMessageFifoToQueueWithDeduplicationId(t, awsRegion, queueUrl, messageBody, "test-group-id", "test-deduplication-id")
	resp := aws.WaitForQueueMessage(t, awsRegion, queueUrl, 5)
	// TODO: should we validate deduplication prevents sending the same message?

	// Verify the message body matches
	assert.Equal(t, messageBody, resp.MessageBody, "Message body should match")
	terratestLogger.Logf(t, "Message successfully received from Fifo Queue: %s", resp.MessageBody)
}

func validateDlqQueue(t *testing.T, workingDir string, awsRegion string) {
	maxReceiveCount := test_structure.LoadInt(t, workingDir, "max_receive_count")
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	queueUrl := util.LoadOutputAttribute(t, terraformOptions, "queue", "url")
	dlqUrl := util.LoadOutputAttribute(t, terraformOptions, "dlq_queue", "url")
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

// run integration test
func runNotifyIntegrationTest(t *testing.T, testApp, awsRegion string, envVars map[string]string, validate func(t *testing.T, tfWorkingDir string, awsRegion string)) {
	t.Parallel()
	tfWorkingDir := filepath.Join("tf", testApp)
	envVars["AWS_REGION"] = awsRegion
	envVars["ENVIRONMENT_NAME"] = "test"
	envVars["STACK_NAME"] = testApp

	defer test_structure.RunTestStage(t, "cleanup_terraform", func() {
		util.UndeployUsingTerraform(t, tfWorkingDir)
	})

	test_structure.RunTestStage(t, "synth_app", func() {
		util.SynthApp(t, testApp, tfWorkingDir, envVars)
	})
	test_structure.RunTestStage(t, "deploy_terraform", func() {
		util.DeployUsingTerraform(t, tfWorkingDir, nil)
	})
	test_structure.RunTestStage(t, "validate", func() {
		validate(t, tfWorkingDir, awsRegion)
	})
}
