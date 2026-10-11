// Shared sample data for tests. Build on these instead of re-typing rows in every test file.
'use strict';

const Seed = require('../../src/data/seed');
const Scoring = require('../../src/logic/scoring');

const units = Seed.tables.cfg_units;
const healthRules = Seed.tables.cfg_health_rules;
const settings = Scoring.parseSettings(Seed.tables.cfg_settings);
const varietyRules = Seed.tables.cfg_variety_rules;

// A dish as the suggestion engine sees it.
function dish(name, type, extra) {
  return Object.assign({
    name, role: 'main', type, cuisine: '', tags: [], seasons: [], status: 'active', favorite: false,
    health_score: 5, prep_min: 10, cook_min: 20, servings: 4
  }, extra || {});
}

function side(name, extra) {
  return dish(name, '', Object.assign({ role: 'side', prep_min: 5, cook_min: 5 }, extra || {}));
}

// A planned slot.
function slot(date, dishName, extra) {
  return Object.assign({
    plan_id: '', date, kind: 'home', dish: dishName, side_1: '', side_2: '', side_3: '', restaurant: '',
    servings: 4, status: 'planned', locked: false, notes: ''
  }, extra || {});
}

function restaurantSlot(date, name, extra) {
  return slot(date, '', Object.assign({ kind: 'restaurant', restaurant: name, locked: true }, extra || {}));
}

const library = [
  dish('Chicken Alfredo', 'Chicken'), dish('Beef Stew', 'Beef'), dish('Spaghetti', 'Pasta'), dish('Grilled Salmon', 'Seafood'),
  dish('Veggie Stir Fry', 'Vegetarian'), dish('Pork Chops', 'Pork'), dish('Beef Tacos', 'Beef'), side('Rice')
];

module.exports = { Seed, units, healthRules, settings, varietyRules, dish, side, slot, restaurantSlot, library };
