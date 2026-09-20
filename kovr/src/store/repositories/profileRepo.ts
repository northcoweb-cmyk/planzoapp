/** The demo account. KOVR ships with one simulated profile and no sign-up. */

import type { Database } from '../db.js';
import { bool, str } from '../rows.js';
import type { Row } from '../db.js';

export interface Profile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarInitials: string;
  isDemo: boolean;
  createdAt: string;
}

export class ProfileRepository {
  constructor(private readonly database: Database) {}

  private static toProfile(row: Row): Profile {
    return {
      id: str(row, 'id'),
      username: str(row, 'username'),
      email: str(row, 'email'),
      displayName: str(row, 'display_name'),
      avatarInitials: str(row, 'avatar_initials'),
      isDemo: bool(row, 'is_demo'),
      createdAt: str(row, 'created_at'),
    };
  }

  create(profile: Omit<Profile, 'createdAt'>, at: string): Profile {
    this.database.run(
      `INSERT INTO profiles (id, username, email, display_name, avatar_initials, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      profile.id,
      profile.username,
      profile.email,
      profile.displayName,
      profile.avatarInitials,
      profile.isDemo ? 1 : 0,
      at,
      at,
    );
    const created = this.findById(profile.id);
    if (!created) throw new Error('profile creation failed');
    return created;
  }

  findById(id: string): Profile | null {
    const row = this.database.get('SELECT * FROM profiles WHERE id = ?', id);
    return row ? ProfileRepository.toProfile(row) : null;
  }

  update(id: string, changes: Partial<Pick<Profile, 'displayName' | 'username' | 'email'>>, at: string): void {
    const sets: string[] = [];
    const params: string[] = [];
    if (changes.displayName !== undefined) {
      sets.push('display_name = ?');
      params.push(changes.displayName);
    }
    if (changes.username !== undefined) {
      sets.push('username = ?');
      params.push(changes.username);
    }
    if (changes.email !== undefined) {
      sets.push('email = ?');
      params.push(changes.email);
    }
    if (sets.length === 0) return;
    this.database.run(`UPDATE profiles SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...params, at, id);
  }
}
