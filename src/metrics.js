const { metrics } = require('@opentelemetry/api');
const os = require('os');
const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
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
  resource: resourceFromAttributes({
    'service.name': config.metrics.source,
  }),
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

const pizzasSoldCounter = meter.createCounter('pizzas_sold_total', {
  description: 'Total number of pizzas sold',
});

const pizzaFailuresCounter = meter.createCounter('pizza_creation_failures_total', {
  description: 'Total failed pizza creation attempts',
});

const pizzaRevenueCounter = meter.createCounter('pizza_revenue_total', {
  description: 'Total revenue from pizza purchases',
});

const pizzaLatencyHistogram = meter.createHistogram('pizza_creation_duration_ms', {
  description: 'Time required to create pizzas',
  unit: 'ms',
});

const cpuUsageGauge = meter.createObservableGauge(
  'cpu_usage_percent',
  {
    description: 'System CPU usage percentage',
    unit: '%',
  }
);

const memoryUsageGauge = meter.createObservableGauge(
  'memory_usage_percent',
  {
    description: 'System memory usage percentage',
    unit: '%',
  }
);

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return Math.min(cpuUsage * 100, 100);
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();

  return ((totalMemory - freeMemory) / totalMemory) * 100;
}

cpuUsageGauge.addCallback((result) => {
  result.observe(getCpuUsagePercentage());
});

memoryUsageGauge.addCallback((result) => {
  result.observe(getMemoryUsagePercentage());
});

function recordPizzaPurchase(success, quantity, revenue, latency) {
  pizzaLatencyHistogram.record(latency);

  if (success) {
    pizzasSoldCounter.add(quantity);
    pizzaRevenueCounter.add(revenue);
  } else {
    pizzaFailuresCounter.add(1);
  }
}

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
  recordPizzaPurchase,
};
