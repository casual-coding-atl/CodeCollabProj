import { describe, it, expect } from 'vitest';
import { describeNotification, commentRecipients, type NotificationView } from './notifications';

const base: NotificationView = {
  _id: 'n1',
  type: 'join_requested',
  actor: { _id: 'u-sofia', username: 'sofia' },
  projectId: { _id: 'p-weather', title: 'Weather App' },
  readAt: null,
  createdAt: '2026-07-12T00:00:00.000Z',
};

describe('describeNotification', () => {
  it('join_requested names the actor and project, links to the project', () => {
    expect(describeNotification({ ...base, type: 'join_requested' })).toEqual({
      text: 'sofia requested to join Weather App',
      href: '/projects/p-weather',
    });
  });

  it('join_accepted / join_rejected speak from the requester’s perspective', () => {
    expect(describeNotification({ ...base, type: 'join_accepted' }).text).toBe(
      'Your request to join Weather App was accepted'
    );
    expect(describeNotification({ ...base, type: 'join_rejected' }).text).toBe(
      'Your request to join Weather App was declined'
    );
  });

  it('collaborator_added reads as the actor joining', () => {
    expect(describeNotification({ ...base, type: 'collaborator_added' }).text).toBe(
      'sofia joined Weather App'
    );
  });

  it('collaborator_removed speaks to the removed member', () => {
    expect(describeNotification({ ...base, type: 'collaborator_removed' }).text).toBe(
      'You were removed from Weather App'
    );
  });

  it('comment_posted names the commenter and deep-links to the comment when present', () => {
    expect(describeNotification({ ...base, type: 'comment_posted', commentId: 'c9' })).toEqual({
      text: 'sofia commented on Weather App',
      href: '/projects/p-weather#c9',
    });
    // no commentId → links to the project
    expect(describeNotification({ ...base, type: 'comment_posted' }).href).toBe('/projects/p-weather');
  });

  it('degrades gracefully when actor or project is missing (deleted/unpopulated)', () => {
    const orphan = { ...base, type: 'comment_posted' as const, actor: null, projectId: null };
    const { text, href } = describeNotification(orphan);
    expect(text).toBe('Someone commented on a project');
    expect(href).toBe('/notifications');
  });
});

describe('commentRecipients', () => {
  const project = {
    owner: { _id: 'owner1' },
    collaborators: [
      { userId: { _id: 'collab-accepted' }, status: 'accepted' },
      { userId: { _id: 'collab-pending' }, status: 'pending' },
      { userId: { _id: 'collab-rejected' }, status: 'rejected' },
    ],
  };

  it('returns the owner plus accepted collaborators, excluding pending/rejected', () => {
    expect(commentRecipients(project, 'someone-else').sort()).toEqual(
      ['collab-accepted', 'owner1'].sort()
    );
  });

  it('excludes the comment author (no self-notification)', () => {
    expect(commentRecipients(project, 'owner1')).toEqual(['collab-accepted']);
    expect(commentRecipients(project, 'collab-accepted')).toEqual(['owner1']);
  });

  it('accepts raw string ids as well as populated refs', () => {
    const raw = { owner: 'owner1', collaborators: [{ userId: 'c1', status: 'accepted' }] };
    expect(commentRecipients(raw, 'x').sort()).toEqual(['c1', 'owner1'].sort());
  });

  it('dedupes if the owner is also listed as a collaborator', () => {
    const dup = {
      owner: 'owner1',
      collaborators: [{ userId: 'owner1', status: 'accepted' }],
    };
    expect(commentRecipients(dup, 'x')).toEqual(['owner1']);
  });
});
