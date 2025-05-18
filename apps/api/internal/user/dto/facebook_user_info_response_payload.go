package dto

type FacebookUserInfoResponsePayload struct {
	FacebookUserId string `json:"id"`
	DisplayName    string `json:"name"`
	Email          string `json:"email"`
}
