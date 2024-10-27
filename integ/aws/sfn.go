package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"

	"github.com/aws/aws-sdk-go-v2/service/sfn"
	"github.com/aws/aws-sdk-go-v2/service/sfn/types"
	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/testing"
	"github.com/stretchr/testify/require"
)

// StartStateMachineExecution starts a new execution of the specified state machine and returns the execution ARN. This will fail the
// test if there is an error.
func StartStateMachineExecution(t testing.TestingT, awsRegion string, stateMachineArn string, input interface{}) *string {
	executionArn, err := StartStateMachineExecutionE(t, awsRegion, stateMachineArn, input)
	require.NoError(t, err)
	return executionArn
}

// StartStateMachineExecutionE starts a new execution of the specified state machine and returns the execution ARN.
func StartStateMachineExecutionE(t testing.TestingT, awsRegion string, stateMachineArn string, input interface{}) (*string, error) {
	logger.Log(t, fmt.Sprintf("Starting execution for state machine %s with input %s", stateMachineArn, input))

	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	inputJson, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	inputStr := string(inputJson)
	res, err := sfnClient.StartExecution(context.TODO(), &sfn.StartExecutionInput{
		StateMachineArn: &stateMachineArn,
		Input:           &inputStr,
	})
	if err != nil {
		return nil, err
	}

	logger.Log(t, fmt.Sprintf("Execution started with ARN %s", *res.ExecutionArn))
	return res.ExecutionArn, nil
}

func DescribeStateMachineExecution(t testing.TestingT, awsRegion string, executionArn string) *sfn.DescribeExecutionOutput {
	res, err := DescribeStateMachineExecutionE(t, awsRegion, executionArn)
	require.NoError(t, err)
	return res
}

func DescribeStateMachineExecutionE(t testing.TestingT, awsRegion string, executionArn string) (*sfn.DescribeExecutionOutput, error) {
	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	return sfnClient.DescribeExecution(context.TODO(), &sfn.DescribeExecutionInput{
		ExecutionArn: &executionArn,
	})
}

// WaitForStateMachineExecution waits for the specified execution to reach the desired status.
// This will fail the test if there is an error.
func WaitForStateMachineExecution(
	t testing.TestingT,
	awsRegion string,
	executionArn string,
	status types.ExecutionStatus,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) *sfn.DescribeExecutionOutput {
	res, err := WaitForStateMachineExecutionE(t, awsRegion, executionArn, status, maxRetries, sleepBetweenRetries)
	require.NoError(t, err)
	return res
}

// WaitForStateMachineExecutionE waits for the specified execution to reach the desired status. this will throw error on timeout.
func WaitForStateMachineExecutionE(
	t testing.TestingT,
	awsRegion string,
	executionArn string,
	status types.ExecutionStatus,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) (*sfn.DescribeExecutionOutput, error) {
	var output *sfn.DescribeExecutionOutput
	description := fmt.Sprintf("Waiting for %s to reach status %s", executionArn, status)
	_, err := retry.DoWithRetryE(
		t,
		description,
		maxRetries,
		sleepBetweenRetries,
		func() (string, error) {
			result, err := DescribeStateMachineExecutionE(t, awsRegion, executionArn)
			if err != nil {
				return "", err
			}

			if result.Status == status {
				output = result
				return "Execution reached desired status", nil
			} else {
				return "", fmt.Errorf("execution is still in status %s", result.Status)
			}
		},
	)
	if err != nil {
		return nil, err
	}
	return output, nil
}

// NewSfnclient returns a client for StepFunctions. This will fail the test and
// stop execution if there is an error.
func NewSfnclient(t testing.TestingT, awsRegion string) *sfn.Client {
	sess, err := NewSfnclientE(t, awsRegion)
	require.NoError(t, err)
	return sess
}

// NewSfnclientE returns a client for StepFunctions.
func NewSfnclientE(t testing.TestingT, awsRegion string) (*sfn.Client, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(awsRegion))
	if err != nil {
		return nil, err
	}
	return sfn.NewFromConfig(cfg), nil
}
