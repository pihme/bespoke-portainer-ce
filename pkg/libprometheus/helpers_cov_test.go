package libprometheus

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	pkgmetrics "github.com/portainer/portainer/pkg/metrics"
	dto "github.com/prometheus/client_model/go"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestValueFromMetric_AllScalarTypes(t *testing.T) {
	t.Parallel()

	counterVal := 3.5
	gaugeVal := 1.25
	untypedVal := 9.0

	require.Equal(t, 3.5, ValueFromMetric(&dto.Metric{Counter: &dto.Counter{Value: &counterVal}}, dto.MetricType_COUNTER))
	require.Equal(t, 0.0, ValueFromMetric(&dto.Metric{}, dto.MetricType_COUNTER))

	require.Equal(t, 1.25, ValueFromMetric(&dto.Metric{Gauge: &dto.Gauge{Value: &gaugeVal}}, dto.MetricType_GAUGE))
	require.Equal(t, 0.0, ValueFromMetric(&dto.Metric{}, dto.MetricType_GAUGE))

	require.Equal(t, 9.0, ValueFromMetric(&dto.Metric{Untyped: &dto.Untyped{Value: &untypedVal}}, dto.MetricType_UNTYPED))
	require.Equal(t, 0.0, ValueFromMetric(&dto.Metric{}, dto.MetricType_UNTYPED))

	require.Equal(t, 0.0, ValueFromMetric(&dto.Metric{}, dto.MetricType_SUMMARY))
}

func TestLabelsFromMetric_IncludesPairs(t *testing.T) {
	t.Parallel()
	name := "job"
	value := "api"
	m := &dto.Metric{
		Label: []*dto.LabelPair{{Name: &name, Value: &value}},
	}
	lbls := LabelsFromMetric("up", m)
	require.Equal(t, "up", lbls.Get("__name__"))
	require.Equal(t, "api", lbls.Get("job"))
}

func TestAlertStateAndTierPriority(t *testing.T) {
	t.Parallel()
	require.Equal(t, 2, alertStatePriority(pkgmetrics.AlertRuleStateFiring))
	require.Equal(t, 1, alertStatePriority(pkgmetrics.AlertRuleStatePending))
	require.Equal(t, 0, alertStatePriority(pkgmetrics.AlertRuleStateOK))

	require.Equal(t, 2, tierSeverityPriority("critical"))
	require.Equal(t, 1, tierSeverityPriority("warning"))
	require.Equal(t, 0, tierSeverityPriority("info"))
	require.Equal(t, -1, tierSeverityPriority("unknown"))
}

func TestParseTarget(t *testing.T) {
	t.Parallel()

	scheme, path, host, err := parseTarget("https://example.com:9093/alerts", "/default")
	require.NoError(t, err)
	require.Equal(t, "https", scheme)
	require.Equal(t, "/alerts", path)
	require.Equal(t, "example.com:9093", host)

	scheme, path, host, err = parseTarget("/metrics", "/am")
	require.NoError(t, err)
	require.Equal(t, "http", scheme)
	require.Equal(t, "/metrics", path)
	require.Equal(t, "/metrics", host) // empty Host falls back to the raw target

	_, _, _, err = parseTarget("http://[::1", "")
	require.Error(t, err)
}

func TestRenderAlertingSection_EmptyAndInvalid(t *testing.T) {
	t.Parallel()
	escape := func(s string) string { return s }

	out, err := renderAlertingSection("", nil, false, escape)
	require.NoError(t, err)
	require.Equal(t, "", out)

	_, err = renderAlertingSection("http://[::1", nil, false, escape)
	require.Error(t, err)
}

func TestAppendExpositionSamples_ParseError(t *testing.T) {
	t.Parallel()
	err := AppendExpositionSamples(context.Background(), nil, strings.NewReader("# TYPE broken"))
	require.Error(t, err)
}

func TestAppendExpositionSamples_CounterAndUntyped(t *testing.T) {
	t.Parallel()
	db, err := NewInMemoryTSDB(nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	exposition := strings.NewReader(`# TYPE c_total counter
c_total{job="x"} 7
# TYPE u_metric untyped
u_metric 3
`)
	require.NoError(t, AppendExpositionSamples(context.Background(), db, exposition))
}

func TestZerologHandler_LevelsAndGroup(t *testing.T) {
	t.Parallel()
	h := zerologHandler{}
	require.Equal(t, h, h.WithGroup("g"))
	require.Equal(t, h, h.WithAttrs([]slog.Attr{slog.String("k", "v")}))

	require.Equal(t, zerolog.ErrorLevel, slogToZerologLevel(slog.LevelError))
	require.Equal(t, zerolog.WarnLevel, slogToZerologLevel(slog.LevelWarn))
	require.Equal(t, zerolog.InfoLevel, slogToZerologLevel(slog.LevelInfo))
	require.Equal(t, zerolog.DebugLevel, slogToZerologLevel(slog.LevelDebug))

	rec := slog.NewRecord(time.Now(), slog.LevelInfo, "hello", 0)
	rec.AddAttrs(slog.String("k", "v"))
	require.NoError(t, h.Handle(context.Background(), rec))
}

func TestWritePrometheusConfig_EmptyAlertmanager(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	require.NoError(t, WritePrometheusConfig(dir, PrometheusConfigOptions{
		ScrapeInterval: "15s",
		JobName:        "local",
		ScrapeTarget:   "http://127.0.0.1:9001/metrics",
	}))
}

func TestBootstrapManagerSet_InvalidDataDir(t *testing.T) {
	t.Parallel()
	// Point dataDir at an existing file so WritePrometheusConfig cannot create config.yaml.
	f := t.TempDir() + "/not-a-dir"
	require.NoError(t, os.WriteFile(f, []byte("x"), 0o600))
	_, err := BootstrapManagerSet(f, PrometheusConfigOptions{
		ScrapeInterval: "15s",
		JobName:        "local",
		ScrapeTarget:   "http://127.0.0.1:1/metrics",
	}, nil, nil)
	require.Error(t, err)
}
