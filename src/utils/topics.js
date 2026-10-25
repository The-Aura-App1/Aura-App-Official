// Keep in sync with TOPICS in backend/lambdas/aura-posts/index.mjs
export const TOPICS = [
  { id: 'photography',    label: 'Photography' },
  { id: 'art',            label: 'Art' },
  { id: 'music',          label: 'Music' },
  { id: 'film',           label: 'Film' },
  { id: 'design',         label: 'Design' },
  { id: 'writing',        label: 'Writing' },
  { id: 'gaming',         label: 'Gaming' },
  { id: 'comedy',         label: 'Comedy' },
  { id: 'sports',         label: 'Sports' },
  { id: 'fitness',        label: 'Fitness' },
  { id: 'cooking',        label: 'Cooking' },
  { id: 'food',           label: 'Food' },
  { id: 'travel',         label: 'Travel' },
  { id: 'fashion',        label: 'Fashion' },
  { id: 'beauty',         label: 'Beauty' },
  { id: 'tech',           label: 'Tech' },
  { id: 'science',        label: 'Science' },
  { id: 'finance',        label: 'Finance' },
  { id: 'coding',         label: 'Coding' },
  { id: 'books',          label: 'Books' },
  { id: 'education',      label: 'Education' },
  { id: 'business',       label: 'Business' },
  { id: 'pets',           label: 'Pets' },
  { id: 'motivation',     label: 'Motivation' },
  { id: 'sustainability', label: 'Sustainability' },
  { id: 'outdoors',       label: 'Outdoors' },
  { id: 'cars',           label: 'Cars' },
  { id: 'diy',            label: 'DIY' },
];

export const TOPIC_IDS       = new Set(TOPICS.map(t => t.id));
export const MAX_POST_TOPICS = 3;

export function topicLabel(id) {
  return TOPICS.find(t => t.id === id)?.label ?? id;
}
