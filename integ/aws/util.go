package aws

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"text/template"

	"github.com/environment-toolkit/go-synth"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/environment-toolkit/go-synth/models"
	"github.com/google/go-cmp/cmp"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/terraform"
	test_structure "github.com/gruntwork-io/terratest/modules/test-structure"
	tfjson "github.com/hashicorp/terraform-json"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var terratestLogger = loggers.Default

const (
	// path from integ/aws/* to repo root
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

// Synth app relative to the integration namespace
func SynthApp(t *testing.T, testApp, tfWorkingDir string, env map[string]string, additionalAppDirs ...string) {
	zapLogger := ForwardingLogger(t, terratestLogger)
	ctx := context.Background()
	// path from integ/aws/*/apps/*.ts to repo root src
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
		// copy additionalDirs and @envtio/base to synth App fs
		PreSetupFn: func(e models.Executor) error {
			for _, dirName := range additionalAppDirs {
				relDir := filepath.Join("apps", dirName)
				if err := e.CopyFrom(ctx, thisFs, relDir, dirName, defaultCopyOptions); err != nil {
					return err
				}
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

func DeployUsingTerraform(t *testing.T, workingDir string, additionalRetryableErrors map[string]string) {
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

func UndeployUsingTerraform(t *testing.T, workingDir string) {
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	terraform.Destroy(t, terraformOptions)
}

// LoadOutputAttribute loads the attribute of a output key from Terraform outputs and ensures it is not empty.
func LoadOutputAttribute(t *testing.T, terraformOptions *terraform.Options, key, attribute string) string {
	outputs := terraform.OutputMap(t, terraformOptions, key)
	value := outputs[attribute]
	require.NotEmpty(t, value, fmt.Sprintf("Output %s.%s should not be empty", key, attribute))
	return value
}

// URLDecode decodes a URL-encoded string.
func URLDecode(encoded string) (string, error) {
	decoded, err := url.QueryUnescape(encoded)
	if err != nil {
		return "", err
	}
	return decoded, nil
}

type Variables map[string]any

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
	return PrettyPrintBeforeAfter(rc.Change.Before, rc.Change.After)
}

func PrettyPrintBeforeAfter(before interface{}, after interface{}) (string, error) {
	// Convert Before and After to JSON strings
	beforeJSON, err := json.MarshalIndent(before, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal Before: %v", err)
	}
	afterJSON, err := json.MarshalIndent(after, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal After: %v", err)
	}
	return cmp.Diff(string(beforeJSON), string(afterJSON)), nil
}
