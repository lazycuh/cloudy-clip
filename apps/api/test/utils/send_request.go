package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/h2non/gock"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/cloudy-clip/api/internal/common/http/middleware/turnstile"
)

func SendPostRequest(
	t *testing.T,
	testServer *httptest.Server,
	endpoint string,
	requestBody any,
	headers map[string]string,
) (*http.Response, map[string]any) {
	return sendRequest(t, testServer, http.MethodPost, endpoint, requestBody, headers)
}

func sendRequest(
	t *testing.T,
	testServer *httptest.Server,
	method string,
	endpoint string,
	requestBody any,
	headers map[string]string,
) (*http.Response, map[string]any) {
	_, hasTurnstileHeader := headers[turnstile.TurnstileTokenHeader]
	if hasTurnstileHeader {
		responseMock := gock.New("https://challenges.cloudflare.com").
			Post("/turnstile/v0/siteverify").
			Reply(http.StatusOK).
			JSON(map[string]any{
				"success": true,
			})

		defer gock.Remove(responseMock.Mock)
	}

	gock.New(testServer.URL).
		EnableNetworking()

	turnstile.ClearCache()

	if requestBody == nil {
		requestBody = map[string]any{}
	}

	var requestBodyPayload []byte

	requestBodyBytes, ok := requestBody.([]byte)
	if ok {
		requestBodyPayload = requestBodyBytes
	} else {
		marshaledRequestBody, err := json.Marshal(requestBody)
		if err != nil {
			t.Fatalf("failed to stringify request body; error was %v\n", err)
		}

		requestBodyPayload = marshaledRequestBody
	}

	request, err := http.NewRequest(method, testServer.URL+endpoint, bytes.NewReader(requestBodyPayload))
	if err != nil {
		t.Fatalf("failed to create '%s' request to '%s'; error was %v\n", method, endpoint, err)

		panic(err)
	}

	for name, value := range headers {
		request.Header.Set(name, value)
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("failed to send '%s' request to '%s'; error was %v\n", method, endpoint, err)

		panic(err)
	}

	if response.ContentLength == 0 {
		return response, nil
	}

	var responseBodyJson map[string]any
	err = json.NewDecoder(response.Body).Decode(&responseBodyJson)
	if err != nil {
		t.Fatalf("failed to parse response body into JSON; error was %v\n", err)

		panic(err)
	}
	defer func() {
		err := response.Body.Close()
		if err != nil {
			t.Fatalf("failed to close response body; error was %v\n", err)

			panic(err)
		}
	}()

	return response, responseBodyJson
}

func SendGetRequest(
	t *testing.T,
	testServer *httptest.Server,
	endpoint string,
	headers map[string]string,
) (*http.Response, map[string]any) {
	return sendRequest(t, testServer, http.MethodGet, endpoint, nil, headers)
}

func SendPatchRequest(
	t *testing.T,
	testServer *httptest.Server,
	endpoint string,
	requestBody any,
	headers map[string]string,
) (*http.Response, map[string]any) {
	return sendRequest(t, testServer, http.MethodPatch, endpoint, requestBody, headers)
}

func SendPutRequest(
	t *testing.T,
	testServer *httptest.Server,
	endpoint string,
	requestBody any,
	headers map[string]string,
) (*http.Response, map[string]any) {
	return sendRequest(t, testServer, http.MethodPut, endpoint, requestBody, headers)
}

func SendDeleteRequest(
	t *testing.T,
	testServer *httptest.Server,
	endpoint string,
	headers map[string]string,
) (*http.Response, map[string]any) {
	return sendRequest(t, testServer, http.MethodDelete, endpoint, nil, headers)
}
