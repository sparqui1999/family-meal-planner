'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Seed = require('../src/data/seed');
const Schema = require('../src/data/schema');
const Scoring = require('../src/logic/scoring');
const Units = require('../src/logic/units');

const T = Seed.tables;
const keysOf = (tab) => new Set((T[tab] || []).map((r) => String(r[Schema.keyColumn(tab)]).toLowerCase()));

describe('Seed matches the schema', () => {
  it('only seeds tabs that exist, using only real columns', () => {
    Object.keys(T).forEach((tab) => {
      const def = Schema.tab(tab);
      assert.ok(def, tab + ' is not in the schema');
      const names = def.columns.map((c) => c.name);
      T[tab].forEach((row) => Object.keys(row).forEach((k) => assert.ok(names.includes(k), tab + ' has unknown column ' + k)));
    });
  });
  it('uses valid enum values and names that exist in the seeded lookup tabs', () => {
    Object.keys(T).forEach((tab) => {
      Schema.tab(tab).columns.forEach((c) => {
        T[tab].forEach((row) => {
          const v = row[c.name];
          if (v === undefined || v === '' || v === null) return;
          if (c.enum) assert.ok(c.enum.map(String).includes(String(v)), tab + '.' + c.name + ' = ' + v);
          if (c.ref && T[c.ref]) assert.ok(keysOf(c.ref).has(String(v).toLowerCase()), tab + '.' + c.name + ' = ' + v + ' is not in ' + c.ref);
        });
      });
    });
  });
  it('has unique names in every seeded tab that has a name column', () => {
    Object.keys(T).forEach((tab) => {
      const key = Schema.keyColumn(tab);
      if (!key) return;
      const names = T[tab].map((r) => String(r[key]).toLowerCase());
      assert.equal(new Set(names).size, names.length, tab + ' has duplicate names');
    });
  });
});

describe('Seed ingredients', () => {
  it('has at least 120 ingredients, each with an aisle and a health tag', () => {
    assert.ok(T.lib_ingredients.length >= 120);
    T.lib_ingredients.forEach((i) => { assert.ok(i.aisle, i.name); assert.ok(i.health_tag, i.name); });
  });
  it('marks the plan\'s staples', () => {
    const staples = new Set(T.lib_ingredients.filter((i) => i.is_staple).map((i) => i.name));
    ['salt', 'black pepper', 'cooking oil', 'olive oil', 'flour', 'sugar', 'butter', 'paprika', 'cumin'].forEach((s) => assert.ok(staples.has(s), s));
    assert.ok(!staples.has('chicken breast'));
  });
  it('covers common categories', () => {
    const names = new Set(T.lib_ingredients.map((i) => i.name));
    ['chicken breast', 'ground beef', 'eggs', 'milk', 'rice', 'spaghetti', 'onion', 'garlic', 'tomato', 'broccoli', 'salmon'].forEach((n) => assert.ok(names.has(n), n));
  });
});

describe('Seed store aisles', () => {
  it('lists Vons-style aisles in order, Produce first and Other last', () => {
    const a = T.cfg_aisles;
    assert.equal(a[0].name, 'Produce'); assert.equal(a[a.length - 1].name, 'Other');
    assert.deepEqual(a.map((x) => x.sort_order), a.map((_, i) => i + 1));
    assert.ok(a.every((x) => x.store === 'Vons'));
  });
});

describe('Seed units', () => {
  it('has valid families and positive conversion factors', () => {
    T.cfg_units.forEach((u) => { assert.ok(['volume', 'weight', 'count'].includes(u.family)); assert.ok(u.to_base > 0, u.unit); });
  });
  it('has no alias that belongs to two units', () => {
    const seen = {};
    T.cfg_units.forEach((u) => [u.unit].concat(u.aliases.split(',')).map((x) => x.trim().toLowerCase()).filter(Boolean).forEach((name) => {
      assert.ok(!seen[name] || seen[name] === u.unit, name + ' used by ' + seen[name] + ' and ' + u.unit);
      seen[name] = u.unit;
    }));
  });
  it('converts the everyday units correctly', () => {
    assert.equal(Units.convert(3, 'tsp', 'tbsp', T.cfg_units), 1);
    assert.equal(Units.convert(1, 'quart', 'cup', T.cfg_units), 4);
    assert.equal(Units.convert(1, 'gallon', 'quart', T.cfg_units), 4);
    assert.ok(Math.abs(Units.convert(1, 'kg', 'lb', T.cfg_units) - 2.2046) < 0.001);
    assert.ok(Math.abs(Units.convert(1000, 'ml', 'l', T.cfg_units) - 1) < 0.001);
  });
});

