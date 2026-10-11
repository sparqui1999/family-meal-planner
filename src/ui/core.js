// Shared UI plumbing: DOM builder, server calls, dialogs, toasts, tabs, auto-refresh.
// Screens live in their own files and register themselves with UI.screens.
var UI = (function () {
  'use strict';

  var state = { boot: null, tab: 'week', today: '', inflight: 0, dialogs: 0 };
  var screens = {};
  var TABS = [['week', 'This Week'], ['plan', 'Plan'], ['dishes', 'Dishes'], ['restaurants', 'Restaurants'], ['shopping', 'Shopping']];
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function appendChild_(node, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { appendChild_(node, x); }); return; }
    node.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  // h('div', {class: 'x', onclick: fn}, child, 'text', [more children])
  function h(tag, attrs) {
    var node = document.createElement(tag);
    var pendingValue;
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'value') pendingValue = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'checked' || k === 'disabled' || k === 'selected') node[k] = !!v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) appendChild_(node, arguments[i]);
    if (pendingValue !== undefined) node.value = pendingValue;
    return node;
  }

  function busy_(delta) {
    state.inflight += delta;
    var bar = document.getElementById('busy');
    if (bar) bar.hidden = state.inflight <= 0;
  }

  // Promise wrapper around google.script.run.
  function call(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
      if (typeof google === 'undefined' || !google.script) {
        reject(new Error('This page must be opened from the Google Apps Script link.'));
        return;
      }
      busy_(1);
      var runner = google.script.run
        .withSuccessHandler(function (r) { busy_(-1); resolve(r); })
        .withFailureHandler(function (e) {
          busy_(-1);
          reject(new Error(String(e && e.message ? e.message : e).replace(/^Error:\s*/, '')));
        });
      runner[name].apply(runner, args);
    });
  }

  function toast(message, isError) {
    var box = document.getElementById('toasts');
    var t = h('div', { class: 'toast' + (isError ? ' err' : ''), text: message });
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, isError ? 8000 : 4000);
  }

  function fail(e) { toast(e && e.message ? e.message : String(e), true); }

  // dialog('Title', bodyNode, { wide, full, actions: [{label, primary, danger, onclick}] }) -> { close, body }
  function dialog(title, body, opts) {
    var o = opts || {};
    var root = document.getElementById('dialogs');
    var overlay = h('div', { class: 'overlay' });
    var box = h('div', { class: 'dialog' + (o.wide ? ' wide' : '') + (o.full ? ' full' : ''), role: 'dialog' });
    var api = {
      body: body,
      close: function () {
        if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); state.dialogs -= 1; }
        if (o.onclose) o.onclose();
      }
    };
    var actions = h('div', { class: 'actions' });
    (o.actions || []).forEach(function (a) {
      actions.appendChild(h('button', {
        class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), text: a.label,
        onclick: function () { a.onclick(api); }
      }));
    });
    if (!o.noClose) actions.appendChild(h('button', { class: 'btn', text: o.closeLabel || 'Close', onclick: api.close }));
    box.appendChild(h('h2', { text: title }));
    box.appendChild(body);
    box.appendChild(actions);
    overlay.appendChild(box);
    root.appendChild(overlay);
    state.dialogs += 1;
    return api;
  }

  function confirmBox(message, okLabel) {
    return new Promise(function (resolve) {
      var done = false;
      var d = dialog('Please confirm', h('p', { text: message }), {
        noClose: true,
        actions: [
          { label: 'Cancel', onclick: function (x) { if (!done) { done = true; resolve(false); } x.close(); } },
          { label: okLabel || 'OK', primary: true, onclick: function (x) { if (!done) { done = true; resolve(true); } x.close(); } }
        ]
      });
      return d;
    });
  }

  function promptBox(title, label, initial) {
    return new Promise(function (resolve) {
      var input = h('input', { type: 'text', value: initial || '' });
      dialog(title, h('label', { class: 'field' }, h('span', { text: label }), input), {
        noClose: true,
        actions: [
          { label: 'Cancel', onclick: function (x) { x.close(); resolve(null); } },
          { label: 'OK', primary: true, onclick: function (x) { x.close(); resolve(input.value.trim()); } }
        ]
      });
      setTimeout(function () { input.focus(); }, 50);
    });
  }

  function field(label, input) {
    return h('label', { class: 'field' }, h('span', { text: label }), input);
  }

  function select(options, value, onchange, blankLabel) {
    var s = h('select', { onchange: onchange });
    if (blankLabel !== undefined) s.appendChild(h('option', { value: '', text: blankLabel }));
    options.forEach(function (o) {
      var val = typeof o === 'object' ? o.value : o;
      var text = typeof o === 'object' ? o.label : o;
      s.appendChild(h('option', { value: val, text: text }));
    });
    s.value = value == null ? '' : value;
    return s;
  }

  function stars(current, onRate) {
    var wrap = h('span', { class: 'stars' });
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        wrap.appendChild(h('button', {
          type: 'button', 'aria-label': n + ' star' + (n > 1 ? 's' : ''),
          text: current != null && n <= Math.round(current) ? '★' : '☆',
          onclick: onRate ? function () { onRate(n); } : null, disabled: !onRate
        }));
      })(i);
    }
    return wrap;
  }

  function healthBadge(score, label) {
    if (score == null || score === '') return h('span', { class: 'badge', text: (label || 'Health') + ' –' });
    var cls = score >= 7 ? 'good' : score >= 4 ? 'mid' : 'low';
    return h('span', { class: 'badge ' + cls, text: (label || 'Health') + ' ' + score });
  }

  function dayLabel(iso) {
    var d = Dates.dayOfWeek(iso);
    var text = DAY_NAMES[d] + ' ' + MONTHS[Dates.month(iso) - 1] + ' ' + Number(iso.slice(8, 10));
    if (iso === state.today) return 'Today, ' + text;
    if (iso === Dates.addDays(state.today, 1)) return 'Tomorrow, ' + text;
    return text;
  }

  function longDate(iso) {
    return LONG_DAYS[Dates.dayOfWeek(iso)] + ', ' + MONTHS[Dates.month(iso) - 1] + ' ' + Number(iso.slice(8, 10));
  }

  function localToday() {
    var tz = state.boot && state.boot.settings.timezone;
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      return state.today;
    }
  }

  function show(tab) {
    state.tab = tab;
    var nav = document.getElementById('nav');
    Array.prototype.forEach.call(nav.children, function (b) { b.className = b.getAttribute('data-tab') === tab ? 'on' : ''; });
    var view = document.getElementById('view');
    view.innerHTML = '';
    if (screens[tab]) screens[tab].render(view);
  }

  function refreshCurrent() {
    if (state.dialogs > 0) return;
    var s = screens[state.tab];
    if (s && s.refresh) s.refresh();
  }

  function init() {
    var view = document.getElementById('view');
    view.appendChild(h('div', { class: 'empty', text: 'Loading...' }));
    call('api_bootstrap').then(function (boot) {
      state.boot = boot;
      state.today = boot.today;
      document.getElementById('who').textContent = boot.me.name + (boot.activeProfile && boot.activeProfile !== 'Normal' ? ' • ' + boot.activeProfile : '');
      var nav = document.getElementById('nav');
      TABS.forEach(function (t) {
        nav.appendChild(h('button', { 'data-tab': t[0], text: t[1], onclick: function () { show(t[0]); } }));
      });
      show('week');
      var minutes = Number(boot.settings.refresh_minutes) || 5;
      setInterval(refreshCurrent, minutes * 60000);
      setInterval(function () {
        var now = localToday();
        if (now && now !== state.today) {
          state.today = now;
          if (state.tab === 'week') show('week');
        }
      }, 30000);
    }).catch(function (e) {
      view.innerHTML = '';
      view.appendChild(h('div', { class: 'card' }, h('h2', { text: 'Cannot open the planner' }), h('p', { text: e.message })));
    });
  }

  return {
    state: state, screens: screens, h: h, call: call, toast: toast, fail: fail, dialog: dialog,
    confirmBox: confirmBox, promptBox: promptBox, field: field, select: select, stars: stars, healthBadge: healthBadge,
    dayLabel: dayLabel, longDate: longDate, show: show, init: init, localToday: localToday
  };
})();
