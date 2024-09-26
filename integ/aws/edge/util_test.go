package test

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestGenerateJWT(t *testing.T) {
	sub := "1234567890"
	name := "John Doe"
	key := "secret-key"

	t.Run("Happy Path", func(t *testing.T) {
		token, err := GenerateJWT(key, sub, name, time.Hour, time.Millisecond)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)

		parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			return []byte(key), nil
		})
		assert.NoError(t, err)
		assert.True(t, parsedToken.Valid)

		claims, ok := parsedToken.Claims.(jwt.MapClaims)
		assert.True(t, ok)
		assert.Equal(t, sub, claims["sub"])
		assert.Equal(t, name, claims["name"])

		expirationTime := claims["exp"].(float64)
		assert.True(t, time.Now().Unix() < int64(expirationTime))
	})

	t.Run("Empty Key", func(t *testing.T) {
		token, err := GenerateJWT("", sub, name, 1*time.Hour, 0*time.Second)
		assert.Error(t, err)
		assert.Empty(t, token)
	})

	t.Run("Invalid Key", func(t *testing.T) {
		token, err := GenerateJWT(key, sub, name, time.Hour, time.Millisecond)
		assert.NoError(t, err)
		assert.NotEmpty(t, token)

		parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
			return []byte("invalid-key"), nil
		})
		assert.Error(t, err)
		assert.False(t, parsedToken.Valid)
	})
}
