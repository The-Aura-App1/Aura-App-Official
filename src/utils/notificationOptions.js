// The notifications people can turn on and off (Settings, and Angel). Keys
// match NOTIFICATION_TYPES in aura-users.
export const NOTIFICATION_OPTIONS = [
  { key: 'auraGiven',            label: 'Aura given to your posts'   },
  { key: 'auraTaken',            label: 'Aura taken from your posts' },
  { key: 'comment',              label: 'Comments'                   },
  { key: 'reply',                label: 'Replies'                    },
  { key: 'mention',              label: 'Tags in comments'           },
  { key: 'games',                label: 'Game challenges'            },
  { key: 'followRequest',        label: 'New followers and requests' },
  { key: 'followAccepted',       label: 'Follow request accepted'    },
  { key: 'groupInvite',          label: 'Group invites'              },
  { key: 'groupRequestApproved', label: 'Group request approved'     },
  { key: 'dailyBonus',           label: 'Daily bonus available'      },
];

export function defaultNotificationPrefs(saved) {
  return Object.fromEntries(NOTIFICATION_OPTIONS.map(({ key }) => [key, saved?.[key] !== false]));
}
