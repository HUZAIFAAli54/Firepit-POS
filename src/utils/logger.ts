import { db } from '../db/database';
import type { LogCategory, UserRole } from '../types';

export async function logActivity(
  userId: number,
  userName: string,
  role: UserRole,
  category: LogCategory,
  action: string,
  details: string = ''
) {
  await db.activityLogs.add({
    userId,
    userName,
    role,
    action,
    category,
    details,
    timestamp: new Date().toISOString(),
  });
}
