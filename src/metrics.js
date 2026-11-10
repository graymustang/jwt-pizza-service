const httpMetrics = {
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
  total: 0,
};

const requestLatencies = [];

function requestTracker(req, res, next) {
  const start = performance.now();

  res.on('finish', () => {
    const method = req.method;

    httpMetrics.total++;

    if (Object.hasOwn(httpMetrics, method)) {
      httpMetrics[method]++;
    }

    const latency = performance.now() - start;
    requestLatencies.push(latency);
  });

  next();
}

module.exports = {
  requestTracker,
  httpMetrics,
  requestLatencies,
};
