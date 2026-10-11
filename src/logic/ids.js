// Internal ids (plan, queue, shopping item only). Everything else is keyed by name.
var Ids = (function () {
  'use strict';

  // next('P', ['P-0001','P-0007']) -> 'P-0008'
  function next(prefix, existingIds, pad) {
    var width = pad == null ? 4 : pad;
    var max = 0;
    var re = new RegExp('^' + prefix + '-(\\d+)$');
    (existingIds || []).forEach(function (id) {
      var m = re.exec(String(id));
      if (m) max = Math.max(max, Number(m[1]));
    });
    var n = String(max + 1);
    while (n.length < width) n = '0' + n;
    return prefix + '-' + n;
  }

  return { next: next };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Ids; }
