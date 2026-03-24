package api

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
)

// UUIDToString converts a pgtype.UUID to a standard string representation
func UUIDToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	b := u.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// StringToUUID converts a string representation to a pgtype.UUID (naively, no validation)
func StringToUUID(s string) pgtype.UUID {
	var u pgtype.UUID
	err := u.Scan(s)
	if err != nil {
		u.Valid = false
	}
	return u
}
