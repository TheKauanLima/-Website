import { sendJson } from '../lib/http.js';

/** GET|HEAD /api/health */
export function createHealthHandler({ now = Date.now } = {}) {
  return function health(req, res) {
    sendJson(
      req,
      res,
      200,
      { status: 'ok', uptime: process.uptime(), time: new Date(now()).toISOString() },
      { 'Cache-Control': 'no-store' },
    );
  };
}
