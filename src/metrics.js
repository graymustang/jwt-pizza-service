const { metrics } = require('@opentelemetry/api');
const { MeterProvider, PeriodicExportingMetricReader } =
  require('@opentelemetry/sdk-metrics');
const { OTLPMetricExporter } =
  require('@opentelemetry/exporter-metrics-otlp-http');

const config = require('./config');

const exporter = new OTLPMetricExporter({
  url: config.metrics.endpointUrl,
  headers: {
    Authorization: 'Basic ' + Buffer.from(
      `${config.metrics.accountId}:${config.metrics.apiKey}`
    ).toString('base64'),
  },
});

const reader = new PeriodicExportingMetricReader({
  exporter,
  exportIntervalMillis: 60000,
});

const provider = new MeterProvider({
  readers: [reader],
});

metrics.setGlobalMeterProvider(provider);

const meter = metrics.getMeter(config.metrics.source);

const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total HTTP requests',
});

const requestLatency = meter.createHistogram('http_request_duration_ms', {
  description: 'HTTP request latency in milliseconds',
  unit: 'ms',
});

const authenticationCounter = meter.createCounter(
  'authentication_attempts_total',
  {
    description: 'Total authentication attempts',
  }
);

const activeUsersGauge = meter.createObservableGauge(
  'active_users',
  {
    description: 'Number of currently logged-in users',
  }
);

activeUsersGauge.addCallback(async (result) => {
  try {
    const { DB } = require('./database/database.js');
    const count = await DB.getActiveUserCount();

    result.observe(count);
  } catch (error) {
    console.error('Error collecting active users:', error);
  }
});

function recordAuthentication(success) {
  authenticationCounter.add(1, {
    result: success ? 'success' : 'failure',
  });
}

function requestTracker(req, res, next) {
  const start = performance.now();

  res.on('finish', () => {
    const attributes = {
      method: req.method,
      status: res.statusCode,
    };

    requestCounter.add(1, attributes);

    const latency = performance.now() - start;
    requestLatency.record(latency, attributes);
  });

  next();
}

module.exports = {
  requestTracker,
  recordAuthentication,
};
