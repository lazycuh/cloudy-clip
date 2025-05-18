package test

import (
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
)

func GetCookieFromResponse(t *testing.T, response *http.Response, cookieName string) *http.Cookie {
	cookieIndex := slices.IndexFunc(response.Cookies(), func(cookie *http.Cookie) bool {
		return cookie.Name == cookieName
	})
	require.NotEqual(
		t,
		-1,
		cookieIndex,
		fmt.Sprintf("no cookie with name '%s' was found", cookieName),
	)

	return response.Cookies()[cookieIndex]
}

func GetCookieValueFromResponse(t *testing.T, response *http.Response, cookieName string) string {
	return GetCookieFromResponse(t, response, cookieName).Value
}
