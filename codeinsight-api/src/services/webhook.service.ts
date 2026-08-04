import { Webhook } from 'svix';
import { syncUser } from './user.service.js';

export interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

export interface ClerkUserCreatedData {
  id: string;
  primary_email_address_id?: string;
  email_addresses?: ClerkEmailAddress[];
  created_at?: number;
}

export interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserCreatedData;
}

export function verifyClerkWebhook(
  payload: string,
  headers: Record<string, string | string[] | undefined>
): ClerkWebhookEvent {
  const webhookSecret = process.env['CLERK_WEBHOOK_SECRET'];

  if (!webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET environment variable is missing.');
  }

  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing required Svix verification headers');
  }

  const svixHeaders = {
    'svix-id': Array.isArray(svixId) ? svixId[0]! : svixId,
    'svix-timestamp': Array.isArray(svixTimestamp) ? svixTimestamp[0]! : svixTimestamp,
    'svix-signature': Array.isArray(svixSignature) ? svixSignature[0]! : svixSignature,
  };

  const wh = new Webhook(webhookSecret);
  return wh.verify(payload, svixHeaders) as ClerkWebhookEvent;
}

export async function processClerkWebhook(
  event: ClerkWebhookEvent
): Promise<{ status: string; action: string }> {
  if (event.type !== 'user.created') {
    return { status: 'ignored', action: event.type };
  }

  const data = event.data;
  const clerkId = data.id;

  if (!clerkId) {
    throw new Error('Webhook event data is missing user ID');
  }

  let email: string | undefined;
  if (data.email_addresses && data.email_addresses.length > 0) {
    const primary = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id
    );
    email = primary ? primary.email_address : data.email_addresses[0]?.email_address;
  }

  const createdAt = data.created_at ? new Date(data.created_at) : new Date();

  await syncUser({
    clerkId,
    email,
    createdAt,
  });

  return { status: 'success', action: 'user.created' };
}
