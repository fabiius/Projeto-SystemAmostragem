(() => {
'use strict';
const A=window.AppLayout,M=window.DailyModel,D=window.DailyData,$=s=>document.querySelector(s);
let base=[],daily=[],snapshot=null,running=false;
const options=()=>Object.fromEntries([...document.querySelectorAll('[data-option]')].map(el=>[el.dataset.option,el.checked]));
function leaders(){const saved=$('#leader').value;const list=base.filter(b=>!$('#coordinator').value||b.coordinator===$('#coordinator').value);$('#leader').innerHTML='<option value="">Todos os líderes</option>'+list.map(b=>'<option value="'+b.id+'">'+A.esc(b.leader)+' ('+A.esc(b.coordinator)+')</option>').join('');if(list.some(b=>String(b.id)===saved))$('#leader').value=saved;}
function makeChart(title,labels,sets,line=false){
 const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=440;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1100,440);ctx.font='bold 19px Arial';ctx.fillStyle='#20344f';ctx.fillText(title,24,30);
 sets.forEach((set,i)=>{ctx.fillStyle=set.color;ctx.fillRect(24+i*255,49,12,12);ctx.fillStyle='#52657b';ctx.font='14px Arial';ctx.fillText(set.name,45+i*255,61);});
 if(!labels.length){ctx.fillText('Nenhum lançamento no período.',30,120);return canvas;}
 const left=75,right=1060,top=95,bottom=345,max=Math.max(1,...sets.flatMap(s=>s.values))*1.1;
 for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;ctx.strokeStyle='#e5ebf3';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#64758b';ctx.font='12px Arial';ctx.textAlign='right';ctx.fillText(A.integer(Math.round(max*i/4)),left-10,y+4);}
 const step=(right-left)/labels.length;
 sets.forEach((set,si)=>{ctx.fillStyle=set.color;ctx.strokeStyle=set.color;ctx.lineWidth=3;if(line)ctx.beginPath();set.values.forEach((value,i)=>{const x=left+step*(i+.5),y=bottom-(value/max)*(bottom-top);if(line){if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}else{const w=Math.min(40,step*.7/sets.length);ctx.fillRect(x+(si-sets.length/2)*w,y,Math.max(1,w-2),bottom-y);}});if(line){ctx.stroke();set.values.forEach((value,i)=>{ctx.beginPath();ctx.arc(left+step*(i+.5),bottom-(value/max)*(bottom-top),3,0,Math.PI*2);ctx.fill();});}});
 ctx.fillStyle='#52657b';ctx.font='12px Arial';ctx.textAlign='center';const every=Math.max(1,Math.ceil(labels.length/12));labels.forEach((label,i)=>{if(i%every===0||i===labels.length-1){ctx.save();ctx.translate(left+step*(i+.5),bottom+22);ctx.rotate(-.22);ctx.fillText(String(label).slice(0,24),0,0);ctx.restore();}});ctx.textAlign='left';
 return canvas;
}
function build(){
 const opt=options(),r=M.report(base,daily,{from:$('#from').value,to:$('#to').value,coordinator:$('#coordinator').value,recordId:$('#leader').value});
 const sections=[],charts={};let serial=0;
 const table=(title,headers,rows)=>sections.push({type:'table',title,headers,rows});
 const text=(title,value)=>sections.push({type:'text',title,text:value});
 const chart=(title,labels,sets,line=false)=>{const canvas=makeChart(title,labels,sets,line),key='chart'+(++serial);charts[key]=canvas.toDataURL('image/png');sections.push({type:'chart',title,key,canvas});};
 const summary=[];
 if(opt.base)summary.push(['Base adicionada no período',r.baseAdded],['Base acumulada até a data final',r.base]);
 if(opt.contacted)summary.push(['Contatados no período',r.total.contacted]);
 if(opt.confirmed)summary.push(['Confirmados no período',r.total.confirmed]);
 if(opt.pending)summary.push(['Pendentes ao final',r.end.pending]);
 if(opt.rates)summary.push(['Cobertura acumulada até a data final',A.percent(r.end.coverage)],['Taxa de confirmação no período',A.percent(r.total.confirmation)]);
 if(opt.summary)table('Resumo de indicadores',['Indicador','Valor'],summary);
 const selectedColumns=[];
 if(opt.base)selectedColumns.push(['Base acumulada','total_base']);
 if(opt.contacted)selectedColumns.push(['Contatados no período','contacted']);
 if(opt.confirmed)selectedColumns.push(['Confirmados no período','confirmed']);
 if(opt.rates)selectedColumns.push(['Confirmação no período','confirmation']);
 const cells=row=>selectedColumns.map(([,key])=>key==='confirmation'?A.percent(row[key]):row[key]);
 if(opt.daily)table('Produção por data',['Data',...(opt.base?['Base no dia','Base acumulada']:[]),...(opt.contacted?['Contatados']:[]),...(opt.confirmed?['Confirmados']:[]),...(opt.rates?['Confirmação']:[])],r.daily.map(d=>[M.dateLabel(d.date),...(opt.base?[d.base_added,d.accumulatedBase]:[]),...(opt.contacted?[d.contacted]:[]),...(opt.confirmed?[d.confirmed]:[]),...(opt.rates?[A.percent(d.confirmation)]:[])]));
 if(opt.bars)chart('Produção por dia',r.daily.map(d=>M.dateLabel(d.date)),[...(opt.base?[{name:'Base adicionada',values:r.daily.map(d=>d.base_added),color:'#9660cf'}]:[]),...(opt.contacted?[{name:'Contatados',values:r.daily.map(d=>d.contacted),color:'#1260ed'}]:[]),...(opt.confirmed?[{name:'Confirmados',values:r.daily.map(d=>d.confirmed),color:'#159861'}]:[])]);
 if(opt.accumulated)chart('Evolução acumulada até cada data',r.daily.map(d=>M.dateLabel(d.date)),[...(opt.base?[{name:'Base acumulada',values:r.daily.map(d=>d.accumulatedBase),color:'#9660cf'}]:[]),...(opt.contacted?[{name:'Contatados acumulados',values:r.daily.map(d=>d.accumulated),color:'#1260ed'}]:[]),...(opt.confirmed?[{name:'Confirmados acumulados',values:r.daily.map(d=>d.accumulatedConfirmed),color:'#159861'}]:[])],true);
 const rankRows=list=>list.filter(r=>r.contacted>0).map((r,i)=>[i+1,r.coordinator,...(r.leader!==undefined?[r.leader]:[]),...cells(r)]);
 if(opt.ranking)table('Ranking de líderes',['Posição','Coordenador','Líder',...selectedColumns.map(c=>c[0])],rankRows(r.leaders));
 if(opt.coordinators)table('Ranking de coordenadores',['Posição','Coordenador',...selectedColumns.map(c=>c[0])],rankRows(r.coordinators));
 if(opt.leaderChart)chart('Comparativo por líder — até 10 participantes',r.leaders.filter(d=>d.contacted>0).slice(0,10).map(d=>d.leader),[...(opt.contacted?[{name:'Contatados',values:r.leaders.filter(d=>d.contacted>0).slice(0,10).map(d=>d.contacted),color:'#1260ed'}]:[]),...(opt.confirmed?[{name:'Confirmados',values:r.leaders.filter(d=>d.contacted>0).slice(0,10).map(d=>d.confirmed),color:'#159861'}]:[])]);
 if(opt.details)table('Lançamentos detalhados',['Data','Coordenador','Líder',...(opt.base?['Base adicionada']:[]),...(opt.contacted?['Contatados']:[]),...(opt.confirmed?['Confirmados']:[])],r.rows.map(d=>[M.dateLabel(d.record_date),d.coordinator,d.leader,...(opt.base?[d.base_added]:[]),...(opt.contacted?[M.contacted(d)]:[]),...(opt.confirmed?[d.confirmed]:[])]));
 if(opt.notes&&$('#notes').value.trim())text('Observações para a equipe',$('#notes').value.trim());
 if(!sections.length)text('Sem seções selecionadas','Selecione as informações que deseja incluir no relatório.');
 const rule='Produção filtrada pela data do lançamento. A base adicionada em cada data soma-se ao histórico. A base anterior à atualização foi preservada no primeiro lançamento. Pendentes e cobertura consideram todo o histórico até a data final. Caixa postal não entra em Contatados, Cobertura ou Taxa de confirmação. Confirmação = confirmados / contatados no período. Rankings por confirmados, com desempate por contatados e nome.';
 return {...r,sections,charts,generated:new Date(),rule};
}
function render(){
 try{snapshot=build();$('#period-label').textContent=snapshot.label+' • '+snapshot.scopeDetail;const container=$('#report-content');container.replaceChildren();
 for(const s of snapshot.sections){const section=document.createElement('section');section.className='report-section';const heading=document.createElement('h3');heading.textContent=s.title;if(s.type!=='chart')section.append(heading);if(s.type==='chart')section.append(s.canvas);else if(s.type==='text'){const p=document.createElement('p');p.textContent=s.text;section.append(p);}else if(s.title==='Resumo de indicadores'){const cards=document.createElement('div');cards.className='report-kpis';cards.innerHTML=s.rows.map(([label,value])=>'<article class="kpi"><div class="kpi-heading">'+A.esc(label)+'</div><div class="kpi-value">'+A.esc(typeof value==='number'?A.integer(value):value)+'</div></article>').join('');section.append(cards);}else{const scroll=document.createElement('div');scroll.className='table-scroll';scroll.innerHTML='<table><thead><tr>'+s.headers.map(h=>'<th>'+A.esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(s.rows.length?s.rows.map(row=>'<tr>'+row.map(v=>'<td>'+A.esc(typeof v==='number'?A.integer(v):v)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+s.headers.length+'">Nenhum lançamento no período.</td></tr>')+'</tbody></table>';section.append(scroll);}container.append(section);}
 const note=document.createElement('p');note.className='subtitle';note.textContent=snapshot.rule;container.append(note);$('#status').textContent='';return snapshot;
 }catch(e){snapshot=null;$('#report-content').replaceChildren();$('#status').textContent=e.message;return null;}
}
function quick(kind){
 document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===kind)));
 if(kind==='custom'){$('#from').focus();return;}
 const end=new Date(),start=new Date();const local=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 if(kind==='yesterday'){end.setDate(end.getDate()-1);start.setDate(start.getDate()-1);}
 if(kind==='5days')start.setDate(start.getDate()-4);
 if(kind==='week')start.setDate(start.getDate()-((start.getDay()+6)%7));
 if(kind==='month')start.setDate(1);
 $('#from').value=kind==='all'?'':local(start);$('#to').value=kind==='all'?'':local(end);render();
}
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function generate(kind){
 if(running)return;const r=render();if(!r)return;running=true;document.querySelectorAll('.export-buttons button').forEach(b=>b.disabled=true);$('#status').textContent='Preparando arquivo…';
 try{
 if(kind==='copy'){const text=window.DailyExports.summary(r);$('#copy-text').value=text;$('#copy-text').hidden=false;try{await navigator.clipboard.writeText(text);$('#status').textContent='Resumo copiado.';}catch{$('#status').textContent='Selecione e copie o resumo abaixo.';}return;}
 if(kind==='backup'){download(JSON.stringify({exported_at:new Date().toISOString(),sample_records:base,daily_records:daily},null,2),'Backup_integral_'+M.today()+'.json','application/json');}
 else {const bytes=kind==='pdf'?await window.DailyExports.pdf(r):await window.DailyExports.excel(r);download(bytes,'Relatorio_'+(r.from||'inicio')+'_a_'+(r.to||M.today())+(kind==='pdf'?'.pdf':'.xlsx'),kind==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
 $('#status').textContent='Arquivo gerado para download com o conteúdo selecionado.';
 }catch(e){$('#status').textContent='Não foi possível gerar: '+e.message;}finally{running=false;document.querySelectorAll('.export-buttons button').forEach(b=>b.disabled=false);}
}
(async()=>{try{if(!await A.setup())return;({base,daily}=await D.load());$('#coordinator').innerHTML+=[...new Set(base.map(b=>b.coordinator))].sort().map(n=>'<option>'+A.esc(n)+'</option>').join('');leaders();$('#coordinator').onchange=()=>{leaders();render();};document.querySelectorAll('input,textarea,#leader').forEach(el=>el.addEventListener('input',render));document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>quick(b.dataset.period));for(const kind of ['pdf','excel','copy','backup'])$('#'+kind).onclick=()=>generate(kind);$('#notice').hidden=true;$('#content').hidden=false;quick('5days');}catch(e){$('#notice').textContent=e.message;$('#notice').className='notice error';}})();
})();
