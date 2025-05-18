package email

import "github.com/cloudy-clip/api/internal/common/environment"

type Email struct {
	subject             string
	emailFileName       string
	destination         string
	templateVariableMap map[string]string
}

type EmailBuilder struct {
	email Email
}

func NewEmailBuilder() *EmailBuilder {
	return &EmailBuilder{
		email: Email{
			templateVariableMap: map[string]string{
				"HostName": environment.Config.AccessControlAllowOrigin,
			},
		},
	}
}

func (emailBuilder *EmailBuilder) WithSubject(subject string) *EmailBuilder {
	emailBuilder.email.subject = subject

	return emailBuilder
}

func (emailBuilder *EmailBuilder) WithEmailFile(emailFileName string) *EmailBuilder {
	emailBuilder.email.emailFileName = emailFileName

	return emailBuilder
}

func (emailBuilder *EmailBuilder) WithDestinationEmail(to string) *EmailBuilder {
	emailBuilder.email.destination = to

	return emailBuilder
}

func (emailBuilder *EmailBuilder) SetTemplateVariable(variableName string, variableValue string) *EmailBuilder {
	emailBuilder.email.templateVariableMap[variableName] = variableValue

	return emailBuilder
}

func (emailBuilder *EmailBuilder) Build() Email {
	return emailBuilder.email
}
