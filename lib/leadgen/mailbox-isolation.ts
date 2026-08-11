import "server-only";

export function assertClientMailboxIsolation(mailboxUser: string) {
  const instanceId = process.env.LEADGEN_CLIENT_INSTANCE_ID?.trim();
  const expectedMailbox = process.env.LEADGEN_CLIENT_MAILBOX?.trim().toLowerCase();
  if (!instanceId) {
    throw new Error("Почта заблокирована: LEADGEN_CLIENT_INSTANCE_ID не задан.");
  }
  if (!expectedMailbox || expectedMailbox !== mailboxUser.trim().toLowerCase()) {
    throw new Error("Почта заблокирована: mailbox не подтверждён для этой клиентской копии.");
  }
}
