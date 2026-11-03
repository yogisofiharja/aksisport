package db

// imageVersionExpr turns an image's last-changed timestamp (e.g.
// "u.avatar_updated_at") into the version clients add to its URL (?v=),
// so a replaced image never reuses a cached copy of the old one — image
// responses are cached as immutable. NULL when there is no image.
func imageVersionExpr(timestampColumn string) string {
	return "(floor(extract(epoch from " + timestampColumn + ") * 1000))::bigint"
}
