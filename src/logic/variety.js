// Variety rules: limits per week and "not back-to-back" checks.
// A slot descriptor is { date, kind: 'home'|'restaurant', type, cuisine, tags: [] } (names).
var Variety = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }

  function eq_(a, b) {
    return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
  }

  function isOff_(rule) {
    return rule.active === false || String(rule.active).toUpperCase() === 'FALSE';
  }

  function activeRules(rules, profile) {
    return (rules || []).filter(function (r) {
      if (isOff_(r)) return false;
      return !r.profile || eq_(r.profile, profile);
    });
  }

  function valuesOf_(slot, by) {
    var vals = by === 'type' ? [slot.type] : by === 'cuisine' ? [slot.cuisine] : (slot.tags || []);
    return vals.filter(function (v) { return v != null && String(v).trim() !== ''; });
  }

  function matches_(slot, by, value) {
    return valuesOf_(slot, by).some(function (v) { return eq_(v, value); });
  }

  function dayFits_(dayClass, date, weekend) {
    if (!dayClass || dayClass === 'all') return true;
    var isWk = Dates_().isWeekend(date, weekend);
    return dayClass === 'weekends' ? isWk : !isWk;
  }

  // -> [{ rule, message }]
  function check(slots, candidate, rules, settings) {
    var s = settings || {};
    var d = Dates_();
    var firstDay = s.first_day_of_week == null ? 0 : s.first_day_of_week;
    var weekend = s.weekend_days_list || d.parseDayList(s.weekend_days != null ? s.weekend_days : '0,6');
    var candWeek = d.startOfWeek(candidate.date, firstDay);
    var prev = d.addDays(candidate.date, -1);
    var next = d.addDays(candidate.date, 1);
    var out = [];
    var seen = {};

    function push(rule, message) {
      var key = rule.rule + '|' + message;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ rule: rule.rule, message: message });
    }

    (rules || []).forEach(function (r) {
      if (isOff_(r)) return;
      var appliesTo = r.applies_to || 'both';
      if (appliesTo !== 'both' && appliesTo !== candidate.kind) return;
      var dayClass = r.days || 'all';
      if (!dayFits_(dayClass, candidate.date, weekend)) return;

      var cvals = valuesOf_(candidate, r.match_by);
      var targets = r.match_value === '*' ? cvals : cvals.filter(function (v) { return eq_(v, r.match_value); });
      if (!targets.length) return;

      var kindFits = function (sl) { return appliesTo === 'both' || sl.kind === appliesTo; };
      var hasLimit = r.limit !== '' && r.limit != null && !isNaN(Number(r.limit));
      var wantsConsecutive = r.consecutive === true || String(r.consecutive).toUpperCase() === 'TRUE';

      targets.forEach(function (v) {
        if (hasLimit) {
          var count = (slots || []).filter(function (sl) {
            return sl.date !== candidate.date && kindFits(sl) && dayFits_(dayClass, sl.date, weekend) &&
              d.startOfWeek(sl.date, firstDay) === candWeek && matches_(sl, r.match_by, v);
          }).length;
          if (count >= Number(r.limit)) {
            push(r, r.rule + ': already ' + count + ' "' + v + '" this week (limit ' + r.limit + ')');
          }
        }
        if (wantsConsecutive) {
          var adjacent = (slots || []).some(function (sl) {
            return (sl.date === prev || sl.date === next) && kindFits(sl) && matches_(sl, r.match_by, v);
          });
          if (adjacent) push(r, r.rule + ': "' + v + '" is on the day before or after');
        }
      });
    });
    return out;
  }

  return { activeRules: activeRules, check: check };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Variety; }
