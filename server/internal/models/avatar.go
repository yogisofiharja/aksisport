package models

// AvatarImage is the byte-serving shape for a Club or User profile
// picture — fetched by id, never embedded in a list response. Same
// pattern as ParticipantReceiptImage.
type AvatarImage struct {
	Data        []byte
	ContentType string
}
