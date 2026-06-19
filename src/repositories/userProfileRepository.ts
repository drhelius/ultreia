import type { UserPreferences, UserProfile } from '../domain';

export type UserProfileRepository = {
  getProfile(): Promise<UserProfile | undefined>;
  saveProfile(profile: UserProfile): Promise<void>;
  getPreferences(userId: string): Promise<UserPreferences | undefined>;
  savePreferences(preferences: UserPreferences): Promise<void>;
  clearUserState(): Promise<void>;
};
