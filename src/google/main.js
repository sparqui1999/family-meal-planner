// Web app entry point and the member gate used by every api_* function.

function today_() {
  var tz = 'America/Los_Angeles';
  try {
    var rows = Db.readAll('cfg_settings');
    for (var i = 0; i < rows.length; i++) if (rows[i].key === 'timezone' && rows[i].value) tz = rows[i].value;
  } catch (e) { tz = Session.getScriptTimeZone(); }
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function requireMember_() {
  var email = Session.getActiveUser().getEmail();
  var member = Members.find(email, Db.readAll('cfg_members'));
  if (!member) throw new Error('No access for ' + (email || 'this account') + '. Ask an admin to add you to the planner.');
  return member;
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function doGet() {
  var email = Session.getActiveUser().getEmail();
  var member = null;
  try { member = Members.find(email, Db.readAll('cfg_members')); } catch (e) {
    return HtmlService.createHtmlOutput('<p style="font:18px sans-serif;padding:24px">' + escapeHtml_(e.message) + '</p>')
      .setTitle('Family Meal Planner');
  }
  if (!member) {
    return HtmlService.createHtmlOutput(
      '<div style="font:18px sans-serif;padding:24px"><h2>No access</h2><p>' + escapeHtml_(email || 'This account') +
      ' is not on the family list. Ask the planner admin to add this email to the cfg_members tab.</p></div>'
    ).setTitle('Family Meal Planner');
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Family Meal Planner')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { doGet: doGet }; }
