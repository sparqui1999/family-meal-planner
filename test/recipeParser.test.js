'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const RecipeParser = require('../src/logic/recipeParser');
const { units } = require('./helpers/fixtures');

const line = (s) => RecipeParser.parseIngredientLine(s, units);

describe('RecipeParser.parseIngredientLine', () => {
  it('reads amount, unit, ingredient and note', () => {
    const l = line('2 cups flour, sifted');
    assert.equal(l.qty, 2); assert.equal(l.qty_text, '2'); assert.equal(l.unit, 'cup');
    assert.equal(l.name, 'flour'); assert.equal(l.prep_note, 'sifted'); assert.equal(l.confidence, 'ok');
  });
  it('reads mixed numbers and unicode fractions', () => {
    assert.equal(line('1 1/2 tsp salt').qty, 1.5);
    assert.equal(line('1½ tsp salt').qty, 1.5);
    assert.equal(line('1/2 cup milk').qty, 0.5);
  });
  it('reads ranges using the larger number', () => {
    const l = line('2-3 cloves garlic');
    assert.equal(l.qty, 3); assert.equal(l.unit, 'clove'); assert.equal(l.name, 'garlic'); assert.equal(l.qty_text, '2-3');
  });
  it('handles lines with no amount', () => {
    const l = line('salt, to taste');
    assert.equal(l.qty, null); assert.equal(l.qty_text, ''); assert.equal(l.name, 'salt'); assert.equal(l.prep_note, 'to taste');
  });
  it('treats a size in parentheses as a note and flags it for review', () => {
    const l = line('1 (14 oz) can diced tomatoes');
    assert.equal(l.qty, 1); assert.equal(l.unit, 'can'); assert.equal(l.name, 'diced tomatoes');
    assert.equal(l.prep_note, '14 oz'); assert.equal(l.confidence, 'review');
  });
  it('recognizes optional ingredients', () => {
    const a = line('parsley (optional)');
    assert.equal(a.optional, true); assert.equal(a.name, 'parsley');
    const b = line('1 tbsp chives, optional');
    assert.equal(b.optional, true); assert.equal(b.name, 'chives');
  });
  it('keeps an unknown container word as the unit and asks for review', () => {
    const l = line('1 handful spinach');
    assert.equal(l.unit, 'handful'); assert.equal(l.name, 'spinach'); assert.equal(l.confidence, 'review');
  });
  it('leaves adjectives in the name when there is no unit', () => {
    const l = line('2 large eggs');
    assert.equal(l.unit, ''); assert.equal(l.name, 'large eggs'); assert.equal(l.qty, 2);
  });
  it('strips bullets and does not choke on blank lines', () => {
    assert.equal(line('• 1 cup rice').name, 'rice');
    assert.equal(line('').confidence, 'review');
    assert.equal(line(null).name, '');
  });
});

describe('RecipeParser.parseRecipeText', () => {
  const recipe = [
    'Chicken Pasta', 'Serves 4', 'Prep: 15 min', 'Cook Time: 1 hour',
    'Ingredients', 'For the sauce:', '2 tbsp olive oil', '1 lb chicken breast', 'For the pasta', '8 oz penne',
    'Directions', '1. Boil the pasta for 10 minutes.', '2) Cook the chicken.', 'SAUCE', 'Step 3: Simmer 20-25 minutes.'
  ].join('\n');

  it('reads the title, servings and times', () => {
    const r = RecipeParser.parseRecipeText(recipe, units);
    assert.equal(r.title, 'Chicken Pasta'); assert.equal(r.servings, 4); assert.equal(r.prep_min, 15); assert.equal(r.cook_min, 60);
  });
  it('groups ingredients under their headings', () => {
    const r = RecipeParser.parseRecipeText(recipe, units);
    assert.deepEqual(r.ingredients.map((i) => i.group_label + '|' + i.name), ['For the sauce|olive oil', 'For the sauce|chicken breast', 'For the pasta|penne']);
  });
  it('numbers the steps, strips numbering and sections them', () => {
    const r = RecipeParser.parseRecipeText(recipe, units);
    assert.deepEqual(r.steps.map((s) => s.step_no), [1, 2, 3]);
    assert.equal(r.steps[0].text, 'Boil the pasta for 10 minutes.');
    assert.equal(r.steps[1].text, 'Cook the chicken.');
    assert.equal(r.steps[2].section_label, 'SAUCE');
  });
  it('finds timers in steps, using the last number of a range', () => {
    const r = RecipeParser.parseRecipeText(recipe, units);
    assert.deepEqual(r.steps.map((s) => s.timer_min), [10, null, 25]);
  });
  it('converts hours to minutes', () => {
    const r = RecipeParser.parseRecipeText('Ingredients\n1 cup rice\nDirections\nBake for 1.5 hours.', units);
    assert.equal(r.steps[0].timer_min, 90);
  });
  it('accepts Instructions, Method and Steps headings, with or without a colon', () => {
    for (const head of ['Instructions', 'Method:', 'STEPS', 'directions:']) {
      const r = RecipeParser.parseRecipeText('Ingredients:\n1 cup rice\n' + head + '\nCook it.', units);
      assert.equal(r.steps.length, 1, head);
      assert.equal(r.ingredients.length, 1, head);
    }
  });
  it('guesses when there are no headings, and warns', () => {
    const r = RecipeParser.parseRecipeText('2 cups flour\n1 tbsp sugar\nMix well.\n1. Bake.', units);
    assert.equal(r.ingredients.length, 2); assert.equal(r.steps.length, 2);
    assert.ok(r.warnings.some((w) => /headings/.test(w)));
  });
  it('warns about ingredients it is unsure of', () => {
    const r = RecipeParser.parseRecipeText('Ingredients\n1 (14 oz) can beans\nDirections\nHeat.', units);
    assert.ok(r.warnings.some((w) => /14 oz/.test(w)));
  });
  it('never throws on empty or odd input', () => {
    assert.ok(RecipeParser.parseRecipeText('', units).warnings.length >= 1);
    assert.ok(RecipeParser.parseRecipeText(null, units).warnings.length >= 1);
    assert.doesNotThrow(() => RecipeParser.parseRecipeText('\n\n:::\n???', units));
    assert.doesNotThrow(() => RecipeParser.parseRecipeText('Ingredients', units));
  });
  it('does not mistake a cooking step for a time line', () => {
    const r = RecipeParser.parseRecipeText('Ingredients\n1 cup rice\nDirections\nCook the rice for 20 minutes.', units);
    assert.equal(r.cook_min, null);
    assert.equal(r.steps[0].timer_min, 20);
  });
});
