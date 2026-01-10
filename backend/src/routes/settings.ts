import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { AppError, ErrorCodes } from '../http/error.js';
import { validateBody } from '../validation/validate.js';
import { settingsPatchSchema } from '../validation/schemas.js';
import { getSettings, patchSettings } from '../domain/settings/settings.service.js';
import { resolveTierFromAuthUser } from '../domain/settings/tier.js';

export async function handleSettingsGet(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (req.userId === 'anon') {
    throw new AppError('Unauthenticated', 401, ErrorCodes.UNAUTHENTICATED);
  }

  const settings = await getSettings(req.userId);
  setCacheHeaders(res, { noStore: true });
  sendJson(res, settings);
}

export async function handleSettingsPatch(req: ParsedRequest, res: ServerResponse): Promise<void> {
  if (req.userId === 'anon') {
    throw new AppError('Unauthenticated', 401, ErrorCodes.UNAUTHENTICATED);
  }

  const body = validateBody(settingsPatchSchema, req.body);
  const tier = resolveTierFromAuthUser(req.user);
  const settings = await patchSettings(req.userId, body, { tier });

  setCacheHeaders(res, { noStore: true });
  sendJson(res, settings);
}

