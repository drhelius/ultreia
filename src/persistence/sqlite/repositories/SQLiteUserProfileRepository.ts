import type { UserPreferences, UserProfile } from '../../../domain';
import type { UserProfileRepository } from '../../../repositories';
import type { LocalDatabase } from '../../localDatabase';
import { fromJson, fromSqlBoolean, toJson, toSqlBoolean } from '../sqliteSerialization';

type UserProfileRow = { payload_json: string };
type UserPreferencesRow = { payload_json: string };

export class SQLiteUserProfileRepository implements UserProfileRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getProfile(): Promise<UserProfile | undefined> {
    const row = await this.database.getFirst<UserProfileRow>('SELECT payload_json FROM user_profile ORDER BY updated_at_iso DESC LIMIT 1;');

    return row ? normalizeUserProfile(fromJson<UserProfile>(row.payload_json)) : undefined;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO user_profile (id, display_name, locale, pilgrim_class, travel_mode, budget_mode, created_at_iso, updated_at_iso, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [profile.id, profile.displayName, profile.locale, profile.pilgrimClass, profile.travelMode, profile.budgetMode, profile.createdAtIso, profile.updatedAtIso, toJson(profile)],
    );
  }

  async getPreferences(userId: string): Promise<UserPreferences | undefined> {
    const row = await this.database.getFirst<UserPreferencesRow>('SELECT payload_json FROM user_preferences WHERE user_id = ?;', [userId]);

    return row ? fromJson<UserPreferences>(row.payload_json) : undefined;
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    await this.database.run(
      `INSERT OR REPLACE INTO user_preferences (user_id, notification_tolerance, allow_location_tracking, allow_community_features, payload_json)
       VALUES (?, ?, ?, ?, ?);`,
      [
        preferences.userId,
        preferences.notificationTolerance,
        toSqlBoolean(preferences.allowLocationTracking),
        toSqlBoolean(preferences.allowCommunityFeatures),
        toJson(preferences),
      ],
    );
  }

  async clearUserState(): Promise<void> {
    await this.database.execute('DELETE FROM user_profile;');
  }
}

const normalizeUserProfile = (profile: UserProfile): UserProfile => ({
  ...profile,
  pilgrimClasses: profile.pilgrimClasses?.length ? profile.pilgrimClasses : [profile.pilgrimClass],
});

export const rowToUserPreferences = (row: { user_id: string; notification_tolerance: string; allow_location_tracking: number; allow_community_features: number }): UserPreferences => ({
  userId: row.user_id,
  notificationTolerance: row.notification_tolerance as UserPreferences['notificationTolerance'],
  allowLocationTracking: fromSqlBoolean(row.allow_location_tracking),
  allowCommunityFeatures: fromSqlBoolean(row.allow_community_features),
});
