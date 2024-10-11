package test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"github.com/environment-toolkit/go-synth"
	"github.com/environment-toolkit/go-synth/executors"
	"github.com/environment-toolkit/go-synth/models"
	util "github.com/envtio/base/integ/aws"
	"github.com/google/go-cmp/cmp"
	"github.com/gruntwork-io/terratest/modules/aws"
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

// TODO: Add support for test assertions, ref:
// https://github.com/aws/aws-cdk/blob/v2.161.1/packages/%40aws-cdk-testing/framework-integ/test/aws-iam/test/integ.imported-role.ts#L42-L47
// Also: Ability to snapshot the full synth folder and only run test if a diff in the snapshot is detected?

// Run the role integration test
func TestRole(t *testing.T) {
	t.Parallel()
	testApp := "role"
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

	// Confirm the role policies are as expected
	test_structure.RunTestStage(t, "validate", func() {
		testCases := []struct {
			outputs      string
			snapshotFile string
		}{
			{"TestRoleOutputs", "TestRole-assume-role.json"},
			{"TestRole2Outputs", "TestRole2-assume-role.tmpl.json"},
			{"TestRole3Outputs", "TestRole3-assume-role.json"},
		}

		for _, tc := range testCases {
			tc := tc // capture range variable
			t.Run(tc.outputs, func(t *testing.T) {
				snapshotPath := filepath.Join("snapshots", testApp)
				testRole(t, awsRegion, tc.outputs, tfWorkingDir, snapshotPath, []check{
					{
						fieldPath:   "AssumeRolePolicyDocument",
						shouldMatch: tc.snapshotFile,
						unmarshal:   true,
					}})
			})
		}
	})
}

// Run the composite principal integration test
func TestCompositePrincipal(t *testing.T) {
	t.Parallel()
	testApp := "composite-principal"
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

	// Confirm the Composite Principal Policy is as expected
	test_structure.RunTestStage(t, "validate", func() {
		snapshotPath := filepath.Join("snapshots", testApp)
		checks := []check{
			{
				fieldPath:   "AssumeRolePolicyDocument",
				shouldMatch: "assume-role.json",
				unmarshal:   true,
			},
		}
		testRole(t, awsRegion, "RoleWithCompositePrincipalOutputs", tfWorkingDir, snapshotPath, checks)
	})
}

// Run the condition with references integration test
func TestConditionWithRef(t *testing.T) {
	t.Parallel()
	testApp := "condition-with-ref"
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

	// Confirm the AccountRoot Principal Policy is as expected
	test_structure.RunTestStage(t, "validate", func() {
		snapshotPath := filepath.Join("snapshots", testApp)
		checks := []check{
			{
				fieldPath:   "AssumeRolePolicyDocument",
				shouldMatch: "assume-role.tmpl.json",
				unmarshal:   true,
			},
		}
		testRole(t, awsRegion, "MyRoleOutputs", tfWorkingDir, snapshotPath, checks)
	})
}

