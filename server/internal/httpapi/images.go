package httpapi

// Shared by every image upload in the app (DP-011 Chat attachments,
// Milestone 5 payment receipts, Club/User avatars) — decoded/raw byte
// cap, and the generous request-body cap that wraps it (base64
// expansion ~4/3 plus JSON overhead).
const (
	maxImageBytes     = 5 * 1024 * 1024
	maxImagePostBytes = 8 * 1024 * 1024
)

// isAllowedImageContentType is a fixed whitelist — this value is echoed
// back verbatim as the Content-Type header when the image is served, so
// it's validated strictly rather than trusted from the client.
func isAllowedImageContentType(ct string) bool {
	switch ct {
	case "image/jpeg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}
