package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"

	"github.com/aws/aws-sdk-go-v2/service/sfn"
	"github.com/aws/aws-sdk-go-v2/service/sfn/types"
	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/testing"
	"github.com/stretchr/testify/require"
)

// StartSfnExecution starts a new execution of the specified state machine and returns the execution ARN. This will fail the
// test if there is an error.
func StartSfnExecution(t testing.TestingT, awsRegion string, stateMachineArn string, input interface{}) *string {
	executionArn, err := StartSfnExecutionE(t, awsRegion, stateMachineArn, input)
	require.NoError(t, err)
	return executionArn
}

// StartSfnExecutionE starts a new execution of the specified state machine and returns the execution ARN.
func StartSfnExecutionE(t testing.TestingT, awsRegion string, stateMachineArn string, input interface{}) (*string, error) {
	logger.Log(t, fmt.Sprintf("Starting execution for state machine %s with input %s", stateMachineArn, input))

	var inputStrPtr *string
	if input != nil {
		inputJson, err := json.Marshal(input)
		if err != nil {
			return nil, err
		}
		inputStr := string(inputJson)
		inputStrPtr = &inputStr
	}

	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	res, err := sfnClient.StartExecution(context.Background(), &sfn.StartExecutionInput{
		StateMachineArn: &stateMachineArn,
		Input:           inputStrPtr,
	})
	if err != nil {
		return nil, err
	}

	logger.Log(t, fmt.Sprintf("Execution started with ARN %s", *res.ExecutionArn))
	return res.ExecutionArn, nil
}

// StopSfnExecution stops the specified execution. This will fail the test if there is an error.
func StopSfnExecution(t testing.TestingT, awsRegion string, executionArn string) {
	require.NoError(t, StopSfnExecutionE(t, awsRegion, executionArn))
}

// StopSfnExecutionE stops the specified execution.
func StopSfnExecutionE(t testing.TestingT, awsRegion string, executionArn string) error {
	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return err
	}

	_, err = sfnClient.StopExecution(context.Background(), &sfn.StopExecutionInput{
		ExecutionArn: &executionArn,
	})
	return err
}

// DescribeSfnExecution returns the description of the specified execution. This will fail the test if there is an error.
func DescribeSfnExecution(t testing.TestingT, awsRegion string, executionArn string) *sfn.DescribeExecutionOutput {
	res, err := DescribeSfnExecutionE(t, awsRegion, executionArn)
	require.NoError(t, err)
	return res
}

// DescribeSfnExecutionE returns the description of the specified execution.
func DescribeSfnExecutionE(t testing.TestingT, awsRegion string, executionArn string) (*sfn.DescribeExecutionOutput, error) {
	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	return sfnClient.DescribeExecution(context.Background(), &sfn.DescribeExecutionInput{
		ExecutionArn: &executionArn,
	})
}

// ExecutionOutput contains the result of the SateMachine Execution.
type SfnExecutionOutput struct {
	// The current status of the execution.
	Status types.ExecutionStatus
	// The cause string if the state machine execution failed.
	Cause string
	// The error string if the state machine execution failed.
	Error string
	// The JSON output data of the execution. Length constraints apply to the payload
	// size, and are expressed as bytes in UTF-8 encoding.
	//
	// This field is set only if the execution succeeds. If the execution fails, this
	// field is the string Zero value ("").
	Output string
}

// WaitForSfnExecutionStatus waits for the specified execution to reach the desired status.
// This will fail the test if there is an error.
//
// Executions of an EXPRESS state machine aren't supported by DescribeExecution
// unless a Map Run dispatched them.
func WaitForSfnExecutionStatus(
	t testing.TestingT,
	awsRegion string,
	executionArn string,
	status types.ExecutionStatus,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) *SfnExecutionOutput {
	res, err := WaitForSfnExecutionStatusE(t, awsRegion, executionArn, status, maxRetries, sleepBetweenRetries)
	if err != nil {
		terratestLogger.Logf(t, "Failure cause: %s", res.Cause)
	}
	require.NoError(t, err)
	return res
}

// WaitForSfnExecutionStatusE waits for the specified execution to reach the desired status. this will throw error on timeout or non-retryable Errors.
func WaitForSfnExecutionStatusE(
	t testing.TestingT,
	awsRegion string,
	executionArn string,
	status types.ExecutionStatus,
	maxRetries int,
	sleepBetweenRetries time.Duration,
) (*SfnExecutionOutput, error) {

	retryableErrors := map[string]string{
		// "ExecutionDoesNotExist":       "ExecutionDoesNotExist",
		"bad status: RUNNING":         "bad status: RUNNING",
		"bad status: PENDING_REDRIVE": "bad status: PENDING_REDRIVE",
	}

	description := fmt.Sprintf("Waiting for %s to reach status %s", executionArn, status)

	result := &SfnExecutionOutput{}
	_, err := retry.DoWithRetryableErrorsE(
		t,
		description,
		retryableErrors,
		maxRetries,
		sleepBetweenRetries,
		func() (string, error) {
			resp, err := DescribeSfnExecutionE(t, awsRegion, executionArn)
			if err != nil {
				return "", err
			}

			result.Status = resp.Status
			result.Cause = aws.ToString(resp.Cause)
			result.Error = aws.ToString(resp.Error)
			result.Output = aws.ToString(resp.Output)

			if resp.Status == status {
				return "", nil
			} else {
				return "", fmt.Errorf("bad status: %s", resp.Status)
			}
		},
	)

	if err != nil {
		if actualErr, ok := err.(retry.FatalError); ok {
			return result, actualErr.Underlying
		}
		return result, fmt.Errorf("unexpected error: %v", err)
	}

	return result, nil
}

// GetSfnActivity for a running Sate Machine.
// Used by workers to retrieve a task (with the specified activity ARN)
// which has been scheduled for execution by a running state machine.
func GetSfnActivity(t testing.TestingT, awsRegion string, activityArn string, workerName *string) ActivityHandler {
	res, err := GetSfnActivityE(t, awsRegion, activityArn, workerName)
	require.NoError(t, err)
	return res
}

// GetSfnActivityE for a running Sate Machine.
// Used by workers to retrieve a task (with the specified activity ARN)
// which has been scheduled for execution by a running state machine.
func GetSfnActivityE(t testing.TestingT, awsRegion string, activityArn string, workerName *string) (ActivityHandler, error) {
	sfnClient, err := NewSfnclientE(t, awsRegion)
	if err != nil {
		return nil, err
	}

	res, err := sfnClient.GetActivityTask(context.Background(), &sfn.GetActivityTaskInput{
		ActivityArn: &activityArn,
		WorkerName:  workerName,
	})
	if err != nil {
		return nil, err
	}
	var input interface{}
	if res.Input != nil {
		err = json.Unmarshal([]byte(*res.Input), &input)
		if err != nil {
			return nil, err
		}
	}
	if res.TaskToken == nil {
		// potentially need to wait and retry?
		return nil, fmt.Errorf("TaskToken is nil")
	}
	return NewActivityHandler(sfnClient, input, res.TaskToken), nil
}

// NewSfnclient returns a client for StepFunctions. This will fail the test if there is an error.
func NewSfnclient(t testing.TestingT, awsRegion string) *sfn.Client {
	sess, err := NewSfnclientE(t, awsRegion)
	require.NoError(t, err)
	return sess
}

// NewSfnclientE returns a client for StepFunctions.
func NewSfnclientE(t testing.TestingT, awsRegion string) (*sfn.Client, error) {
	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(awsRegion))
	if err != nil {
		return nil, err
	}
	return sfn.NewFromConfig(cfg), nil
}
