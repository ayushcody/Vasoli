package merchantnorm

import (
	"regexp"
	"strings"
)

var (
	// cleanupRegexes are run in order
	cleanupRegexes = []*regexp.Regexp{
		// Common Indian Bank statement prefixes
		regexp.MustCompile(`^(?i)(UPI|IMPS|NEFT)-?[a-zA-Z0-9]+-`),
		regexp.MustCompile(`^(?i)(UPI\/[A-Z0-9]+\/)`), // UPI/CRORHDFC/
		regexp.MustCompile(`^(?i)TO TRANSFER-UPI\/` + `[A-Z0-9]+\/`),
		regexp.MustCompile(`^(?i)TO TRANSFER-(IMPS|NEFT)\/` + `[A-Z0-9]+\/`),
		regexp.MustCompile(`^(?i)UPI\/`), // UPI/
		
		// Remove bank transaction tokens like POS, ECOM, etc.
		regexp.MustCompile(`^(?i)(POS|ECOM|ATM) `),
		
		// Indian common trailing elements (like @upi, @ybl)
		regexp.MustCompile(`@[a-zA-Z]+$`), 
		
		// Extra spaces and special characters
		regexp.MustCompile(`[^a-zA-Z0-9&]`),
	}
)

// NormalizeMerchant takes a raw merchant string or description 
// and returns a normalized version suitable for grouping.
func NormalizeMerchant(raw, description string) string {
	input := raw
	if input == "" {
		input = description
	}
	
	// Fast path for empty
	if input == "" {
		return "Unknown Merchant"
	}

	norm := input

	// Apply all cleanup regexes
	for _, re := range cleanupRegexes {
		norm = re.ReplaceAllString(norm, " ")
	}

	// Squeeze whitespace
	norm = strings.Join(strings.Fields(norm), " ")
	
	// Trim and title case
	norm = strings.TrimSpace(norm)
	norm = strings.ToUpper(norm)

	if norm == "" {
		return "Unknown Merchant"
	}

	// Deduplicate words (e.g. SWIGGY SWIGGY -> SWIGGY)
	words := strings.Fields(norm)
	var unique []string
	seen := make(map[string]bool)
	for _, w := range words {
		if !seen[w] {
			seen[w] = true
			unique = append(unique, w)
		}
	}
	norm = strings.Join(unique, " ")

	return norm
}
