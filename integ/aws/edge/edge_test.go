package test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/environment-toolkit/go-synth"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/environment-toolkit/go-synth/models"
	util "github.com/envtio/base/integ/aws"
	loggers "github.com/gruntwork-io/terratest/modules/logger"
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

// Test the multi-zone-acm-pub-cert app
func TestMultiZoneAcmPubCert(t *testing.T) {
	t.Parallel()
	testApp := "multi-zone-acm-pub-cert"
	tfWorkingDir := filepath.Join("tf", testApp)
	awsRegion := "us-east-1"

	envVars := executors.EnvMap(os.Environ())
	envVars["AWS_REGION"] = awsRegion
	envVars["ENVIRONMENT_NAME"] = "test"
	envVars["STACK_NAME"] = testApp
	envVars["DNS_DOMAIN_NAME1"] = "test2.e2e.envt.io"
	envVars["DNS_ZONE_ID1"] = "Z094619391UOQUZ5PKD4"
	envVars["DNS_DOMAIN_NAME2"] = "test1.e2e.envt.io"
	envVars["DNS_ZONE_ID2"] = "Z09470921W73LC945033M"

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

	// Wait for cert to be issued
	test_structure.RunTestStage(t, "validate", func() {
		testMultiZoneAcmPubCert(t, awsRegion, "certificate", tfWorkingDir)
	})
}

// Test the url-rewrite-spa app
func TestUrlRewriteSpa(t *testing.T) {
	t.Parallel()
	testApp := "url-rewrite-spa"
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

	// Validate the network connectivity
	test_structure.RunTestStage(t, "validate", func() {
		testURLRewriteFunction(t, "url_rewrite_function", tfWorkingDir)
	})
}

