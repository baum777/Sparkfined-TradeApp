import { getEnv } from '../../env';
import { internalError, unauthorized } from '../../errors';
import { fetchJsonWithTimeout } from '../journal/onchain/http';

const BASE_URL = 'https://api.helius.xyz/v0';

export interface HeliusWebhookConfig {
  webhookID: string;
  accountAddresses: string[];
  webhookURL: string;
  transactionTypes: string[];
  authHeader: string;
  webhookType: string; // "enhanced"
}

export async function getWebhookConfig(): Promise<HeliusWebhookConfig> {
  const env = getEnv();
  if (!env.HELIUS_API_KEY || !env.HELIUS_WEBHOOK_ID) {
    throw internalError('Missing Helius API Key or Webhook ID');
  }

  const url = `${BASE_URL}/webhooks/${env.HELIUS_WEBHOOK_ID}?api-key=${env.HELIUS_API_KEY}`;
  
  return fetchJsonWithTimeout<HeliusWebhookConfig>(url, {
    timeoutMs: 5000,
    headers: {}
  });
}

export async function updateWebhookAddresses(addresses: string[]): Promise<HeliusWebhookConfig> {
  const env = getEnv();
  if (!env.HELIUS_API_KEY || !env.HELIUS_WEBHOOK_ID) {
    throw internalError('Missing Helius API Key or Webhook ID');
  }

  const url = `${BASE_URL}/webhooks/${env.HELIUS_WEBHOOK_ID}?api-key=${env.HELIUS_API_KEY}`;
  
  // Helius expects PUT with full config usually, or PATCH? 
  // Docs say PUT to update. We only need to update accountAddresses.
  // We should ideally GET first to preserve other fields, OR assuming we own the webhook, we just send what we want.
  // But PATCH is safer if supported. Helius docs usually imply PUT /v0/webhooks/{id} updates the webhook.
  // Let's rely on the Manager to GET then PUT. This client just does the raw PUT.
  
  const payload = {
    accountAddresses: addresses,
    // We might need to send other fields if PUT replaces everything. 
    // It's safer if the caller (Manager) provides the full merged config object, 
    // OR we just send { accountAddresses } if Helius supports partial update via PATCH.
    // Helius API typically uses PUT for full update.
    // Let's change signature to take Partial<HeliusWebhookConfig> and use PUT.
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
     if (response.status === 401) throw unauthorized('Helius API Unauthorized');
     throw internalError(`Helius Webhook Update Failed: ${response.status}`);
  }

  return response.json();
}

// Updated signature to support full replacement (safer)
export async function putWebhookConfig(config: HeliusWebhookConfig): Promise<HeliusWebhookConfig> {
  const env = getEnv();
  const url = `${BASE_URL}/webhooks/${env.HELIUS_WEBHOOK_ID}?api-key=${env.HELIUS_API_KEY}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
     throw internalError(`Helius Webhook Update Failed: ${response.status} ${await response.text()}`);
  }
  
  return response.json();
}

