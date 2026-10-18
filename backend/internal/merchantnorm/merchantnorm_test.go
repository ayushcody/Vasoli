package merchantnorm

import "testing"

func TestNormalizeMerchant(t *testing.T) {
	tests := []struct {
		name        string
		raw         string
		description string
		expected    string
	}{
		{
			name:        "UPI transfer format 1",
			raw:         "UPI/31235123/Swiggy/swiggy@hdfcbank",
			description: "",
			expected:    "SWIGGY",
		},
		{
			name:        "UPI transfer format 2",
			raw:         "UPI-12341234-Amazon Pay",
			description: "",
			expected:    "AMAZON PAY",
		},
		{
			name:        "POS transaction",
			raw:         "POS 1234 STARBUCKS",
			description: "",
			expected:    "1234 STARBUCKS",
		},
		{
			name:        "Just simple name",
			raw:         "Netflix.com",
			description: "",
			expected:    "NETFLIX COM", // We remove special chars
		},
		{
			name:        "Empty raw, uses description",
			raw:         "",
			description: "UPI/Zomato/zomato@paytm",
			expected:    "ZOMATO",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeMerchant(tt.raw, tt.description)
			if got != tt.expected {
				t.Errorf("NormalizeMerchant() = %v, want %v", got, tt.expected)
			}
		})
	}
}