// Run the condition with references integration test
func TestManagedPolicy(t *testing.T) {
	t.Parallel()
	testApp := "managed-policy"
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

	// Confirm the Role Principal Policy is as expected
	test_structure.RunTestStage(t, "validate", func() {
		snapshotPath := filepath.Join("snapshots", testApp)
		roleChecks := []check{
			{
				fieldPath:   "AssumeRolePolicyDocument",
				shouldMatch: "Role-assumeDoc.tmpl.json",
				unmarshal:   true,
			},
			{
				fieldPath:   "AttachedPolicyArns",
				shouldMatch: "Role-attachedPolicyArns.tmpl.json",
			},
		}
		testRole(t, awsRegion, "RoleOutputs", tfWorkingDir, snapshotPath, roleChecks)
		policyOneChecks := []check{
			{
				fieldPath:   "PolicyDocument",
				shouldMatch: "OneManagedPolicy-doc.tmpl.json",
				unmarshal:   true,
			},
		}
		testManagedPolicy(t, awsRegion, "OneManagedPolicyOutputs", tfWorkingDir, snapshotPath, policyOneChecks)
		policyTwoChecks := []check{
			{
				fieldPath:   "PolicyDocument",
				shouldMatch: "TwoManagedPolicy-doc.tmpl.json",
				unmarshal:   true,
			},
		}
		testManagedPolicy(t, awsRegion, "TwoManagedPolicyOutputs", tfWorkingDir, snapshotPath, policyTwoChecks)
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
		t.Fatal("Failed to read " + mainTsFile)
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

// validate the role created
func testRole(t *testing.T, awsRegion string, roleKey string, tfWorkingDir string, snapshotDir string, checks []check) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	roleName := loadOutputAttribute(t, terraformOptions, roleKey, "name")
	role := util.GetIamRole(t, awsRegion, roleName)
	if snapshotDir != "" {
		if os.Getenv("WRITE_SNAPSHOTS") == "true" {
			// write a single full role snapshot
			writeSnapshot(t, snapshotDir, role, roleKey)
		} else {
			tmplVars := util.Variables{
				"AccountId": aws.GetAccountId(t),
			}
			runChecks(t, snapshotDir, role, checks, &tmplVars)
		}
	}
}

// validate the managed Policy created
func testManagedPolicy(t *testing.T, awsRegion string, managedRoleKey string, tfWorkingDir string, snapshotDir string, checks []check) {
	// Load the Terraform Options saved by the earlier deploy_terraform stage
	terraformOptions := test_structure.LoadTerraformOptions(t, tfWorkingDir)
	managedRoleArn := loadOutputAttribute(t, terraformOptions, managedRoleKey, "arn")
	policy := util.GetIamManagedPolicy(t, awsRegion, managedRoleArn)
	if snapshotDir != "" {
		if os.Getenv("WRITE_SNAPSHOTS") == "true" {
			// write a single full policy snapshot
			writeSnapshot(t, snapshotDir, policy, managedRoleKey)
		} else {
			tmplVars := util.Variables{
				"AccountId": aws.GetAccountId(t),
			}
			runChecks(t, snapshotDir, policy, checks, &tmplVars)
		}
	}
}

// writeSnapshot writes the full entity to a snapshot file
// this is useful in an initial run to capture the created resources in AWs.
func writeSnapshot(t *testing.T, snapshotDir string, entity any, entityName string) {
	fileName := filepath.Join(snapshotDir, "outputs", entityName+".json")
	roleString, err := json.MarshalIndent(entity, "", "  ")
	require.NoError(t, err)
	err = os.MkdirAll(filepath.Dir(fileName), 0755)
	require.NoError(t, err)
	terratestLogger.Logf(t, "Writing snapshot to %s", fileName)
	err = os.WriteFile(fileName, roleString, 0644)
	require.NoError(t, err)
}

// loadOutputAttribute loads the name of a role from Terraform outputs and ensures it is not empty.
func loadOutputAttribute(t *testing.T, terraformOptions *terraform.Options, key, attribute string) string {
	outputs := terraform.OutputMap(t, terraformOptions, key)
	value := outputs[attribute]
	require.NotEmpty(t, value, fmt.Sprintf("Output %s.%s should not be empty", key, attribute))
	return value
}

// Check defines fragments to match a snapshot.
// the snapshot may include `regex::` prefix for matching string fields with regular expressions.
type check struct {
	fieldPath   string // the path to the field in the struct
	unmarshal   bool   // if the the field should be unmarshalled
	shouldMatch string // the name of the snapshot file to compare against
}

// runChecks validates entity fields against snapshot files
// the snapshot files may include `regex::` prefix for matching string fields with regular expressions.
// the entity fields are accessed using the fieldPath.
func runChecks(t *testing.T, snapshotDir string, entity any, checks []check, tmplVars *util.Variables) {
	for _, c := range checks {
		t.Run(c.shouldMatch, func(t *testing.T) {
			t.Parallel()
			snapFullPath := filepath.Join(snapshotDir, c.shouldMatch)
			if _, err := os.Stat(snapFullPath); err != nil {
				t.Fatalf("Expected snapshot file %s to exist", snapFullPath)
			}

			expectedBytes, err := os.ReadFile(snapFullPath)
			require.NoError(t, err)

			if strings.HasSuffix(c.shouldMatch, ".tmpl.json") {
				expectedString, err := tmplVars.Apply(string(expectedBytes))
				require.NoError(t, err)
				expectedBytes = []byte(expectedString)
			}

			var expected interface{}
			err = json.Unmarshal(expectedBytes, &expected)
			require.NoError(t, err)

			val, err := getFieldValue(entity, c.fieldPath)
			require.NoError(t, err)

			var actual interface{}
			if c.unmarshal {
				strVal, ok := val.(string)
				if !ok {
					t.Fatalf("Expected field %s to be a string containing JSON, but got %T", c.fieldPath, val)
				}
				err = json.Unmarshal([]byte(strVal), &actual)
				require.NoError(t, err)
			} else {
				actual = val
			}

			// Try to match actual type
			switch actual.(type) {
			case []string:
				expectedSlice, ok := expected.([]interface{})
				if ok {
					expectedStrings := make([]string, len(expectedSlice))
					for i, v := range expectedSlice {
						expectedStrings[i], ok = v.(string)
						if !ok {
							t.Fatalf("Expected element %d to be a string, but got %T", i, v)
						}
					}
					expected = expectedStrings
				}
			}
			result := cmp.Diff(expected, actual, cmp.Comparer(regexStringComparer))
			require.Empty(t, result, "(-want +got)")
		})
	}
}

// Access a nested field in the struct
func getFieldValue(data interface{}, fieldPath string) (interface{}, error) {
	// TODO: use https://pkg.go.dev/github.com/PaesslerAG/jsonpath#example-package-Gval instead?
	if fieldPath == "." {
		return data, nil
	}
	fields := strings.Split(fieldPath, ".")
	val := reflect.ValueOf(data)
	for _, field := range fields {
		if val.Kind() == reflect.Ptr {
			val = val.Elem()
		}
		if val.Kind() != reflect.Struct {
			return nil, fmt.Errorf("expected struct but got %s", val.Kind())
		}
		val = val.FieldByName(field)
		if !val.IsValid() {
			return nil, fmt.Errorf("field '%s' not found", field)
		}
	}
	return val.Interface(), nil
}

// regexStringComparer is a custom comparer for strings that allows for regex pattern matching.
//
// Option configures for specific behavior of Equal and Diff.
// In particular, the fundamental Option functions (Ignore, Transformer, and Comparer),
// configure how equality is determined.
//
// ref: https://pkg.go.dev/github.com/google/go-cmp/cmp#example-Option-EqualNaNs
func regexStringComparer(a, b string) bool {
	getPattern := func(s string) (string, bool) {
		if strings.HasPrefix(s, "regex::") {
			return strings.TrimPrefix(s, "regex::"), true
		}
		return s, false
	}

	patternA, isRegexA := getPattern(a)
	patternB, isRegexB := getPattern(b)

	switch {
	case isRegexA && isRegexB:
		return patternA == patternB
	case isRegexA:
		matched, err := regexp.MatchString(patternA, b)
		if err != nil {
			panic(fmt.Sprintf("Invalid regex pattern '%s': %v", patternA, err))
		}
		return matched
	case isRegexB:
		matched, err := regexp.MatchString(patternB, a)
		if err != nil {
			panic(fmt.Sprintf("Invalid regex pattern '%s': %v", patternB, err))
		}
		return matched
	default:
		return a == b
	}
}
