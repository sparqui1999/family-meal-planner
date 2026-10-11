// Moving, swapping and replacing planned meals. Never mutates its input.
// A slot is { plan_id, date, kind, dish, side_1..3, restaurant, servings, status, locked, notes }.
var PlanOps = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }
  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function isActive_(s) { return s.status !== 'removed' && s.status !== 'replaced'; }

  function copy_(s) {
    var c = {};
    Object.keys(s).forEach(function (k) { c[k] = s[k]; });
    return c;
  }

  function occupant_(plan, date, exceptIdx) {
    for (var i = 0; i < plan.length; i++) {
      if (i !== exceptIdx && plan[i].date === date && isActive_(plan[i])) return i;
    }
    return -1;
  }

  function swapDays(plan, a, b) {
    var out = plan.map(copy_);
    if (a === b) return out;
    out.forEach(function (s) {
      if (!isActive_(s)) return;
      if (s.date === a) s.date = b;
      else if (s.date === b) s.date = a;
    });
    return out;
  }

  // opts.ifOccupied: 'swap' | 'shift' | 'queue_existing' | 'delete_existing'
  function moveToDay(plan, from, to, opts) {
    var mode = (opts && opts.ifOccupied) || 'swap';
    var out = plan.map(copy_);
    var result = { plan: out, queued: [], removed: [], notes: [] };
    if (from === to) return result;
    var mi = occupant_(out, from, -1);
    if (mi < 0) {
      result.notes.push('Nothing is planned on ' + from + '.');
      return result;
    }
    var oi = occupant_(out, to, mi);
    if (oi < 0) {
      out[mi].date = to;
      return result;
    }
    if (mode === 'swap') {
      out[mi].date = to;
      out[oi].date = from;
    } else if (mode === 'shift') {
      var chain = [];
      var day = to;
      for (;;) {
        var idx = occupant_(out, day, mi);
        if (idx < 0) break;
        chain.push(idx);
        day = Dates_().addDays(day, 1);
      }
      chain.forEach(function (i) { out[i].date = Dates_().addDays(out[i].date, 1); });
      out[mi].date = to;
      result.notes.push('Moved ' + chain.length + ' meal(s) one day later.');
    } else if (mode === 'queue_existing') {
      result.queued.push(copy_(out[oi]));
      out[oi].status = 'removed';
      out[mi].date = to;
    } else if (mode === 'delete_existing') {
      out[oi].status = 'removed';
      result.removed.push(copy_(out[oi]));
      out[mi].date = to;
    } else {
      throw new Error('Unknown option: ' + mode);
    }
    return result;
  }

  // originalAction: { type: 'move', to, ifOccupied } | { type: 'queue' } | { type: 'delete' }
  function eatOut(plan, date, restaurantSlot, originalAction) {
    var slot = copy_(restaurantSlot);
    slot.date = date;
    slot.kind = 'restaurant';
    slot.status = slot.status || 'planned';
    slot.locked = true;
    slot.dish = '';
    var out = plan.map(copy_);
    var result = { plan: out, queued: [], removed: [], notes: [] };
    var oi = occupant_(out, date, -1);
    if (oi >= 0) {
      if (!originalAction || !originalAction.type) {
        throw new Error('Choose what to do with the meal already planned for that day.');
      }
      if (originalAction.type === 'move') {
        if (originalAction.to === date) throw new Error('Pick a different day for the original meal.');
        var moved = moveToDay(out, date, originalAction.to, { ifOccupied: originalAction.ifOccupied });
        result.plan = moved.plan;
        result.queued = moved.queued;
        result.removed = moved.removed;
        result.notes = moved.notes;
      } else if (originalAction.type === 'queue') {
        result.queued.push(copy_(out[oi]));
        out[oi].status = 'removed';
      } else if (originalAction.type === 'delete') {
        out[oi].status = 'removed';
        result.removed.push(copy_(out[oi]));
      } else {
        throw new Error('Unknown option: ' + originalAction.type);
      }
    }
    result.plan.push(slot);
    return result;
  }

  // Slots dated today .. today+days-1 that are planned or cooked, sorted by date. Empty days are omitted.
  function visibleWeek(plan, today, days) {
    var last = Dates_().addDays(today, days - 1);
    return plan
      .filter(function (s) {
        return (s.status === 'planned' || s.status === 'cooked') && s.date >= today && s.date <= last;
      })
      .map(copy_)
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  // Drops slots that point at a dish/restaurant that no longer exists; blanks missing sides.
  function validateDraft(slots, dishNames, restaurantNames) {
    var dishSet = {};
    (dishNames || []).forEach(function (n) { dishSet[Ingredients_().normalize(n)] = true; });
    var restSet = {};
    (restaurantNames || []).forEach(function (n) { restSet[Ingredients_().normalize(n)] = true; });
    var kept = [];
    var dropped = [];
    (slots || []).forEach(function (s) {
      var c = copy_(s);
      var N = Ingredients_().normalize;
      if (c.kind === 'restaurant') {
        var restNew = c.new_restaurant_name && N(c.new_restaurant_name) === N(c.restaurant);
        if (!restSet[N(c.restaurant)] && !restNew) {
          dropped.push({ date: c.date, reason: 'restaurant no longer exists' });
          return;
        }
      } else {
        var dishNew = c.new_dish_name && N(c.new_dish_name) === N(c.dish);
        if (!dishSet[N(c.dish)] && !dishNew) {
          dropped.push({ date: c.date, reason: 'dish no longer exists' });
          return;
        }
        ['side_1', 'side_2', 'side_3'].forEach(function (f) {
          if (c[f] && !dishSet[Ingredients_().normalize(c[f])]) c[f] = '';
        });
      }
      kept.push(c);
    });
    return { slots: kept, dropped: dropped };
  }

  return {
    swapDays: swapDays,
    moveToDay: moveToDay,
    eatOut: eatOut,
    visibleWeek: visibleWeek,
    validateDraft: validateDraft
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = PlanOps; }