// Test the kvs-jwt-verify app
func TestKvsJwtVerify(t *testing.T) {
	t.Parallel()
	testApp := "kvs-jwt-verify"
	tfWorkingDir := filepath.Join("tf", testApp)
	awsRegion := "us-east-1"
	jwtSecret := "terratest-test-secret"

	envVars := executors.EnvMap(os.Environ())
	envVars["AWS_REGION"] = awsRegion
	envVars["ENVIRONMENT_NAME"] = "test"
	envVars["STACK_NAME"] = testApp
	envVars["SECRET_KEY"] = jwtSecret

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

	// Validate the network connectivity
	test_structure.RunTestStage(t, "validate", func() {
		testJwtVerifyFunction(t, "jwt_verify_function", tfWorkingDir)
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

func testMultiZoneAcmPubCert(t *testing.T, awsRegion string, certificateOutputKey string, workingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	certificateOutputs := terraform.OutputMap(t, terraformOptions, certificateOutputKey)
	certificateArn := certificateOutputs["arn"]
	require.NotEmpty(t, certificateArn)
	util.WaitForCertificateIssued(t, certificateArn, awsRegion, 10, 10*time.Second)
}

// testURLRewriteFunction with testevents
func testURLRewriteFunction(t *testing.T, functionOutputsName string, workingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	functionOutputMap := terraform.OutputMap(t, terraformOptions, functionOutputsName)
	// TODO: don't hardcode stage?
	functionStage := "LIVE"

	testEvents := []string{
		"testevents/url-rewrite-spa/file-name-and-extension.json",
		"testevents/url-rewrite-spa/file-name-no-extension.json",
		"testevents/url-rewrite-spa/no-file-name.json",
	}

	for _, testEventPath := range testEvents {
		testEvent, err := util.ReadCloudFrontEvent(testEventPath)
		require.NoError(t, err)
		require.NotNil(t, testEvent)

		validateURI := func(r *util.CloudFrontTestFunctionResult) (bool, *string) {
			if r.Output == nil {
				return false, strPtr("Got nil Output")
			}
			beforeURI := testEvent.Request.URI
			afterURI := getNested[string](*r.Output, []string{"request", "uri"})
			if afterURI == nil {
				return false, strPtr("Missing \"request.uri\" in Function Response")
			}
			afterURIStr := *afterURI
			switch beforeURI {
			case "/":
				if afterURIStr != "/index.html" {
					return false, strPtr(fmt.Sprintf("Got URI : %s\nWant URI:%s", afterURIStr, "/index.html"))
				}
			case "/blog", "/blog/index.html":
				if afterURIStr != "/blog/index.html" {
					return false, strPtr(fmt.Sprintf("Got URI : %s\nWant URI:%s", afterURIStr, "/blog/index.html"))
				}
			default:
				t.Fatalf("Unexpected input testEvent URI: %s", beforeURI)
			}
			return true, nil
		}
		util.TestCloudFrontFunctionWithCustomValidation(t, functionOutputMap["functionName"], functionStage, *testEvent, validateURI)
	}
}

// testJwtVerifyFunction with testevents
func testJwtVerifyFunction(t *testing.T, functionOutputsName string, workingDir string) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, workingDir)
	functionOutputMap := terraform.OutputMap(t, terraformOptions, functionOutputsName)
	functionStage := "LIVE"

	validateResponse := func(r *util.CloudFrontTestFunctionResult, expectedStatus float64, expectOriginalRequest bool) (bool, *string) {
		if r.Output == nil {
			return false, strPtr("Got nil Output")
		}
		output := *r.Output
		if expectOriginalRequest {
			if _, ok := output["request"]; !ok {
				// TODO: Fix flaky test?
				return false, strPtr("Expected request but did not find it in Function Output")
			}
			return true, nil
		}

		path := []string{"response", "statusCode"}
		statusCode := getNested[float64](output, path)
		if statusCode == nil {
			return false, strPtr(fmt.Sprintf("Missing %q in Function Response", strings.Join(path, ".")))
		}
		if *statusCode != expectedStatus {
			return false, strPtr(fmt.Sprintf("Got status code : %f\nWant status code:%f", *statusCode, expectedStatus))
		}
		return true, nil
	}

	tests := []struct {
		name                  string
		jwtValue              string
		expectedStatus        float64
		expectOriginalRequest bool
	}{
		{"Missing JWT", "", 401, false},
		{"Invalid JWT", "invalid-jwt", 401, false},
		{"Valid JWT", generateValidJWT(t), 200, true},
		{"Expired JWT", generateExpiredJWT(t), 401, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			testEvent, err := util.ReadCloudFrontEvent("testevents/kvs-jwt-verify/missing-jwt.json")
			require.NoError(t, err)
			if tc.jwtValue != "" {
				testEvent.Request.Querystring["jwt"] = util.ValueEntry{Value: tc.jwtValue}
			}
			util.TestCloudFrontFunctionWithCustomValidation(t, functionOutputMap["functionName"], functionStage, *testEvent, func(r *util.CloudFrontTestFunctionResult) (bool, *string) {
				return validateResponse(r, tc.expectedStatus, tc.expectOriginalRequest)
			})
		})
	}
}

func generateValidJWT(t *testing.T) string {
	jwt, err := GenerateJWT("terratest-test-secret", "test-user", "Test User", 1*time.Hour, 0*time.Second)
	require.NoError(t, err)
	return jwt
}

func generateExpiredJWT(t *testing.T) string {
	jwt, err := GenerateJWT("terratest-test-secret", "test-user", "Test User", 0*time.Second, 0*time.Second)
	require.NoError(t, err)
	return jwt
}

func strPtr(s string) *string {
	return &s
}

func getNested[T any](v any, keys []string) *T {
	if len(keys) == 0 {
		return nil
	}
	for _, k := range keys {
		m, ok := v.(map[string]any)
		if !ok {
			return nil
		}

		v, ok = m[k]
		if !ok {
			return nil
		}
	}

	s, ok := v.(T)
	if !ok {
		return nil
	}
	return &s
}
