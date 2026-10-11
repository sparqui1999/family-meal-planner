// Dish scoring and weighted random pick. All weights come from cfg_settings.
var Scoring = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }
  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function num_(v, d) {
    var n = Number(v);
    return (v === '' || v == null || isNaN(n)) ? d : n;
  }

  // cfg_settings rows [{key,value}] -> typed settings object (+ weekend_days_list, season_months)
  function parseSettings(rows) {
    var s = {};
    (rows || []).forEach(function (r) {
      var v = r.value;
      if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) v = Number(v);
      s[r.key] = v;
    });
    var d = Dates_();
    s.weekend_days_list = d.parseDayList(s.weekend_days != null ? s.weekend_days : '0,6');
    s.season_months = seasonMonths(s);
    return s;
  }

  function seasonMonths(s) {
    var d = Dates_();
    return {
      Winter: d.parseDayList(s.season_winter != null ? s.season_winter : '12,1,2'),
      Spring: d.parseDayList(s.season_spring != null ? s.season_spring : '3,4,5'),
      Summer: d.parseDayList(s.season_summer != null ? s.season_summer : '6,7,8'),
      Fall: d.parseDayList(s.season_fall != null ? s.season_fall : '9,10,11')
    };
  }

  // cfg_type_weights rows -> { normalizedTypeName: multiplier } for one profile
  function typeWeightMap(rows, profile) {
    var map = {};
    (rows || []).forEach(function (r) {
      if (String(r.profile).trim().toLowerCase() !== String(profile).trim().toLowerCase()) return;
      var m = Number(r.multiplier);
      if (!isNaN(m)) map[Ingredients_().normalize(r.type)] = m;
    });
    return map;
  }

  function minutes_(dish) {
    return num_(dish.prep_min, 0) + num_(dish.cook_min, 0);
  }

  function weekendList_(s) {
    return s.weekend_days_list || Dates_().parseDayList(s.weekend_days != null ? s.weekend_days : '0,6');
  }

  function cookLimit(date, settings) {
    var s = settings || {};
    return Dates_().isWeekend(date, weekendList_(s)) ? num_(s.weekend_max_minutes, 120) : num_(s.weeknight_max_minutes, 45);
  }

  function exceedsCookLimit(dish, date, settings) {
    return minutes_(dish) > cookLimit(date, settings);
  }

  // Smallest number of days between `date` and any date in historyDates; Infinity if none.
  function daysSince(name, date, historyDates) {
    var best = Infinity;
    (historyDates || []).forEach(function (h) {
      var diff = Math.abs(Dates_().diffDays(h, date));
      if (diff < best) best = diff;
    });
    return best;
  }

  // ctx: { settings, ratingByDish, daysSince(name,date), seasonMonths | season, typeWeights }
  function scoreDish(dish, date, ctx) {
    var s = ctx.settings || {};
    var key = Ingredients_().normalize(dish.name);
    var rating = ctx.ratingByDish && ctx.ratingByDish[key];
    var avg = rating && rating.avg != null ? rating.avg : 3;
    var cap = num_(s.recency_cap_days, 90);
    var days = typeof ctx.daysSince === 'function' ? ctx.daysSince(dish.name, date) : Infinity;
    var recency = Math.min(isFinite(days) ? days : cap, cap) / cap;

    var season = ctx.season || null;
    if (!season) {
      var months = ctx.seasonMonths || s.season_months || seasonMonths(s);
      season = Dates_().seasonOf(date, months);
    }
    var seasonHit = season && (dish.seasons || []).some(function (x) {
      return String(x).trim().toLowerCase() === String(season).toLowerCase();
    }) ? 1 : 0;

    var penalty = 0;
    if (s.cook_time_mode !== 'strict' && exceedsCookLimit(dish, date, s)) penalty = num_(s.w_time_penalty, 0.75);

    var favorite = dish.favorite === true || String(dish.favorite).toUpperCase() === 'TRUE' ? 1 : 0;
    var value = 1 +
      num_(s.w_rating, 1) * (avg - 3) / 2 +
      num_(s.w_favorite, 0.5) * favorite +
      num_(s.w_recency, 1) * recency +
      num_(s.w_health, 0.3) * (num_(dish.health_score, 5) - 5) / 5 +
      num_(s.w_season, 0.5) * seasonHit -
      penalty;
    value = Math.max(0.05, value);
    var tw = ctx.typeWeights ? ctx.typeWeights[Ingredients_().normalize(dish.type)] : undefined;
    return value * (tw == null ? 1 : tw);
  }

  // items: [{ item, weight }] -> chosen item or null
  function weightedPick(items, rng) {
    if (!items || !items.length) return null;
    var total = items.reduce(function (a, b) { return a + Math.max(0, b.weight); }, 0);
    if (total <= 0) return items[Math.floor(rng() * items.length)].item;
    var r = rng() * total;
    for (var i = 0; i < items.length; i++) {
      r -= Math.max(0, items[i].weight);
      if (r < 0) return items[i].item;
    }
    return items[items.length - 1].item;
  }

  return {
    parseSettings: parseSettings,
    seasonMonths: seasonMonths,
    typeWeightMap: typeWeightMap,
    cookLimit: cookLimit,
    exceedsCookLimit: exceedsCookLimit,
    daysSince: daysSince,
    scoreDish: scoreDish,
    weightedPick: weightedPick
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Scoring; }
