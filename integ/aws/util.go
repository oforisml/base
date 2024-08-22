package aws

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"text/template"

	"github.com/google/go-cmp/cmp"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	tfjson "github.com/hashicorp/terraform-json"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type Variables struct {
	AwsRegion       string // The AWS region to use for the test
	EnvironmentName string // The environment name to use for the test
	StackName       string // the name of the stack
}

// apply the variables to the test app
func (p *Variables) Apply(contents string) (string, error) {
	tmpl, err := template.New("test").Parse(contents)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	err = tmpl.Execute(&buf, p)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// ForwardingLogger returns a zap logger that forwards all log messages to terratestLogger
func ForwardingLogger(t *testing.T, targetLogger *loggers.Logger) *zap.Logger {
	config := zap.NewProductionConfig()
	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(config.EncoderConfig),
		zapcore.AddSync(zapcore.Lock(os.Stdout)),
		config.Level,
	)

	forwardingCore := &ForwardingCore{
		Core:         core,
		t:            t,
		targetLogger: targetLogger,
	}

	return zap.New(forwardingCore)
}

// a simple Zap Logger which forwards all log messages to terratestLogger
type ForwardingCore struct {
	zapcore.Core
	t            *testing.T
	targetLogger *loggers.Logger
}

func (fc *ForwardingCore) Check(e zapcore.Entry, ce *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	return ce.AddCore(e, fc)
}

func (fc *ForwardingCore) Write(entry zapcore.Entry, fields []zapcore.Field) error {
	fc.targetLogger.Logf(fc.t, "[%s] %s", entry.Level, entry.Message)
	return nil
}

func PrettyPrintResourceChange(rc *tfjson.ResourceChange) (string, error) {
	// Convert Before and After to JSON strings
	beforeJSON, err := json.MarshalIndent(rc.Change.Before, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal Before: %v", err)
	}
	afterJSON, err := json.MarshalIndent(rc.Change.After, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal After: %v", err)
	}
	return cmp.Diff(string(beforeJSON), string(afterJSON)), nil
}
