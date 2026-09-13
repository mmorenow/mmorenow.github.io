/* Prepared feedback demonstrates the planned experience. Browser checks are
   separate and never pretend to generate qualitative recommendations. */
(function () {
  'use strict';
  var root = document.querySelector('#review-preview');
  if (!root || !window.LegibleJudge) return;
  var source = root.querySelector('#review-source');
  var draft = root.querySelector('#review-draft');
  var feedback = root.querySelector('#review-feedback');
  var counts = root.querySelector('#review-counts');
  var status = root.querySelector('#review-status');
  var label = root.querySelector('#review-label');
  var audience = root.querySelector('#review-audience');
  var sampleSource = 'An internal security review found a high severity authentication weakness in the support portal. An attacker could access customer records, but exploitation requires local access to a managed workstation. There is no evidence of exploitation. The issue remains unpatched. The application team plans to deploy a fix by Friday.';
  var sampleDraft = 'A minor weakness in the support portal could expose customer records. The issue has been fixed.';
  var mode = 'example', active = 'scope', dismissed = new Set(), current = [], timer;
  var saved = { example: { source: sampleSource, draft: sampleDraft, audience: 'board' }, own: { source: '', draft: '', audience: 'board' } };
  function text(el) { return el.innerText.replace(/\r\n/g, '\n'); }
  function escape(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var examples = [
    { id: 'severity', axis: 'Fidelity', dim: 'D3', title: 'Keep the severity',
      source: 'high severity authentication weakness', target: 'A minor weakness', replacement: 'A high severity authentication weakness',
      reason: '“Minor” softens a finding the source calls high severity. Keep that distinction when describing the risk.' },
    { id: 'scope', axis: 'Fidelity', dim: 'D4', title: 'Keep the access condition',
      source: 'exploitation requires local access to a managed workstation', target: 'could expose customer records.', replacement: 'could expose customer records, but exploitation requires local access to a managed workstation.',
      reason: 'The draft leaves out the access an attacker would need. Without that condition, the risk reads as less restricted than the source describes.' },
    { id: 'status', axis: 'Fidelity', dim: 'D4', title: 'Correct the current status',
      source: 'There is no evidence of exploitation. The issue remains unpatched.', target: 'The issue has been fixed.', replacement: 'The issue remains unpatched. There is no evidence of exploitation.',
      reason: 'A planned fix is not a completed fix. Preserve the open status and distinguish possible access from evidence that an attack happened.' },
    { id: 'action', axis: 'Decision utility', dim: 'D7', title: 'State the next step',
      source: 'The application team plans to deploy a fix by Friday.', target: '', replacement: 'The application team plans to deploy a fix by Friday.',
      reason: 'The source names a team, an action, and a date. Bringing them into the briefing tells the board what happens next without inventing a commitment.' }
  ];
  var names = {
    id_parity: ['Check the missing identifiers', 'These source identifiers do not appear in the draft. Consider whether this reader needs them or an explicit explanation of their omission.'],
    numeric_parity: ['Check the missing figures', 'The browser check could not find these source figures in the draft. Check whether they are material for this reader.'],
    entity_check: ['Check the technical details', 'Some hosts, versions, or other technical details differ between the two texts. Review the evidence before changing the draft.'],
    severity_drift: ['Check the severity wording', 'The severity signal in the draft is lower than the source, or is absent. Check the wording in context.'],
    claim_inflation: ['Check the certainty of this claim', 'The source describes a possibility, while the draft appears to assert an outcome. This is a rule-based signal to review.'],
    caveat_parity: ['Check the missing condition', 'The browser check found no close wording for this condition. A paraphrase may still preserve it.'],
    status_drift: ['Check the current status', 'The wording may change whether the issue is open, resolved, or known to have been exploited.'],
    negation_flip: ['Check what is known', 'The source reports no evidence of exploitation, but the draft appears to say an attack occurred.']
  };
  function prepared() { return mode === 'example' && text(source).trim() === sampleSource && audience.value === 'board'; }
  function collect() {
    var s = text(source), d = text(draft);
    if (!s.trim() || !d.trim()) return [];
    if (prepared()) return examples.filter(function (item) {
      return !dismissed.has(item.id) && (item.target ? d.indexOf(item.target) >= 0 : d.indexOf(item.replacement) < 0);
    });
    return LegibleJudge.run(s, d).flags.map(function (flag, i) {
      var title = names[flag.check];
      var evidence = flag.evidence.join(' · ');
      return { id: flag.check + '-' + i, axis: 'Fidelity', dim: LegibleJudge.DIM[flag.check], title: title[0], reason: title[1], source: '', target: '', evidence: evidence,
        spans: flag.evidence.map(function (e) { return e.replace(/^(?:source hedge|source|translation):\s*/, ''); }) };
    }).filter(function (item) { return !dismissed.has(item.id); });
  }
  function render() {
    current = collect();
    if (!current.some(function (i) { return i.id === active; })) active = current.length ? current[0].id : '';
    label.textContent = prepared() ? 'Interactive preview · example feedback' : 'Browser checks · no model call';
    var f = current.filter(function (i) { return i.axis === 'Fidelity'; }).length;
    counts.innerHTML = '<span><b>' + f + '</b> fidelity</span><span>' + (prepared() ? '<b>' + (current.length - f) + '</b> decision utility' : 'Decision utility: not examined') + '</span>';
    if (!text(source).trim() || !text(draft).trim()) {
      feedback.innerHTML = '<p class="review-empty">Add a source finding and a draft to compare them.</p>';
      return;
    }
    if (!current.length) {
      feedback.innerHTML = '<p class="review-empty">' + (prepared() ? 'No example suggestions remain. Read the revised draft alongside the source.' : 'No concerns detected by the browser checks.') + '</p><p class="review-notice">' + (dismissed.size ? dismissed.size + ' dismissed. ' : '') + 'This does not establish that the draft is complete or correct.</p>';
      return;
    }
    feedback.innerHTML = current.map(function (item, index) {
      var open = item.id === active;
      return '<article class="suggestion"><button type="button" class="suggestion-heading" data-open="' + escape(item.id) + '" aria-expanded="' + open + '" aria-controls="detail-' + escape(item.id) + '"><span class="issue-number">' + String(index + 1).padStart(2, '0') + '</span><strong>' + escape(item.title) + '</strong><span class="expand-symbol" aria-hidden="true">' + (open ? '−' : '+') + '</span></button><p class="suggestion-kind">' + escape(item.axis) + ' · ' + escape(item.dim) + (prepared() ? ' · example' : ' · browser check') + '</p><div class="suggestion-details" id="detail-' + escape(item.id) + '"' + (open ? '' : ' hidden') + '><p>' + escape(item.reason) + '</p><span class="evidence-label">' + (prepared() ? 'IN THE SOURCE' : 'CHECK EVIDENCE') + '</span><blockquote>' + escape(item.source || item.evidence) + '</blockquote>' + (item.replacement ? '<span class="evidence-label">SUGGESTED WORDING</span><p>' + escape(item.replacement) + '</p>' : '') + '<div class="suggestion-actions">' + (item.replacement ? '<button type="button" class="apply-suggestion" data-apply="' + escape(item.id) + '">Apply suggestion</button>' : '') + '<button type="button" data-dismiss="' + escape(item.id) + '">Dismiss</button></div></div></article>';
    }).join('') + (dismissed.size ? '<p class="review-notice">' + dismissed.size + ' dismissed; dismissal does not resolve a concern.</p>' : '');
  }
  // Mark only literal spans, serialize all prose as text, never as supplied HTML.
  function marked(value, ranges) {
    var cursor = 0, out = '';
    ranges.sort(function (a, b) { return a.start - b.start || b.end - a.end; }).forEach(function (r) {
      if (r.start < cursor) return;
      out += escape(value.slice(cursor, r.start)) + (r.active ? '<mark>' : '<span class="draft-issue">') + escape(value.slice(r.start, r.end)) + (r.active ? '</mark>' : '</span>');
      cursor = r.end;
    });
    return out + escape(value.slice(cursor));
  }
  function highlight() {
    var s = text(source), d = text(draft), sr = [], dr = [];
    function add(ranges, value, needle, selected) { var start = needle ? value.indexOf(needle) : -1; if (start >= 0) ranges.push({ start: start, end: start + needle.length, active: selected }); }
    current.forEach(function (item) {
      var selected = item.id === active;
      if (selected) add(sr, s, item.source, true);
      add(dr, d, item.target, selected);
      if (selected && item.spans) item.spans.forEach(function (span) { add(sr, s, span, true); add(dr, d, span, true); });
    });
    source.innerHTML = marked(s, sr); draft.innerHTML = marked(d, dr);
    source.classList.remove('is-editing'); draft.classList.remove('is-editing');
  }
  feedback.addEventListener('click', function (event) {
    var button = event.target.closest('button'); if (!button) return;
    clearTimeout(timer);
    var id = button.dataset.open || button.dataset.apply || button.dataset.dismiss;
    var item = current.find(function (i) { return i.id === id; }); if (!item) return;
    if (button.dataset.open) {
      active = active === id ? '' : id;
      // An empty active id represents an intentionally collapsed list.
      var chosen = active; render(); active = chosen;
      if (!chosen) { feedback.querySelectorAll('.suggestion-heading').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); b.querySelector('.expand-symbol').textContent = '+'; }); feedback.querySelectorAll('.suggestion-details').forEach(function (el) { el.hidden = true; }); }
      highlight();
      feedback.querySelector('[data-open="' + id + '"]').focus({ preventScroll: true });
      return;
    }
    if (button.dataset.apply && prepared()) {
      var value = text(draft);
      if (item.target && value.indexOf(item.target) < 0) { render(); return; }
      draft.textContent = item.target ? value.replace(item.target, item.replacement) : value.trimEnd() + ' ' + item.replacement;
      status.textContent = 'Applied: ' + item.title + '.';
    } else if (button.dataset.dismiss) {
      dismissed.add(id); status.textContent = 'Dismissed: ' + item.title + '. The draft was not changed.';
    }
    render(); highlight();
    var next = feedback.querySelector('.suggestion-heading');
    if (next) next.focus({ preventScroll: true }); else draft.focus({ preventScroll: true });
  });
  [source, draft].forEach(function (el) {
    el.addEventListener('input', function (event) {
      if (event.isComposing) return;
      source.classList.add('is-editing'); draft.classList.add('is-editing');
      dismissed.clear(); status.textContent = ''; clearTimeout(timer); timer = setTimeout(render, 180);
    });
    el.addEventListener('compositionend', function () { dismissed.clear(); clearTimeout(timer); timer = setTimeout(render, 180); });
  });
  root.querySelectorAll('[data-mode]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (mode === button.dataset.mode) return;
      clearTimeout(timer);
      saved[mode] = { source: text(source), draft: text(draft), audience: audience.value };
      mode = button.dataset.mode;
      source.textContent = saved[mode].source; draft.textContent = saved[mode].draft; audience.value = saved[mode].audience;
      root.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
      root.querySelector('#review-reset').hidden = mode !== 'example';
      root.querySelector('#source-provenance').textContent = mode === 'example' ? 'Illustrative finding · written for this demo' : 'Paste the original technical finding';
      dismissed.clear(); active = 'scope'; status.textContent = ''; render(); highlight();
    });
  });
  root.querySelector('#review-reset').addEventListener('click', function () {
    clearTimeout(timer); source.textContent = sampleSource; draft.textContent = sampleDraft; audience.value = 'board'; dismissed.clear(); active = 'scope'; status.textContent = 'Example restored.'; render(); highlight();
  });
  audience.addEventListener('change', function () { dismissed.clear(); status.textContent = 'Audience updated. The browser checks compare facts; they do not assess suitability for this reader.'; render(); highlight(); });
  source.textContent = sampleSource; draft.textContent = sampleDraft; render(); highlight();
})();
