package test

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func GenerateJWT(key, sub, name string, expire, notBefore time.Duration) (string, error) {
	if key == "" {
		return "", fmt.Errorf("key cannot be empty")
	}
	// use HS256
	token := jwt.New(jwt.SigningMethodHS256)

	issued := time.Now()
	// payload claims
	claims := token.Claims.(jwt.MapClaims)
	claims["sub"] = sub                          // Subject (user identifier)
	claims["name"] = name                        // User's name
	claims["iat"] = issued.Unix()                // Issued at: current time
	claims["nbf"] = issued.Add(notBefore).Unix() // Set Not before
	claims["exp"] = issued.Add(expire).Unix()    // Set Expiry

	return token.SignedString([]byte(key))
}
