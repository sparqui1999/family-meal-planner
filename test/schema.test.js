'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Schema = require('../src/data/schema');

const PLAN_TABS = [
  'cfg_members', 'cfg_profiles', 'cfg_aisles', 'cfg_health_rules', 'cfg_settings', 'cfg_units', 'cfg_variety_rules', 'cfg_type_weights',
  'lib_dishes', 'lib_dish_types', 'lib_cuisines', 'lib_tags', 'lib_dish_seasons', 'lib_dish_tags', 'lib_dish_sides', 'lib_ingredients',
  'lib_recipe_ingredients', 'lib_recipe_steps', 'lib_restaurants',
  'act_meal_plan', 'act_queue', 'act_dish_ratings', 'act_restaurant_ratings', 'act_dish_comments', 'act_restaurant_comments',
  'act_restaurant_visits', 'act_shopping_items', 'act_running_low', 'act_plan_drafts', 'sys_lists'
];
const SYS_LIST_KEYS = ['all_dishes', 'main_dishes', 'side_dishes', 'active_restaurants', 'ingredient_names', 'match_values'];
const cols = (tab) => Schema.tab(tab).columns.map((c) => c.name);

describe('Schema tabs', () => {
  it('has exactly the tabs in the plan, in a sensible order (config, library, activity, system)', () => {
    assert.deepEqual(Schema.tabs.map((t) => t.tab).sort(), PLAN_TABS.slice().sort());
    const groups = Schema.tabs.map((t) => t.group);
    assert.deepEqual(groups, groups.slice().sort((a, b) => ['config', 'library', 'activity', 'system'].indexOf(a) - ['config', 'library', 'activity', 'system'].indexOf(b)));
  });
  it('prefixes every tab to match its group and colors it', () => {
    const prefix = { config: 'cfg_', library: 'lib_', activity: 'act_', system: 'sys_' };
    Schema.tabs.forEach((t) => {
      assert.ok(t.tab.startsWith(prefix[t.group]), t.tab);
      assert.equal(t.color, Schema.COLORS[t.group]);
      assert.ok(t.desc && t.desc.length > 5, t.tab + ' needs a description for the README');
    });
  });
  it('has at least one column in every data tab and unique column names', () => {
    Schema.tabs.filter((t) => t.group !== 'system').forEach((t) => {
      assert.ok(t.columns.length > 0, t.tab);
      assert.equal(new Set(cols(t.tab)).size, t.columns.length, t.tab + ' has duplicate columns');
    });
  });
  it('uses only known column types', () => {
    Schema.tabs.forEach((t) => t.columns.forEach((c) => assert.ok(['string', 'number', 'boolean', 'date', 'json'].includes(c.type), t.tab + '.' + c.name)));
  });
});

describe('Schema references', () => {
  it('points every ref at a tab that exists and has a name column', () => {
    Schema.tabs.forEach((t) => t.columns.forEach((c) => {
      if (!c.ref) return;
      assert.ok(Schema.tab(c.ref), t.tab + '.' + c.name + ' refers to missing tab ' + c.ref);
      assert.ok(Schema.keyColumn(c.ref), c.ref + ' has no key column');
    }));
  });
  it('uses only known dropdown lists', () => {
    Schema.tabs.forEach((t) => t.columns.forEach((c) => { if (c.list) assert.ok(SYS_LIST_KEYS.includes(c.list), t.tab + '.' + c.name + ': ' + c.list); }));
  });
  it('has non-empty enums', () => {
    Schema.tabs.forEach((t) => t.columns.forEach((c) => { if (c.enum) assert.ok(Array.isArray(c.enum) && c.enum.length > 0, t.tab + '.' + c.name); }));
  });
  it('never gives a column both a ref and an enum', () => {
    Schema.tabs.forEach((t) => t.columns.forEach((c) => assert.ok(!(c.ref && c.enum), t.tab + '.' + c.name)));
  });
  it('has at most one key column per tab, and it is the first column', () => {
    Schema.tabs.forEach((t) => {
      const keys = t.columns.filter((c) => c.key);
      assert.ok(keys.length <= 1, t.tab);
      if (keys.length) assert.equal(t.columns[0].name, keys[0].name, t.tab + ' key must be column A');
    });
  });
  it('keeps internal ids last in their tab, and only on the three tabs that need them', () => {
    const withInternal = [];
    Schema.tabs.forEach((t) => {
      const idx = t.columns.map((c, i) => (c.internal ? i : -1)).filter((i) => i >= 0);
      if (idx.length) {
        withInternal.push(t.tab);
        assert.deepEqual(idx, [t.columns.length - 1], t.tab);
      }
    });
    assert.deepEqual(withInternal.sort(), ['act_meal_plan', 'act_queue', 'act_shopping_items']);
  });
  it('never offers an internal id as a dropdown', () => {
    Schema.tabs.forEach((t) => t.columns.forEach((c) => { if (c.internal) assert.ok(!c.ref && !c.list && !c.enum, t.tab + '.' + c.name); }));
  });
});