describe('Seed health rules', () => {
  it('covers every ingredient health tag and every cooking method', () => {
    const tags = T.cfg_health_rules.filter((r) => r.kind === 'ingredient').map((r) => r.key).sort();
    assert.deepEqual(tags, Schema.HEALTH_TAGS.slice().sort());
    const methods = T.cfg_health_rules.filter((r) => r.kind === 'method').map((r) => r.key);
    Schema.tab('lib_dishes').columns.find((c) => c.name === 'cook_method').enum.forEach((m) => assert.ok(methods.includes(m), m));
  });
  it('rewards vegetables and penalizes fried food', () => {
    const pts = (k) => T.cfg_health_rules.find((r) => r.key === k).points;
    assert.ok(pts('leafy_veg') > pts('vegetable') && pts('vegetable') > 0);
    assert.ok(pts('fried') < 0 && pts('processed_meat') < pts('red_meat'));
  });
});

describe('Seed settings', () => {
  const s = Scoring.parseSettings(T.cfg_settings);
  it('has every setting in the plan with the agreed defaults', () => {
    const expected = { plan_days: 7, week_view_days: 8, default_servings: 4, repeat_days: 21, max_ideas_per_week: 1, w_rating: 1, w_favorite: 0.5,
      w_recency: 1, w_health: 0.3, w_season: 0.5, recency_cap_days: 90, weeknight_max_minutes: 45, weekend_max_minutes: 120, weekend_days: '0,6',
      cook_time_mode: 'soft', w_time_penalty: 0.75, restaurant_suggest_count: 5, restaurant_repeat_days: 14, first_day_of_week: 0,
      shopping_week_start_day: 0, season_winter: '12,1,2', season_spring: '3,4,5', season_summer: '6,7,8', season_fall: '9,10,11', health_base: 5,
      health_scale: 1.5, active_profile: 'Normal', timezone: 'America/Los_Angeles', store_name: 'Vons', refresh_minutes: 5 };
    Object.keys(expected).forEach((k) => assert.equal(s[k], expected[k], k));
    assert.equal(T.cfg_settings.length, Object.keys(expected).length);
  });
  it('points the active profile at an existing profile', () => {
    assert.ok(keysOf('cfg_profiles').has(s.active_profile.toLowerCase()));
  });
});

describe('Seed variety rules and budget profiles', () => {
  it('has two profiles and a rule set for each', () => {
    assert.deepEqual(T.cfg_profiles.map((p) => p.name), ['Normal', 'Tight budget']);
    assert.ok(T.cfg_variety_rules.some((r) => r.profile === 'Tight budget'));
    assert.ok(T.cfg_variety_rules.some((r) => r.profile === ''));
  });
  it('makes beef less likely and chicken more likely when the budget is tight', () => {
    const w = (profile, type) => T.cfg_type_weights.find((r) => r.profile === profile && r.type === type).multiplier;
    assert.equal(w('Normal', 'Beef'), 1);
    assert.equal(w('Tight budget', 'Beef'), 0.4);
    assert.equal(w('Tight budget', 'Chicken'), 1.5);
  });
  it('has a weight for every dish type in every profile', () => {
    T.cfg_profiles.forEach((p) => T.lib_dish_types.forEach((t) => {
      assert.ok(T.cfg_type_weights.some((w) => w.profile === p.name && w.type === t.name), p.name + '/' + t.name);
    }));
  });
});
