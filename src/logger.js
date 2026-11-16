const { AsyncLocalStorage } = require('async_hooks');
const config = require('./config.js');

const requestContext = new AsyncLocalStorage();
const sensitiveField = /(authorization|password|passwd|token|jwt|secret|api.?key|cookie|email|phone|address|credit.?card|(^|first|last)name)/i;
const sensitiveText = [ /\bBearer\s+[^\s"']+/gi, /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, /\bglc_[a-zA-Z0-9_-]+\b/g, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, /(authorization|password|passwd|token|jwt|secret|api.?key|cookie|email|phone|address|credit.?card|name)=([^&\s]+)/gi
];

function sanitize(value, key = '') {
  if (sensitiveField.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey),])
    );
  }
  if (typeof value ==='string') {
    return sensitiveText.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), value);
  }
  return value;
}

function safeUser(user) {
  if (!user) return undefined;
  return {
    id: user.id,
    name: sanitize(user.name, 'name'),
    roles: (user.roles || []).map(({ role }) => role),
  };
}

function currentUser() {
  return requestContext.getStore()?.user;
}

function sendLogToGrafana(event) {
  const { logging } = config;
  if (!logging?.endpointUrl || !logging?.accountId || !logging?.apiKey) return;

  const timestamp = `${Date.now()}000000`;
  const payload = {
    streams: [
      {
        stream: { source: logging.source || 'jwt-pizza-service' },
        values: [[timestamp, JSON.stringify(sanitize(event))]],
      },
    ],
  };

  Promise.resolve()
    .then(() => fetch(logging.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${logging.accountId}:${logging.apiKey}`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
    }))
    .then((response) => {
      if (!response.ok) console.error(`Grafana log push failed with status ${response.status}`);
    })
    .catch((error) => {
      console.error(`Grafana log push failed: ${sanitize(error.message)}`);
    });
}

function log(event) {
  sendLogToGrafana({ timestamp: new Date().toISOString(), ...event, user: event.user ?? currentUser() });
}

function httpLogger(req, res, next) {
  const startedAt = Date.now();
  let responseBody;
  const send = res.send;
  res.send = function (body) {
    responseBody = body;
    return send.call(this, body);
  };

  res.once('finish', () => {
    let parsedResponse = responseBody;
    if (Buffer.isBuffer(parsedResponse)) parsedResponse = parsedResponse.toString('utf8');
    if (typeof parsedResponse === 'string') {
      try {
        parsedResponse = JSON.parse(parsedResponse);
      } catch {
        //keep non json response bodies as string
      }
    }

    log({
      type: 'http',
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      hasAuthorization: Boolean(req.headers.authorization),
      request: req.body ?? {},
      response: parsedResponse,
      durationMs: Date.now() - startedAt,
      user: safeUser(req.user),
    });
  });

  next();
}

function requestContextMiddleware(req, res, next) {
  requestContext.run({ user: safeUser(req.user) }, next);
}

function logDatabaseQuery(sql) {
  const safeSql = sql.replace(/'(?:''|[^'])*'/g, '?');
  log({ type: 'db', query: safeSql });
}

function logFactoryRequest({ user, request, response, status, error }) {
  log({
    type: 'factory',
    user: safeUser(user),
    request,
    response,
    status,
    ...(error ? { error: { name: error.name, message: error.message } } : {}),
  });
}

function logException(error, req) {
  log({
    type: 'exception',
    method: req?.method,
    path: req?.originalUrl || req?.url,
    status: error.statusCode || 500,
    exception: { name: error.name, message: error.message },
    user: safeUser(req?.user),
  });
}

module.exports = {
  httpLogger,
  requestContextMiddleware,
  log,
  logDatabaseQuery,
  logFactoryRequest,
  logException,
};
