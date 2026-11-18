import Dexie from 'dexie';

export const database = new Dexie('carbon-chat');

database.version(1).stores({
  conversations: 'id, updatedAt, title',
});

export async function listConversations() {
  return database.conversations.orderBy('updatedAt').reverse().toArray();
}

export async function saveConversation(conversation) {
  await database.conversations.put({
    ...conversation,
    updatedAt: Date.now(),
  });
}

export async function removeConversation(id) {
  await database.conversations.delete(id);
}

export async function clearConversations() {
  await database.conversations.clear();
}
