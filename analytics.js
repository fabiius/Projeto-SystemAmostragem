(() => {
  'use strict';
  const M = window.SamplingMetrics, C = window.SamplingComponents, service = window.SamplingService;
  const $ = selector => document.querySelector(selector);
  const labels = { coordinator:'Coordenador', leader:'Líder', total_base:'Total da base', confirmed:'Confirmados', not_confirmed:'Não confirmados', does_not_know:'Não conhece', mailbox:'Caixa postal', number_not_exists:'Número Não Existe', not_voting:'Não vai votar' };
  let records = [], visible = [], admin = false, ready = false, editingId = null, performanceCoordinator = '', busy = false;
  function message(text, kind = '') { $('#message').textContent = text; $('#message').className = `notice ${kind}`; $('#message').hidden = !text; }
  function icons() { window.lucide?.createIcons(); }
  function render() {
    const from = $('#from').value, to = $('#to').value;
    if (from && to && from > to) { message('A data inicial não pode ser posterior à data final.', 'error'); return; }
    visible = service.filterRecords(records, $('#coordinator').value, from, to);
    const total = M.summarize(visible), leaders = M.group(visible, ['coordinator', 'leader']), groups = M.group(visible, ['coordinator']);
    const invalid = visible.filter(row => M.validate(row)).length;
    $('#dashboard').hidden = false;
    C.kpis(total); C.funnel(total); C.matrix(visible, total, admin); C.performance(groups, performanceCoordinator); C.ranking(leaders);
    const chartsAvailable = C.charts(leaders, total, invalid > 0);
    const warnings = [];
    if (invalid) warnings.push(`${invalid} registro(s) com valores inconsistentes, destacados na tabela. Corrija em Ações → Editar. Os totais exibem os valores originais.`);
    if (!chartsAvailable) warnings.push('Os gráficos não carregaram. Os valores continuam disponíveis na tabela e nas listas. Atualize a página para tentar novamente.');
    message(warnings.join(' '), warnings.length ? 'error' : '');
    icons();
    window.SamplingReportCenter?.update();
  }
  function filterOptions() {
    const selected = $('#coordinator').value;
    const names = [...new Set(records.map(record => record.coordinator).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pt-BR'));
    $('#coordinator').innerHTML = '<option value="">Todos os coordenadores</option>' + names.map(name => `<option value="${C.esc(name)}">${C.esc(name)}</option>`).join('');
    $('#coordinator').value = names.includes(selected) ? selected : '';
  }
  async function load() {
    $('#refresh').disabled = true;
    try { records = await service.list(); filterOptions(); render(); ready = true; $('#add').disabled = false; }
    catch (error) { message(`Não foi possível carregar os registros: ${error.message}. Use Atualizar dados para tentar novamente.`, 'error'); }
    finally { $('#refresh').disabled = false; }
  }
  function openEditor(record) {
    if (!ready || busy) return;
    editingId = record?.id ?? null;
    $('#dialog-title').textContent = record ? 'Editar registro' : 'Adicionar registro';
    $('#form-fields').innerHTML = Object.entries(labels).filter(([field]) => !record || ['coordinator','leader'].includes(field)).map(([field, label]) => `<label>${field === 'total_base' ? 'Base adicionada no dia' : label}<input name="${field}" ${M.numericFields.includes(field) ? 'type="number" min="0" max="2147483647" step="1"' : 'type="text" maxlength="200"'} required value="${C.esc(record?.[field] ?? (M.numericFields.includes(field) ? 0 : field === 'coordinator' ? $('#coordinator').value : ''))}"></label>`).join('');
    $('#form-fields').insertAdjacentHTML('afterbegin', record ? '<p class="subtitle" style="grid-column:1/-1">Edite os nomes. Para corrigir a base ou a produção por data, use Registros diários.</p>' : '<p class="subtitle" style="grid-column:1/-1">Informe a base adicionada nesta data. Ela será somada à base anterior do mesmo coordenador e líder. Use zero se não houver novas pessoas.</p><label style="grid-column:1/-1">Data do registro<input type="date" name="record_date" required value="' + M.localDay(new Date()) + '"></label>');
    $('#form-error').textContent = '';
    $('#record-dialog').showModal();
  }
  function details(record) {
    const total = M.summarize([record]);
    const formattedDate = value => { const date = new Date(value); return !value || Number.isNaN(date.getTime()) ? 'Não informada' : date.toLocaleString('pt-BR'); };
    const entries = { ...Object.fromEntries(Object.entries(labels).map(([field, label]) => [label, record[field]])), 'Ligações atendidas':total.contacted, 'Cobertura':M.percent(total.coverage), 'Taxa de confirmação':M.percent(total.confirmation), 'Pendentes':total.pending, 'Diferença dos resultados':total.difference, 'Criado em':formattedDate(record.created_at), 'Atualizado em':formattedDate(record.updated_at) };
    $('#details-content').innerHTML = Object.entries(entries).map(([label,value]) => `<dt>${C.esc(label)}</dt><dd>${C.esc(value)}</dd>`).join('');
    $('#details-dialog').showModal();
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const data = {...(records.find(r => r.id === editingId) || {}), ...Object.fromEntries(new FormData(event.target))};
    Object.keys(labels).forEach(field => { data[field] = M.numericFields.includes(field) ? Number(data[field]) : data[field].trim(); });
    const existing = editingId == null ? records.find(r => r.coordinator.trim().toLowerCase() === data.coordinator.toLowerCase() && r.leader.trim().toLowerCase() === data.leader.toLowerCase()) : null;
    const candidate = existing ? {...data,...Object.fromEntries(M.numericFields.map(k=>[k,Number(data[k])+Number(existing[k])]))} : data;
    const invalidNumber = M.numericFields.some(k=>!Number.isSafeInteger(data[k])||data[k]<0||data[k]>2147483647);
    const validation = (invalidNumber ? 'Use números inteiros não negativos.' : M.validate(candidate)) || (!data.coordinator || !data.leader ? 'Preencha coordenador e líder.' : '');
    if (validation) { $('#form-error').textContent = validation; return; }
    busy = true; $('#save-record').disabled = true; $('#cancel-dialog').disabled = true; $('#close-dialog').disabled = true;
    try {
      const saved = await service.save(editingId, data);
      const index = records.findIndex(record => record.id === saved.id);
      if (index < 0) records.push(saved); else records[index] = saved;
      $('#record-dialog').close(); await load();
      const isVisible = visible.some(record => record.id === saved.id);
      if (!visible.some(record => M.validate(record))) message(isVisible ? 'Registro salvo com sucesso.' : 'Registro salvo. Ele está fora dos filtros atuais; limpe os filtros para vê-lo.', 'success');
    } catch (error) { $('#form-error').textContent = `Não foi possível salvar: ${error.message}`; }
    finally { busy = false; $('#save-record').disabled = false; $('#cancel-dialog').disabled = false; $('#close-dialog').disabled = false; }
  }
  $('#record-form').addEventListener('submit', save);
  $('#record-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  $('#close-dialog').onclick = $('#cancel-dialog').onclick = () => { if (!busy) $('#record-dialog').close(); };
  $('#close-details').onclick = () => $('#details-dialog').close();
  $('#add').onclick = () => openEditor();
  $('#filters').addEventListener('submit', event => event.preventDefault());
  $('#filters').addEventListener('change', () => { if (ready) render(); });
  $('#clear').onclick = () => { $('#from').value = ''; $('#to').value = ''; $('#coordinator').value = ''; performanceCoordinator = ''; if (ready) render(); };
  $('#refresh').onclick = async () => { if (ready) await load(); else await start(); };
  $('#coordinator-performance').addEventListener('change', event => { if (event.target.id === 'performance-select') { performanceCoordinator = event.target.value; C.performance(M.group(visible, ['coordinator']), performanceCoordinator); } });
  $('#rows').addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button || busy) return;
    const record = records.find(row => String(row.id) === button.dataset.id); if (!record) return;
    button.closest('details').open = false;
    if (button.dataset.action === 'details') return details(record);
    if (button.dataset.action === 'edit') return openEditor(record);
    if (!admin || !confirm(`Excluir o registro de ${record.leader} (${record.coordinator})? Esta ação não pode ser desfeita.`)) return;
    busy = true; button.disabled = true;
    try { await service.remove(record.id); records = records.filter(row => row.id !== record.id); filterOptions(); render(); }
    catch (error) { message(`Não foi possível excluir: ${error.message}`, 'error'); }
    finally { busy = false; button.disabled = false; }
  });
  document.querySelectorAll('[data-export]').forEach(button => { button.onclick = () => {
    try {
      if ($('#from').value && $('#to').value && $('#from').value > $('#to').value) throw new Error('Corrija o período antes de exportar.');
      window.SamplingExports.exportReport(button.dataset.export, visible, records);
    } catch (error) { message(error.message, 'error'); }
  }; });
  $('#logout').onclick = async () => {
    try { await service.signOut(); location.replace('login.html'); }
    catch (error) { message(`Não foi possível sair: ${error.message}`, 'error'); }
  };
  async function start() {
    $('#refresh').disabled = true;
    try {
      const session = await service.session(); if (!session) { location.replace('login.html'); return; }
      const profile = await service.profile(session.user.id); admin = profile.role === 'admin';
      $('#user-name').textContent = profile.display_name || 'Usuário';
      $('#role-badge').textContent = admin ? 'Administrador' : 'Usuário';
      $('#avatar').textContent = (profile.display_name || 'U').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
      await load();
      if (new URLSearchParams(location.search).get('novo') === '1') openEditor();
    } catch (error) { message(`Não foi possível abrir o painel: ${error.message}. Use Atualizar dados para tentar novamente.`, 'error'); }
    finally { $('#refresh').disabled = false; icons(); }
  }
  window.SamplingReportCenter?.mount(() => ({records,visible,coordinator:$('#coordinator').value,from:$('#from').value,to:$('#to').value}));
  start();
})();
