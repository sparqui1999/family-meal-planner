// Date helpers. Dates are 'YYYY-MM-DD' strings; math is UTC-based so DST never matters.
var Dates = (function () {
  'use strict';

  var MS = 86400000;

  function parse_(iso) {
    var p = String(iso).split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function format_(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function isValid(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    return format_(parse_(iso)) === iso;
  }

  function addDays(iso, n) {
    return format_(parse_(iso) + n * MS);
  }

  // Whole days from a to b (b - a).
  function diffDays(a, b) {
    return Math.round((parse_(b) - parse_(a)) / MS);
  }

  // 0 = Sunday ... 6 = Saturday
  function dayOfWeek(iso) {
    return new Date(parse_(iso)).getUTCDay();
  }

  function startOfWeek(iso, firstDay) {
    var fd = firstDay == null || firstDay === '' ? 0 : Number(firstDay);
    var back = (dayOfWeek(iso) - fd + 7) % 7;
    return addDays(iso, -back);
  }

  function range(startIso, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(addDays(startIso, i));
    return out;
  }

  function month(iso) {
    return Number(String(iso).slice(5, 7));
  }

  // seasonMonthsMap: { Winter: [12,1,2], Spring: [3,4,5], ... }
  function seasonOf(iso, seasonMonthsMap) {
    var m = month(iso);
    for (var name in seasonMonthsMap) {
      if (Object.prototype.hasOwnProperty.call(seasonMonthsMap, name) && seasonMonthsMap[name].indexOf(m) !== -1) {
        return name;
      }
    }
    return null;
  }

  function isWeekend(iso, weekendDays) {
    return weekendDays.indexOf(dayOfWeek(iso)) !== -1;
  }

  // "0,6" or 6 or [0,6] -> [0,6]
  function parseDayList(value) {
    if (Array.isArray(value)) return value.map(Number);
    return String(value == null ? '' : value)
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; })
      .map(Number);
  }

  return {
    isValid: isValid,
    addDays: addDays,
    diffDays: diffDays,
    dayOfWeek: dayOfWeek,
    startOfWeek: startOfWeek,
    range: range,
    month: month,
    seasonOf: seasonOf,
    isWeekend: isWeekend,
    parseDayList: parseDayList
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Dates; }