describe('Schema columns required by the plan', () => {
  it('has the dish columns', () => {
    assert.deepEqual(cols('lib_dishes'), ['name', 'role', 'type', 'cuisine', 'cook_method', 'servings', 'prep_min', 'cook_min', 'source',
      'intro_notes', 'healthy_score', 'favorite', 'status', 'added_by', 'added_on']);
  });
  it('has the meal plan columns with up to three sides', () => {
    assert.deepEqual(cols('act_meal_plan'), ['date', 'kind', 'dish', 'side_1', 'side_2', 'side_3', 'restaurant', 'servings', 'status', 'locked',
      'notes', 'added_by', 'added_on', 'plan_id']);
  });
  it('has full recipe columns: amounts, units, groups, steps, timers', () => {
    assert.deepEqual(cols('lib_recipe_ingredients'), ['dish', 'line_no', 'ingredient', 'group_label', 'qty_text', 'qty', 'unit', 'prep_note', 'optional']);
    assert.deepEqual(cols('lib_recipe_steps'), ['dish', 'step_no', 'section_label', 'text', 'timer_min']);
  });
  it('has the restaurant history, ratings and comments', () => {
    assert.ok(cols('lib_restaurants').includes('favorite'));
    assert.deepEqual(cols('act_restaurant_visits'), ['restaurant', 'date']);
    assert.deepEqual(cols('act_restaurant_ratings'), ['restaurant', 'member', 'stars', 'date']);
    assert.deepEqual(cols('act_restaurant_comments'), ['restaurant', 'member', 'text', 'date']);
  });
  it('has the per-person draft table and the shopping columns', () => {
    assert.deepEqual(cols('act_plan_drafts'), ['member', 'week_start', 'draft_json', 'updated_on']);
    assert.deepEqual(cols('act_shopping_items'), ['week_start', 'ingredient', 'name', 'qty', 'unit', 'aisle', 'have_it', 'in_cart', 'source_dishes', 'flags', 'is_manual', 'item_id']);
  });
  it('shows names, not ids, in every dropdown-bearing column of the plan', () => {
    ['dish', 'side_1', 'side_2', 'side_3', 'restaurant', 'added_by'].forEach((n) => assert.ok(Schema.tab('act_meal_plan').columns.find((c) => c.name === n).ref, n));
    assert.equal(cols('lib_dishes').some((c) => /_id$/.test(c)), false);
  });
  it('marks the automatic healthy score as protected', () => {
    assert.equal(Schema.tab('lib_dishes').columns.find((c) => c.name === 'healthy_score').protect, true);
  });
});

describe('Schema helpers', () => {
  it('letter converts column positions to sheet letters', () => {
    assert.equal(Schema.letter(0), 'A'); assert.equal(Schema.letter(25), 'Z'); assert.equal(Schema.letter(26), 'AA'); assert.equal(Schema.letter(701), 'ZZ');
  });
  it('finds key columns and column positions', () => {
    assert.equal(Schema.keyColumn('lib_dishes'), 'name');
    assert.equal(Schema.keyColumn('act_meal_plan'), null);
    assert.equal(Schema.keyColumn('nope'), null);
    assert.equal(Schema.columnIndex('act_meal_plan', 'plan_id'), 13);
    assert.equal(Schema.columnIndex('act_meal_plan', 'nope'), -1);
    assert.equal(Schema.tab('nope'), null);
  });
});
