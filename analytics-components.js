(() => {
  'use strict';
  const M = window.SamplingMetrics;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  const progress = value => `<div class="progress" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>`;
  const kpi = (label, value, description, icon, color = '', bar) => `<article class="kpi ${color}"><div class="kpi-heading"><span class="kpi-icon"><i data-lucide="${icon}"></i></span>${label}</div><div class="kpi-value">${value}</div><small>${description}</small>${bar == null ? '' : progress(bar)}</article>`;
  function kpis(total) {
    document.querySelector('#kpis').innerHTML = [
      kpi('Base total', M.integer(total.total_base), 'Pessoas na amostra', 'database'),
      kpi('Ligações atendidas', M.integer(total.contacted), `${M.percent(total.coverage)} da base`, 'send', '', total.coverage),
      kpi('Cobertura da amostra', M.percent(total.coverage), `${M.integer(total.contacted)} de ${M.integer(total.total_base)} pessoas`, 'users'),
      kpi('Confirmados', M.integer(total.confirmed), `${M.percent(M.calculatePercentage(total.confirmed, total.total_base))} da base`, 'circle-check', 'green'),
      kpi('Taxa de confirmação', M.percent(total.confirmation), `${M.integer(total.confirmed)} de ${M.integer(total.contacted)} ligações atendidas`, 'chart-column', '', total.confirmation),
      kpi('Pendentes', M.integer(total.pending), `${M.percent(M.calculatePercentage(total.pending, total.total_base))} da base`, 'clock', 'amber')
    ].join('');
  }
  function funnel(total) {
    document.querySelector('#funnel').innerHTML = [[total.total_base, 'Cadastrados no Sistema'], [total.contacted, 'Ligações atendidas'], [total.confirmed, 'Confirmados']].map(([value, label]) => `<div class="funnel-step"><strong>${M.integer(value)}</strong><span>${label}</span><small>${M.percent(M.calculatePercentage(value, total.total_base))} da base</small></div>`).join('');
  }
  function matrix(rows, total, admin) {
    document.querySelector('#record-count').textContent = `${rows.length} registro(s)`;
    const cells = value => `<td>${M.integer(value.total_base)}</td><td>${M.integer(value.contacted)}</td><td>${M.integer(value.confirmed)}</td><td>${M.integer(value.not_confirmed)}</td><td>${M.integer(value.does_not_know)}</td><td>${M.integer(value.mailbox)}</td><td>${M.integer(value.number_not_exists)}</td><td>${M.integer(value.not_voting)}</td><td class="coverage">${M.percent(value.coverage)}</td><td class="confirmation">${M.percent(value.confirmation)}</td>`;
    document.querySelector('#rows').innerHTML = rows.map(row => `<tr${M.validate(row) ? ' class="row-invalid"' : ''}><td>${esc(row.coordinator || 'Sem coordenador')}</td><td>${esc(row.leader || 'Sem líder')}</td>${cells(M.summarize([row]))}<td><details class="actions"><summary aria-label="Ações para ${esc(row.leader || 'registro')}">⋯</summary><div class="action-menu"><button data-action="details" data-id="${esc(row.id)}">Visualizar detalhes</button><button data-action="edit" data-id="${esc(row.id)}">Editar</button>${admin ? `<button class="danger" data-action="delete" data-id="${esc(row.id)}">Excluir</button>` : ''}</div></details></td></tr>`).join('') || '<tr><td colspan="13" class="empty">Nenhum registro encontrado. Ajuste os filtros ou adicione um registro.</td></tr>';
    document.querySelector('#totals').innerHTML = `<tr><td colspan="2">Consolidado</td>${cells(total)}<td>—</td></tr>`;
  }
  function performance(groups, selected) {
    const container = document.querySelector('#coordinator-performance');
    if (!groups.length) { container.innerHTML = '<p class="empty">Nenhum coordenador neste período.</p>'; return; }
    const chosen = groups.find(group => group.coordinator === selected) || groups[0];
    const leaders = M.group(chosen.rows, ['coordinator', 'leader']);
    container.innerHTML = `<div class="coordinator-layout"><div class="gauge"><div class="ring" style="--angle:${Math.max(0, Math.min(100, chosen.confirmation)) * 3.6}deg"><strong>${M.percent(chosen.confirmation)}</strong></div><b>Taxa de confirmação</b><small>${M.integer(chosen.confirmed)} de ${M.integer(chosen.contacted)} contatados</small></div><div class="performance-list"><label class="sr-only" for="performance-select">Coordenador em destaque</label><select id="performance-select">${groups.map(group => `<option value="${esc(group.coordinator)}"${group === chosen ? ' selected' : ''}>${esc(group.coordinator || 'Sem coordenador')} · ${M.percent(group.confirmation)}</option>`).join('')}</select><p class="subtitle">${leaders.length} líder(es) na equipe · ordem por confirmação</p><div class="performance-leaders">${leaders.map(leader => `<div class="leader-line"><span>${esc(leader.leader || 'Sem líder')}</span><strong>${M.percent(leader.confirmation)}</strong></div>${progress(leader.confirmation)}`).join('')}</div></div></div>`;
  }
  function ranking(leaders) {
    document.querySelector('#ranking').innerHTML = leaders.map((leader, index) => `<div class="rank-item"><span class="rank-number">${index + 1}º</span><span class="rank-avatar" aria-hidden="true">${esc((leader.leader || '?').slice(0, 1).toUpperCase())}</span><div><div class="rank-name"><span>${esc(leader.leader || 'Sem líder')}</span><strong>${M.percent(leader.confirmation)}</strong></div><small>${esc(leader.coordinator || 'Sem coordenador')}</small>${progress(leader.confirmation)}</div></div>`).join('') || '<p class="empty">Nenhum líder neste período.</p>';
  }
  let confirmationChart, statusChart;
  const colors = ['#2ab17d', '#e4545e', '#f5be36', '#8754db', '#ee6b4d', '#4b72c2', '#9ca8b9'];
  function charts(leaders, total, invalid) {
    const labels = ['Confirmados', 'Não confirmados', 'Não conhece', 'Cx. postal', 'Número Não Existe', 'Não vai votar', 'Pendentes'];
    const values = [total.confirmed, total.not_confirmed, total.does_not_know, total.mailbox, total.number_not_exists, total.not_voting, total.pending];
    document.querySelector('#status-total').textContent = `Total da amostra: ${M.integer(total.total_base)} pessoas`;
    document.querySelector('#status-legend').innerHTML = labels.map((label, index) => `<div class="legend-line"><span class="dot" style="background:${colors[index]}" aria-hidden="true"></span><span>${label}</span><strong>${M.integer(values[index])}</strong><em>${M.percent(M.calculatePercentage(values[index], total.total_base))}</em></div>`).join('');
    if (!window.Chart) return false;
    const chartLabels = leaders.map(leader => `${leader.leader || 'Sem líder'} (${leader.coordinator || 'Sem coordenador'})`);
    if (confirmationChart) { confirmationChart.data.labels = chartLabels; confirmationChart.data.datasets[0].data = leaders.map(leader => leader.confirmation); confirmationChart.update('none'); }
    else confirmationChart = new Chart(document.querySelector('#confirmation-chart'), {
      type:'bar',
      data:{ labels:chartLabels, datasets:[{ label:'Taxa de confirmação', data:leaders.map(leader => leader.confirmation), backgroundColor:'#1762ed', borderRadius:5 }] },
      options:{
        responsive:true, maintainAspectRatio:false, animation:false,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:context => M.percent(context.parsed.y) } } },
        scales:{ y:{ min:0, max:100, ticks:{ callback:value => `${value}%` } }, x:{ grid:{ display:false }, ticks:{ maxRotation:45, font:{ size:10 } } } }
      }
    });
    // Inconsistent legacy records stay visible but must not produce a misleading donut.
    document.querySelector('#status-chart').hidden = invalid || total.total_base === 0;
    document.querySelector('#status-chart').parentElement.querySelector('.empty')?.remove();
    if (invalid || total.total_base === 0) {
      const message = document.createElement('p'); message.className = 'empty'; message.textContent = invalid ? 'Corrija os registros inconsistentes para exibir a distribuição.' : 'Sem base para distribuir.';
      document.querySelector('#status-chart').parentElement.append(message);
    }
    if (statusChart) { statusChart.data.datasets[0].data = invalid ? [] : values; statusChart.update('none'); }
    else statusChart = new Chart(document.querySelector('#status-chart'), { type:'doughnut', data:{ labels, datasets:[{ data:invalid ? [] : values, backgroundColor:colors, borderWidth:2, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, animation:false, cutout:'70%', plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:context => `${context.label}: ${M.integer(context.parsed)} (${M.percent(M.calculatePercentage(context.parsed, total.total_base))})` } } } } });
    return true;
  }
  window.SamplingComponents = { esc, kpis, funnel, matrix, performance, ranking, charts };
})();
