import { Client } from '@elastic/elasticsearch';
import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { config } from '../config';

export const esClient = new Client({
  node: config.elasticsearchUrl,
});

const INDEX_NAME = 'emails';

export async function ensureIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: INDEX_NAME });
  if (!exists) {
    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
        mappings: {
          properties: {
            emailId: { type: 'keyword' },
            recipient: { type: 'keyword' },
            sender: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            userId: { type: 'keyword' },
          },
        },
      },
    });
    console.log('[ES] Created index:', INDEX_NAME);
  }
}

export async function indexEmail(doc: {
  emailId: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  userId: string;
}): Promise<void> {
  await esClient.index({
    index: INDEX_NAME,
    id: doc.emailId,
    body: doc,
    refresh: true,
  });
}

export async function updateEmailStatus(
  emailId: string,
  status: string,
  sentAt?: string | null
): Promise<void> {
  try {
    const updateBody: Record<string, unknown> = { status };
    if (sentAt) {
      updateBody.sentAt = sentAt;
    }
    await esClient.update({
      index: INDEX_NAME,
      id: emailId,
      body: {
        doc: updateBody,
      },
      refresh: true,
    });
  } catch (err) {
    console.error('[ES] Failed to update email status:', err);
  }
}

export async function searchEmails(
  query: string,
  status?: string,
  userId?: string
): Promise<unknown[]> {
  const must: QueryDslQueryContainer[] = [];

  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['subject', 'body', 'recipient', 'sender'],
      },
    });
  }

  if (status) {
    must.push({ term: { status } });
  }

  if (userId) {
    must.push({ term: { userId } });
  }

  const boolQuery: QueryDslQueryContainer = must.length > 0
    ? { bool: { must } }
    : { match_all: {} };

  const result = await esClient.search({
    index: INDEX_NAME,
    body: {
      query: boolQuery,
      sort: [{ scheduledAt: { order: 'desc' as const } }],
      size: 100,
    },
  });

  return (result.hits.hits as Array<{ _source: unknown }>).map((hit) => hit._source);
}
