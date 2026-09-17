(() => {
  'use strict';
  const M=window.SamplingMetrics;
  const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const col=n=>{let name='';for(n++;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
  const pct=n=>({v:n/100,s:3});
  const fields=t=>[t.total_base,t.contacted,t.confirmed,t.not_confirmed,t.does_not_know,t.mailbox,t.number_not_exists,t.not_voting,pct(t.coverage),pct(t.confirmation),t.pending];
  const headings=['Cadastrados no Sistema','Ligações atendidas','Confirmados','Não confirmados','Não conhece','Caixa postal','Número Não Existe','Não vai votar','Cobertura','Confirmação','Pendentes'];
  function makeSheets(r) {
    const common=[['Gerado em',r.timestamp],['Escopo',r.scope],['Filtros',r.scopeDetail],['Período',r.timeRule],['Rankings',r.rankRule],['Inconsistências',r.warning||'Nenhuma detectada.'],['Gráficos','Imagens incorporadas: não editáveis. Dados completos nas outras abas.'],['Cobertura','Ligações atendidas / cadastrados no sistema.'],['Confirmação','Confirmados / ligações atendidas.'],['Ligações atendidas','Confirmados + não confirmados + não conhece. Caixa postal, Número Não Existe e Não vai votar ficam separados.'],['Pendentes','Cadastrados no Sistema - ligações atendidas.'],['Armazenamento','Download local; nenhum relatório gravado no banco.']];
    for(let i=0;i<r.notes.length;i+=250)common.push([i?'Observações (continuação)':'Observações',r.notes.slice(i,i+250)]);
    return [
      {name:'Resumo executivo',headers:['Indicador','Valor'],widths:[28,28,22,22,22,22],rows:[['Cadastrados no Sistema',r.total.total_base],['Ligações atendidas',r.total.contacted],['Cobertura',pct(r.total.coverage)],['Confirmados',r.total.confirmed],['Taxa de confirmação',pct(r.total.confirmation)],['Pendentes',r.total.pending],['Registros',r.data.length],['Registros inconsistentes',r.invalid.length]],images:true},
      {name:'Coordenadores',headers:['Coordenador',...headings],widths:[32,...Array(9).fill(18)],rows:r.coordinators.map(t=>[t.coordinator||'Sem coordenador',...fields(t)]),total:['Consolidado',...fields(r.total)]},
      {name:'Líderes',headers:['Coordenador','Líder',...headings],widths:[30,30,...Array(9).fill(18)],rows:r.leaders.map(t=>[t.coordinator||'Sem coordenador',t.leader||'Sem líder',...fields(t)]),total:['Consolidado','',...fields(r.total)]},
      {name:'Rankings',headers:['Grupo','Critério','Posição','Coordenador','Líder',...headings],widths:[20,26,12,30,30,...Array(11).fill(18)],rows:r.rankings.flatMap(rank=>rank.rows.map((t,i)=>[rank.kind,rank.title,i+1,t.coordinator||'Sem coordenador',t.leader||'',...fields(t)]))},
      {name:'Matriz completa',headers:['ID','Coordenador','Líder',...headings,'Atualização','Validação'],widths:[12,30,30,...Array(11).fill(18),28,60],rows:r.data.map(row=>[String(row.id??''),row.coordinator||'',row.leader||'',...fields(M.summarize([row])),row.updated_at||row.created_at||'',M.validate(row)||'OK']),total:['','Consolidado','',...fields(r.total),'','']},
      {name:'Critérios e filtros',headers:['Item','Descrição'],widths:[30,110],rows:common}
    ];
  }
  const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/><color rgb="FF20344F"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="20"/><name val="Calibri"/><color rgb="FF17375E"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF194B86"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF1FA"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const cell=(value,row,column,style)=>{
    const item=value&&typeof value==='object'?value:{v:value};
    const s=style??item.s??(typeof item.v==='number'?4:0);
    const reference=col(column)+row;
    return typeof item.v==='number' && Number.isFinite(item.v) ? `<c r="${reference}" s="${s}"><v>${item.v}</v></c>` : `<c r="${reference}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(item.v)}</t></is></c>`;
  };
  async function build(report,charts) {
    if(!window.JSZip)throw new Error('O gerador de Excel não carregou. Atualize a página.');
    const zip=new window.JSZip(), sheets=report.sheets || makeSheets(report);
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const relns='http://schemas.openxmlformats.org/package/2006/relationships';
    const office='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    zip.file('_rels/.rels',`<Relationships xmlns="${relns}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="${office}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<Relationships xmlns="${relns}">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${office}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${office}/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',styles);
    sheets.forEach((sheet,index)=>{
      const lastCol=col(sheet.widths.length-1),rows=[];
      const row=(values,n,height,style)=>`<row r="${n}" ht="${height}" customHeight="1">${values.map((v,c)=>cell(v,n,c,style)).join('')}</row>`;
      rows.push(row([sheet.name],1,34,2),row([`${report.scope} | ${report.scopeDetail}`],2,42),row([`Gerado: ${report.timestamp} | ${report.data.length} registros. ${report.warning}`],3,42),row(sheet.headers,5,34,1));
      sheet.rows.forEach((values,i)=>rows.push(row(values,i+6,sheet.name==='Critérios e filtros'?Math.max(34,Math.ceil(String(values[1]).length/100)*16+12):Math.max(30,...values.map((v,c)=>Math.ceil(String(v?.v??v??'').length/(sheet.widths[c]||20))*15+8)))));
      if(!sheet.rows.length)rows.push(row(['Nenhum registro elegível.'],6,30));
      if(sheet.total)rows.push(`<row r="${sheet.rows.length+7}" ht="30" customHeight="1">${sheet.total.map((v,c)=>cell(v,sheet.rows.length+7,c,v&&typeof v==='object'&&v.s===3?6:5)).join('')}</row>`);
      const imageStart=sheet.rows.length+10;
      if(sheet.images)for(let n=imageStart;n<=imageStart+Object.keys(charts).length*25;n++)rows.push(row(n===imageStart?['Gráficos incorporados como imagens; não editáveis.']:[],n,20));
      const lastRow=sheet.images?sheet.rows.length+12+Object.keys(charts).length*25:sheet.rows.length+7;
      zip.file(`xl/worksheets/sheet${index+1}.xml`,`<worksheet xmlns="${ns}" xmlns:r="${office}"><dimension ref="A1:${lastCol}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${sheet.widths.map((width,c)=>`<col min="${c+1}" max="${c+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData>${sheet.rows.length?`<autoFilter ref="A5:${col(sheet.headers.length-1)}${sheet.rows.length+5}"/>`:''}<mergeCells count="3"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/><mergeCell ref="A3:${lastCol}3"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>${sheet.images?'<drawing r:id="rId1"/>':''}</worksheet>`);
    });
    const chartNames=Object.keys(charts);
    chartNames.forEach((name,i)=>zip.file(`xl/media/image${i+1}.png`,charts[name].split(',')[1],{base64:true}));
    zip.file('xl/worksheets/_rels/sheet1.xml.rels',`<Relationships xmlns="${relns}"><Relationship Id="rId1" Type="${office}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
    zip.file('xl/drawings/_rels/drawing1.xml.rels',`<Relationships xmlns="${relns}">${chartNames.map((n,i)=>`<Relationship Id="rId${i+1}" Type="${office}/image" Target="../media/image${i+1}.png"/>`).join('')}</Relationships>`);
    zip.file('xl/drawings/drawing1.xml',`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${office}">${chartNames.map((name,i)=>`<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${sheets[0].rows.length+12+i*25}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="8191500" cy="3978911"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+1}" name="${name}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="8191500" cy="3978911"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join('')}</xdr:wsDr>`);
    zip.file('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
  window.SamplingReportExcel={build,makeSheets};
})();
