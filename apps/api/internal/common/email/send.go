package email

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"text/template"
	"time"

	"github.com/pkg/errors"
	"github.com/resend/resend-go/v2"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/utils"
)

var emailClient *resend.Client
var once sync.Once

func SendSecurityAlertEmail(emailBuilder *EmailBuilder) (string, error) {
	return send(emailBuilder, "security-alerts@cloudyclip.com")
}

func send(emailBuilder *EmailBuilder, fromAddress string) (string, error) {
	once.Do(func() {
		emailClient = resend.NewClient(environment.Config.EmailProviderApiKey)
	})

	email := emailBuilder.Build()

	htmlBody, err := processHtmlBodyTemplate(&email)
	if err != nil {
		return "", errors.WithStack(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	messageId, err := utils.RetryWithReturnedValue(func() (string, error) {
		response, err := emailClient.Emails.SendWithContext(ctx, &resend.SendEmailRequest{
			From:    "Cloudy Clip <" + fromAddress + ">",
			To:      []string{email.destination},
			Subject: email.subject,
			Html:    htmlBody,
		})
		if err == nil {
			return response.Id, nil
		}

		if response != nil {
			return response.Id, err
		}

		return "", err
	})

	return messageId, errors.WithStack(err)
}

func processHtmlBodyTemplate(email *Email) (string, error) {
	emailFileContentBuffer, err := os.ReadFile(
		filepath.Join(environment.ResourcesDirectory, "emails", email.emailFileName),
	)
	if err != nil {
		return "", fmt.Errorf("failed to read email template file [%s]: %w", email.emailFileName, err)
	}

	tmpl, err := template.New(email.subject).Parse(string(emailFileContentBuffer))
	if err != nil {
		return "", fmt.Errorf("failed to parse email template file [%s]: %w", email.emailFileName, err)
	}

	var body bytes.Buffer
	err = tmpl.Execute(&body, email.templateVariableMap)
	if err != nil {
		return "", fmt.Errorf("failed to execute email template file [%s]: %w", email.emailFileName, err)
	}

	return body.String(), nil
}

func SendGenericAccountAlertEmail(emailBuilder *EmailBuilder) (string, error) {
	return send(emailBuilder, "no-reply@cloudyclip.com")
}
