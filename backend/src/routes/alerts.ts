import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, sendCreated, sendNoContent, setCacheHeaders } from '../http/response.js';
import { notFound, ErrorCodes } from '../http/error.js';
import { validateBody, validateQuery } from '../validation/validate.js';
import {
  createAlertRequestSchema,
  updateAlertRequestSchema,
  alertsListQuerySchema,
  alertEventsQuerySchema,
} from '../validation/schemas.js';
import {
  alertCreate,
  alertGetById,
  alertList,
  alertUpdate,
  alertCancelWatch,
  alertDelete,
  type CreateAlertRequest,
} from '../domain/alerts/repo.js';
import { alertEventsQuery } from '../domain/alerts/eventsRepo.js';
import type { Alert, AlertEmitted } from '../domain/alerts/types.js';

/**
 * Alerts Routes
 * Per API_SPEC.md section 2
 */

export interface AlertsListResponse {
  items: Alert[];
}

export interface AlertEventsResponse {
  items: AlertEmitted[];
}

export async function handleAlertsList(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const query = validateQuery(alertsListQuerySchema, req.query);
  
  const alerts = await alertList(query.filter, query.symbolOrAddress);
  
  setCacheHeaders(res, { noStore: true });
  
  const response: AlertsListResponse = {
    items: alerts,
  };
  
  sendJson(res, response);
}

export async function handleAlertCreate(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const body = validateBody(createAlertRequestSchema, req.body);
  
  const alert = await alertCreate(body as CreateAlertRequest);
  
  setCacheHeaders(res, { noStore: true });
  sendCreated(res, alert);
}

export async function handleAlertGetById(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { id } = req.params;
  
  const alert = await alertGetById(id);
  
  if (!alert) {
    throw notFound(`Alert not found: ${id}`, ErrorCodes.ALERT_NOT_FOUND);
  }
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, alert);
}

export async function handleAlertUpdate(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { id } = req.params;
  const updates = validateBody(updateAlertRequestSchema, req.body);
  
  const alert = await alertUpdate(id, updates);
  
  if (!alert) {
    throw notFound(`Alert not found: ${id}`, ErrorCodes.ALERT_NOT_FOUND);
  }
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, alert);
}

export async function handleAlertCancelWatch(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { id } = req.params;
  
  const alert = await alertCancelWatch(id);
  
  if (!alert) {
    throw notFound(`Alert not found: ${id}`, ErrorCodes.ALERT_NOT_FOUND);
  }
  
  setCacheHeaders(res, { noStore: true });
  sendJson(res, alert);
}

export async function handleAlertDelete(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const { id } = req.params;
  
  const deleted = await alertDelete(id);
  
  if (!deleted) {
    throw notFound(`Alert not found: ${id}`, ErrorCodes.ALERT_NOT_FOUND);
  }
  
  sendNoContent(res);
}

export async function handleAlertEvents(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const query = validateQuery(alertEventsQuerySchema, req.query);
  
  const events = await alertEventsQuery(query.since, query.limit);
  
  setCacheHeaders(res, { noStore: true });
  
  const response: AlertEventsResponse = {
    items: events,
  };
  
  sendJson(res, response);
}
