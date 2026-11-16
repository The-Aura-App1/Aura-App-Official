import { saveTheme, loadSavedThemes, renameSavedTheme, deleteSavedTheme, applySavedTheme, loadCustom, saveCustom, cleanName, SAVED_MAX, NAME_MAX } from './customTheme';
import { respond } from '../angel/angel';

beforeEach(() => localStorage.clear());

const spec = { name: 'Angel made this', base: 'dark', background: '#101820', accent: '#22c55e', font: null };

test('themes are saved under any name, used, renamed and deleted', () => {
  const { theme } = saveTheme(spec, '  Midnight   Drive 🌙 ');
  expect(theme.name).toBe('Midnight Drive 🌙');
  expect(theme.accent).toBe('#22c55e');
  expect(loadSavedThemes()).toHaveLength(1);

  applySavedTheme(theme.id);
  expect(loadCustom()).toMatchObject({ name: 'Midnight Drive 🌙', savedId: theme.id, accent: '#22c55e' });

  renameSavedTheme(theme.id, 'Sea glass');
  expect(loadSavedThemes()[0].name).toBe('Sea glass');
  expect(loadCustom().name).toBe('Sea glass');   // the one in use follows

  deleteSavedTheme(theme.id);
  expect(loadSavedThemes()).toHaveLength(0);
});

test('names are cleaned and required, and there is a limit', () => {
  expect(cleanName('a\u0000b​c\nd')).toBe('abc d');
  expect(cleanName('x'.repeat(100))).toHaveLength(NAME_MAX);
  expect(saveTheme(spec, '   ').error).toMatch(/name/);
  for (let i = 0; i < SAVED_MAX; i++) expect(saveTheme(spec, `Theme ${i}`).theme).toBeTruthy();
  expect(saveTheme(spec, 'One too many').error).toMatch(/up to 20/);
});

test('Angel saves the custom theme in use under the name you give', async () => {
  saveCustom(spec);
  const reply = await respond('save it as Forest Rave', { customTheme: loadCustom() });
  expect(reply.autoAction).toEqual({ id: 'save-theme', payload: { name: 'Forest Rave' } });
  const named = await respond('call this theme "Lo-fi Library"', { customTheme: loadCustom() });
  expect(named.autoAction.payload.name).toBe('Lo-fi Library');
  const none = await respond('save it as Nothing', {});
  expect(none.autoAction).toBeUndefined();
  expect(none.text).toMatch(/no custom theme/);
});
