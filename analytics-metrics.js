(function (root) {
  'use strict';
  const numericFields = ['total_base', 'confirmed', 'not_confirmed', 'does_not_know', 'mailbox', 'number_not_exists', 'not_voting'];
  const number = value => Number(value) || 0;
  const calculatePercentage = (value, total) => total > 0 ? value / total * 100 : 0;
  const calculateCoverage = (totalBase, contacted) => calculatePercentage(contacted, totalBase);
  const calculateConfirmationRate = (contacted, confirmed) => calculatePercentage(confirmed, contacted);
  const calculatePending = (totalBase, contacted) => totalBase - contacted;
  const contacted = row => ['confirmed', 'not_confirmed', 'does_not_know'].reduce((sum, field) => sum + number(row[field]), 0);
  const processed = row => contacted(row) + number(row.mailbox) + number(row.number_not_exists) + number(row.not_voting);
  const summarize = rows => {
    const total = Object.fromEntries(numericFields.map(field => [field, 0]));
    rows.forEach(row => numericFields.forEach(field => { total[field] += number(row[field]); }));
    total.contacted = contacted(total);
    total.coverage = calculateCoverage(total.total_base, total.contacted);
    total.confirmation = calculateConfirmationRate(total.contacted, total.confirmed);
    total.pending = calculatePending(total.total_base, total.contacted);
    return total;
  };
  const validate = row => {
    for (const field of numericFields) {
      if (!Number.isSafeInteger(Number(row[field])) || Number(row[field]) < 0 || Number(row[field]) > 2147483647) return 'Use números inteiros entre 0 e 2.147.483.647.';
    }
    if (processed(row) > Number(row.total_base)) return 'A soma dos resultados de contato não pode ultrapassar o total da base.';
    return '';
  };
  const localDay = value => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const filter = (rows, coordinator, from, to) => rows.filter(row => {
    const date = localDay(row.updated_at || row.created_at);
    return (!coordinator || row.coordinator === coordinator) && (!(from || to) || (date && (!from || date >= from) && (!to || date <= to)));
  });
  const group = (rows, fields) => {
    const groups = new Map();
    rows.forEach(row => {
      const key = JSON.stringify(fields.map(field => row[field] || ''));
      if (!groups.has(key)) groups.set(key, { ...Object.fromEntries(fields.map(field => [field, row[field] || ''])), rows: [] });
      groups.get(key).rows.push(row);
    });
    return [...groups.values()].map(entry => ({ ...entry, ...summarize(entry.rows) }))
      .sort((a, b) => b.confirmation - a.confirmation || b.contacted - a.contacted || String(a.leader || a.coordinator).localeCompare(String(b.leader || b.coordinator), 'pt-BR'));
  };
  const percent = value => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + '%';
  const integer = value => new Intl.NumberFormat('pt-BR').format(value);
  const api = { numericFields, calculatePercentage, calculateCoverage, calculateConfirmationRate, calculatePending, contacted, processed, summarize, validate, filter, group, percent, integer, localDay };
  root.SamplingMetrics = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
