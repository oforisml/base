package aws

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/service/sfn"
)

type ActivityHandler interface {
	// Input returns the input data of the activity.
	Input() interface{}
	// SendSuccess sends a success message to the State Machine.
	SendSuccess(output interface{}) error
	// SendFailure sends a failure message to the State Machine.
	SendFailure(errCode string, cause string) error
	// SendHeartbeat sends a heartbeat message to the State Machine.
	SendHeartbeat() error
}

// ActivityTask represents a task that has been scheduled for execution by a running state machine.
// It is used by workers to to execute.
type activityWorker struct {
	// The deserialized input data of the task.
	input interface{}

	// The token that identifies the scheduled task. This token must be copied and
	// included in subsequent calls to SendTaskHeartbeat, SendTaskSuccess or SendTaskFailure in order to report the progress or
	// completion of the task.
	taskToken *string
	sfnClient *sfn.Client
}

func NewActivityHandler(sfnClient *sfn.Client, input interface{}, taskToken *string) ActivityHandler {
	return &activityWorker{
		input:     input,
		taskToken: taskToken,
		sfnClient: sfnClient,
	}
}

func (a *activityWorker) Input() interface{} {
	return a.input
}

func (a *activityWorker) SendSuccess(output interface{}) error {
	if output == nil {
		return fmt.Errorf("output cannot be nil")
	}

	outputJson, err := json.Marshal(output)
	if err != nil {
		return err
	}
	outputStr := string(outputJson)

	_, err = a.sfnClient.SendTaskSuccess(context.TODO(), &sfn.SendTaskSuccessInput{
		Output:    &outputStr,
		TaskToken: a.taskToken,
	})
	return err
}

func (a *activityWorker) SendFailure(errCode string, cause string) error {
	_, err := a.sfnClient.SendTaskFailure(context.TODO(), &sfn.SendTaskFailureInput{
		Error:     &errCode,
		Cause:     &cause,
		TaskToken: a.taskToken,
	})
	return err
}

func (a *activityWorker) SendHeartbeat() error {
	_, err := a.sfnClient.SendTaskHeartbeat(context.TODO(), &sfn.SendTaskHeartbeatInput{
		TaskToken: a.taskToken,
	})
	return err
}
