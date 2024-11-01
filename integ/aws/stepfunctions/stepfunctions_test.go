package test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/sfn/types"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/stretchr/testify/require"

	"github.com/envtio/base/integ"
	util "github.com/envtio/base/integ/aws"
	test_structure "github.com/gruntwork-io/terratest/modules/test-structure"
)

// Run the call-aws-service integration test
func TestCallAwsService(t *testing.T) {
	runStepfunctionsIntegrationTest(t, "call-aws-service", "us-east-1", validateCallAwsService)
}

// Run the call-aws-service-sfn integration test
func TestCallAwsServiceSfn(t *testing.T) {
	runStepfunctionsIntegrationTest(t, "call-aws-service-sfn", "us-east-1", validateCallAwsServiceSfn)
}

// Run the call-aws-service-mwaa integration test
func TestCallAwsServiceMwaa(t *testing.T) {
	runStepfunctionsIntegrationTest(t, "call-aws-service-mwaa", "us-east-1", validateCallAwsServiceMwaa)
}

// Validate the call-aws-service integration test
func validateCallAwsService(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	stateMachineArn := util.LoadOutputAttribute(t, terraformOptions, "state_machine", "arn")
	input := map[string]interface{}{
		"body": "hello world!",
	}
	// sleep for iam propagation
	time.Sleep(5 * time.Second)
	executionArn := util.StartSfnExecution(t, awsRegion, stateMachineArn, input)
	result := util.WaitForSfnExecutionStatus(t, awsRegion, *executionArn, types.ExecutionStatusSucceeded, 12, 5*time.Second)
	require.NotNil(t, result.Output)
	var output map[string]interface{}
	err := json.Unmarshal([]byte(result.Output), &output)
	require.NoError(t, err)
	integ.Assert(t, output, []integ.Assertion{
		{
			Path:           "Body",
			ExpectedRegexp: strPtr("hello world!"),
		},
	})
}

// Validate the call-aws-service-sfn integration test
func validateCallAwsServiceSfn(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	stateMachineArn := util.LoadOutputAttribute(t, terraformOptions, "state_machine", "arn")
	// sleep for iam propagation
	time.Sleep(5 * time.Second)

	// https://github.com/aws/aws-cdk/blob/v2.164.1/packages/%40aws-cdk-testing/framework-integ/test/aws-stepfunctions-tasks/test/aws-sdk/integ.call-aws-service-sfn.ts#L35
	executionArn := util.StartSfnExecution(t, awsRegion, stateMachineArn, nil)
	util.WaitForSfnExecutionStatus(t, awsRegion, *executionArn, types.ExecutionStatusSucceeded, 3, 3*time.Second)
}

// Validate the call-aws-service-mwaa integration test
func validateCallAwsServiceMwaa(t *testing.T, tfWorkingDir string, awsRegion string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	stateMachineArn := util.LoadOutputAttribute(t, terraformOptions, "state_machine", "arn")
	// sleep for IAM propagation
	time.Sleep(5 * time.Second)

	// https://github.com/aws/aws-cdk/blob/v2.164.1/packages/%40aws-cdk-testing/framework-integ/test/aws-stepfunctions-tasks/test/aws-sdk/integ.call-aws-service-mwaa.ts#L21
	executionArn := util.StartSfnExecution(t, awsRegion, stateMachineArn, nil)
	util.WaitForSfnExecutionStatus(t, awsRegion, *executionArn, types.ExecutionStatusSucceeded, 3, 3*time.Second)
}

// run stepfunctions integration test
func runStepfunctionsIntegrationTest(t *testing.T, testApp, awsRegion string, validate func(t *testing.T, tfWorkingDir string, awsRegion string)) {
	t.Parallel()
	tfWorkingDir := filepath.Join("tf", testApp)
	envVars := executors.EnvMap(os.Environ())
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

func strPtr(s string) *string {
	return &s
}
