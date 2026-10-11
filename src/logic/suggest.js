// Meal and restaurant suggestions. Pure: all data in, picks out; randomness injected.
var Suggest = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }
  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }
  function Scoring_() { return (typeof module !== 'undefined' && module.exports) ? require('./scoring') : Scoring; }
  function Variety_() { return (typeof module !== 'undefined' && module.exports) ? require('./variety') : Variety; }

  function k_(x) { return Ingredients_().normalize(x); }
  function num_(v, d) { var n = Number(v); return (v === '' || v == null || isNaN(n)) ? d : n; }
  function isActive_(s) { return s.status !== 'removed' && s.status !== 'replaced'; }
  function slotKey_(s) { return [s.date, s.kind, k_(s.dish), k_(s.restaurant)].join('|'); }

  function descriptor_(slot, dishByKey, restByKey) {
    if (slot.kind === 'restaurant') {
      var r = restByKey[k_(slot.restaurant)];
      return { date: slot.date, kind: 'restaurant', type: '', cuisine: r ? r.cuisine : '', tags: [] };
    }
    var d = dishByKey[k_(slot.dish)];
    return { date: slot.date, kind: 'home', type: d ? d.type : '', cuisine: d ? d.cuisine : '', tags: d ? (d.tags || []) : [] };
  }

  function buildWorking_(request, ctx, openSet) {
    var working = [];
    var seen = {};
    var add = function (slot) {
      if (!isActive_(slot) || openSet[slot.date]) return;
      var key = slotKey_(slot);
      if (seen[key]) return;
      seen[key] = true;
      working.push(slot);
    };
    (ctx.history || []).forEach(add);
    (request.lockedSlots || []).forEach(add);
    return working;
  }

  // request: { openDates, lockedSlots, excludeDishes, profile }
  // -> { suggestions: [{date, dish, sides, score}], unfilled: [{date, reason}] }
  function suggestMeals(request, ctx, rng) {
    var s = ctx.settings || {};
    var d = Dates_();
    var scoring = Scoring_();
    var variety = Variety_();
    var dishes = ctx.dishes || [];
    var dishByKey = {};
    dishes.forEach(function (x) { dishByKey[k_(x.name)] = x; });
    var restByKey = {};
    (ctx.restaurants || []).forEach(function (x) { restByKey[k_(x.name)] = x; });

    var open = (request.openDates || []).slice().sort();
    var openSet = {};
    open.forEach(function (x) { openSet[x] = true; });
    var working = buildWorking_(request, ctx, openSet);
    var excluded = {};
    (request.excludeDishes || []).forEach(function (n) { excluded[k_(n)] = true; });
    var rules = variety.activeRules(ctx.varietyRules || [], request.profile || s.active_profile);
    var repeatDays = num_(s.repeat_days, 21);
    var maxIdeas = num_(s.max_ideas_per_week, 1);
    var firstDay = s.first_day_of_week == null ? 0 : s.first_day_of_week;
    var seasonMonths = s.season_months || scoring.seasonMonths(s);

    var suggestions = [];
    var unfilled = [];

    var dishDatesFor = function (name) {
      var out = [];
      working.forEach(function (sl) {
        if (sl.kind === 'home' && k_(sl.dish) === k_(name)) out.push(sl.date);
      });
      return out;
    };

    open.forEach(function (date) {
      var week = d.startOfWeek(date, firstDay);
      var ideasThisWeek = working.filter(function (sl) {
        var dd = sl.kind === 'home' ? dishByKey[k_(sl.dish)] : null;
        return dd && dd.status === 'idea' && d.startOfWeek(sl.date, firstDay) === week;
      }).length;

      var pool = dishes.filter(function (x) { return x.role === 'main' && (x.status === 'active' || x.status === 'idea'); });
      var reason = '';
      var step = function (list, why) {
        if (!list.length && !reason) reason = why;
        return list;
      };
      pool = step(pool.filter(function (x) { return x.status === 'active' || ideasThisWeek < maxIdeas; }), 'no active dishes in the library');
      pool = step(pool.filter(function (x) { return !excluded[k_(x.name)]; }), 'every dish was already shown or excluded');
      pool = step(pool.filter(function (x) {
        return scoring.daysSince(x.name, date, dishDatesFor(x.name)) >= repeatDays;
      }), 'every dish was cooked too recently');
      pool = step(pool.filter(function (x) {
        if (!x.seasons || !x.seasons.length) return true;
        var season = d.seasonOf(date, seasonMonths);
        return x.seasons.some(function (z) { return String(z).toLowerCase() === String(season).toLowerCase(); });
      }), 'every dish is out of season');
      pool = step(pool.filter(function (x) {
        return !(s.cook_time_mode === 'strict' && scoring.exceedsCookLimit(x, date, s));
      }), 'every dish takes too long for that day');
      var workingDescs = working.map(function (sl) { return descriptor_(sl, dishByKey, restByKey); });
      pool = step(pool.filter(function (x) {
        var cand = { date: date, kind: 'home', type: x.type, cuisine: x.cuisine, tags: x.tags || [] };
        return variety.check(workingDescs, cand, rules, s).length === 0;
      }), 'the variety rules rule out every dish');

      if (!pool.length) {
        unfilled.push({ date: date, reason: reason || 'no dish is eligible' });
        return;
      }

      var items = pool.map(function (x) {
        return {
          item: x,
          weight: scoring.scoreDish(x, date, {
            settings: s,
            ratingByDish: ctx.ratingByDish,
            daysSince: function (name, dt) { return scoring.daysSince(name, dt, dishDatesFor(name)); },
            seasonMonths: seasonMonths,
            typeWeights: ctx.typeWeights
          })
        };
      });
      var pick = scoring.weightedPick(items, rng);

      var sides = (ctx.dishSides || [])
        .filter(function (r) {
          return k_(r.main_dish) === k_(pick.name) && (r.is_default === true || String(r.is_default).toUpperCase() === 'TRUE');
        })
        .map(function (r) { return dishByKey[k_(r.side_dish)]; })
        .filter(function (x) { return x && x.role === 'side' && x.status === 'active'; })
        .map(function (x) { return x.name; })
        .slice(0, 3);

      var score = items.filter(function (i) { return i.item === pick; })[0].weight;
      suggestions.push({ date: date, dish: pick.name, sides: sides, score: Math.round(score * 1000) / 1000 });
      working.push({ date: date, kind: 'home', dish: pick.name, status: 'planned' });
    });

    return { suggestions: suggestions, unfilled: unfilled };
  }

  // request: { date, excludeNames, count }
  // ctx: { restaurants, ratingByRestaurant, visits:[{restaurant,date}], history, settings, varietyRules, ... }
  // -> { restaurants: [{name, score}], exhausted }
  function suggestRestaurants(request, ctx, rng) {
    var s = ctx.settings || {};
    var scoring = Scoring_();
    var variety = Variety_();
    var count = num_(request.count, num_(s.restaurant_suggest_count, 5));
    var repeatDays = num_(s.restaurant_repeat_days, 14);
    var cap = num_(s.recency_cap_days, 90);
    var excluded = {};
    (request.excludeNames || []).forEach(function (n) { excluded[k_(n)] = true; });

    var dishByKey = {};
    (ctx.dishes || []).forEach(function (x) { dishByKey[k_(x.name)] = x; });
    var restByKey = {};
    (ctx.restaurants || []).forEach(function (x) { restByKey[k_(x.name)] = x; });

    var openSet = {};
    openSet[request.date] = true;
    var working = buildWorking_(request, ctx, openSet);
    var descs = working.map(function (sl) { return descriptor_(sl, dishByKey, restByKey); });
    var rules = variety.activeRules(ctx.varietyRules || [], request.profile || s.active_profile);

    var visitDates = {};
    (ctx.visits || []).forEach(function (v) { (visitDates[k_(v.restaurant)] = visitDates[k_(v.restaurant)] || []).push(v.date); });
    working.forEach(function (sl) {
      if (sl.kind === 'restaurant') (visitDates[k_(sl.restaurant)] = visitDates[k_(sl.restaurant)] || []).push(sl.date);
    });

    var pool = (ctx.restaurants || []).filter(function (r) { return r.status !== 'retired' && !excluded[k_(r.name)]; });
    pool = pool.filter(function (r) {
      return scoring.daysSince(r.name, request.date, visitDates[k_(r.name)] || []) >= repeatDays;
    });
    pool = pool.filter(function (r) {
      var cand = { date: request.date, kind: 'restaurant', type: '', cuisine: r.cuisine, tags: [] };
      return variety.check(descs, cand, rules, s).length === 0;
    });

    var items = pool.map(function (r) {
      var rating = ctx.ratingByRestaurant && ctx.ratingByRestaurant[k_(r.name)];
      var avg = rating && rating.avg != null ? rating.avg : 3;
      var days = scoring.daysSince(r.name, request.date, visitDates[k_(r.name)] || []);
      var recency = Math.min(isFinite(days) ? days : cap, cap) / cap;
      var fav = r.favorite === true || String(r.favorite).toUpperCase() === 'TRUE' ? 1 : 0;
      var score = Math.max(0.05, 1 + num_(s.w_rating, 1) * (avg - 3) / 2 + num_(s.w_favorite, 0.5) * fav + num_(s.w_recency, 1) * recency);
      return { item: r, weight: score };
    });

    var picked = [];
    while (picked.length < count && items.length) {
      var choice = scoring.weightedPick(items, rng);
      var idx = items.findIndex(function (i) { return i.item === choice; });
      picked.push({ name: choice.name, score: Math.round(items[idx].weight * 1000) / 1000 });
      items.splice(idx, 1);
    }
    return { restaurants: picked, exhausted: picked.length < count };
  }

  return { suggestMeals: suggestMeals, suggestRestaurants: suggestRestaurants };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Suggest; }
