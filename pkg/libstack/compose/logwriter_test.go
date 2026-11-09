package compose

import (
	"bytes"
	"testing"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/require"
)

func Test_LogrusToZerologWriter_Write(t *testing.T) {
	var buf bytes.Buffer
	old := log.Logger
	log.Logger = zerolog.New(&buf)
	t.Cleanup(func() { log.Logger = old })

	w := LogrusToZerologWriter{}

	cases := []struct {
		name    string
		input   string
		wantSub string
	}{
		{
			name:    "structured_info",
			input:   `time="2023-10-01T12:34:56Z" level=info msg="stack-up" key=value` + "\n",
			wantSub: "stack-up",
		},
		{
			name:    "structured_debug",
			input:   `time="2023-10-01T12:34:56Z" level=debug msg="detail"`,
			wantSub: "detail",
		},
		{
			name:    "structured_warn",
			input:   `time="2023-10-01T12:34:56Z" level=warn msg="careful"`,
			wantSub: "careful",
		},
		{
			name:    "structured_warning",
			input:   `time="2023-10-01T12:34:56Z" level=warning msg="careful2"`,
			wantSub: "careful2",
		},
		{
			name:    "structured_error",
			input:   `time="2023-10-01T12:34:56Z" level=error msg="boom"`,
			wantSub: "boom",
		},
		{
			name:    "structured_fatal",
			input:   `time="2023-10-01T12:34:56Z" level=fatal msg="die"`,
			wantSub: "die",
		},
		{
			name:    "structured_panic",
			input:   `time="2023-10-01T12:34:56Z" level=panic msg="panic-msg"`,
			wantSub: "panic-msg",
		},
		{
			name:    "structured_unknown_level",
			input:   `time="2023-10-01T12:34:56Z" level=trace msg="tracey"`,
			wantSub: "tracey",
		},
		{
			name:    "simple_fallback",
			input:   "plain compose line\n",
			wantSub: "plain compose line",
		},
		{
			name:    "time_prefix_too_short",
			input:   `time="2023-10-01T12:34:56Z" only-two`,
			wantSub: "", // still writes; message may be empty when parts < 3
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			buf.Reset()
			n, err := w.Write([]byte(tc.input))
			require.NoError(t, err)
			require.Equal(t, len(tc.input), n)
			if tc.wantSub != "" {
				require.Contains(t, buf.String(), tc.wantSub)
			}
		})
	}
}
