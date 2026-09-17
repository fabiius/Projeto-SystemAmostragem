(() => {
  'use strict';
  const M = window.SamplingMetrics;
  const rows = records => records.map(record => {
    const total = M.summarize([record]);
    return { 'Coordenador':record.coordinator || '', 'Líder':record.leader || '', 'Cadastrados no Sistema':total.total_base, 'Ligações atendidas':total.contacted, 'Confirmados':total.confirmed, 'Não confirmados':total.not_confirmed, 'Não conhece':total.does_not_know, 'Caixa postal':total.mailbox, 'Número Não Existe':total.number_not_exists, 'Não vai votar':total.not_voting, 'Cobertura':M.percent(total.coverage), '% Confirmação':M.percent(total.confirmation), 'Pendentes':total.pending };
  });
  const download = (content, name, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const xmlEscape = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[character]));
  function exportReport(kind, filtered, all) {
    const stamp = M.localDay(new Date());
    if (kind === 'json') return download(JSON.stringify(all, null, 2), `backup_amostragem_${stamp}.json`, 'application/json;charset=utf-8');
    if (kind === 'xml') {
      const xml = filtered.map(record => {
        const total = M.summarize([record]);
        const values = { id:record.id, coordenador:record.coordinator, lider:record.leader, cadastrados_no_sistema:total.total_base, ligacoes_atendidas:total.contacted, confirmado:total.confirmed, nao_confirmados:total.not_confirmed, nao_conhece:total.does_not_know, caixa_postal:total.mailbox, numero_nao_existe:total.number_not_exists, nao_vai_votar:total.not_voting, cobertura:total.coverage, taxa_confirmacao:total.confirmation, pendentes:total.pending };
        return '<item>' + Object.entries(values).map(([key, value]) => `<${key}>${xmlEscape(value)}</${key}>`).join('') + '</item>';
      }).join('\n');
      return download(`<?xml version="1.0" encoding="UTF-8"?>\n<relatorio_qualidade>\n${xml}\n</relatorio_qualidade>`, `relatorio_qualidade_${stamp}.xml`, 'application/xml;charset=utf-8');
    }
    if (!window.XLSX) throw new Error('A biblioteca de Excel não carregou. Verifique sua conexão e tente novamente.');
    const workbook = XLSX.utils.book_new();
    if (kind === 'daily') {
      const total = M.summarize(all);
      const summary = { 'Data do relatório':new Date().toLocaleDateString('pt-BR'), 'Escopo':'Retrato de toda a base no momento da exportação', 'Cadastrados no Sistema':total.total_base, 'Ligações atendidas':total.contacted, 'Cobertura':M.percent(total.coverage), 'Confirmados':total.confirmed, 'Taxa de confirmação':M.percent(total.confirmation), 'Pendentes':total.pending };
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(Object.entries(summary).map(([metric, value]) => ({ 'Métrica':metric, 'Valor':value }))), 'Resumo Executivo');
    }
    const sheet = XLSX.utils.json_to_sheet(rows(kind === 'daily' ? all : filtered), { header:['Coordenador','Líder','Cadastrados no Sistema','Ligações atendidas','Confirmados','Não confirmados','Não conhece','Caixa postal','Número Não Existe','Não vai votar','Cobertura','% Confirmação','Pendentes'] });
    sheet['!cols'] = Array.from({ length:13 }, () => ({ wch:20 }));
    XLSX.utils.book_append_sheet(workbook, sheet, 'Matriz Qualidade');
    XLSX.writeFile(workbook, `${kind === 'daily' ? 'resumo_diario_qualidade' : 'qualidade_matriz'}_${stamp}.xlsx`);
  }
  window.SamplingExports = { exportReport, rows };
})();
