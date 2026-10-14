package db

import "regexp"

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// IsUUID reports whether s is a well-formed id. Lookups by an id taken
// from a URL check this first, so a malformed one is "not found" rather
// than a database error — while the query itself still compares UUIDs
// and uses the index.
func IsUUID(s string) bool { return uuidPattern.MatchString(s) }
