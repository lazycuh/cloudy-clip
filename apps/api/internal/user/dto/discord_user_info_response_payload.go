package dto

type DiscordUserInfoResponsePayload struct {
	DisplayName string `json:"global_name"`
	Email       string `json:"email"`
}
