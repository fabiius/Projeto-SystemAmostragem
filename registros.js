(() => {
'use strict';
const A=window.AppLayout,D=window.DailyData,M=window.DailyModel,$=s=>document.querySelector(s);
let base=[],daily=[],editing=null,admin=false,busy=false;
const form=$('#entry-form');
function current(){return base.find(b=>String(b.id)===$('#leader').value);}
function payload(){return {record_id:Number($('#leader').value),record_date:form.elements.record_date.value,...Object.fromEntries(M.entryFields.map(k=>[k,Number(form.elements[k].value)])),notes:form.elements.notes.value.trim()};}
function projection(){
 const b=current();if(!b){$('#base-note').textContent='Cadastre um novo líder / base para começar.';$('#projection').innerHTML='';$('#save').disabled=true;return;}
 $('#save').disabled=busy;
 const list=daily.filter(d=>String(d.record_id)===String(b.id)),before=M.stats(Number(b.total_base),list);
 const updated=[...list.filter(d=>String(d.id)!==String(editing)),payload()];
 const after=M.stats(M.sumBase(updated),updated);
 $('#base-note').textContent='Base cadastrada: '+A.integer(b.total_base)+' pessoas • '+A.integer(before.pending)+' ainda por ligar';
 $('#projection').innerHTML=[['Cadastrados no Sistema',before.total_base,after.total_base],['Ligações atendidas',before.contacted,after.contacted],['Confirmados',before.confirmed,after.confirmed],['Pendentes',before.pending,after.pending],['Diferença dos resultados',before.difference,after.difference],['Cobertura',A.percent(before.coverage),A.percent(after.coverage)],['Taxa de confirmação',A.percent(before.confirmation),A.percent(after.confirmation)]].map(([label,a,b])=>'<div class="projection-row"><span>'+label+'</span><b>'+a+'</b><span>→</span><strong>'+b+'</strong></div>').join('');
}
function history(){
 const rows=daily.filter(d=>String(d.record_id)===$('#leader').value).sort((a,b)=>a.record_date.localeCompare(b.record_date)||a.id-b.id);
 let sum=0,baseSum=0;const withTotal=rows.map(r=>({...r,sum:sum+=M.contacted(r),baseSum:baseSum+=M.num(r.base_added),processed:M.processed(r)}));
 $('#history').innerHTML=withTotal.reverse().map(r=>'<tr><td>'+M.dateLabel(r.record_date)+'</td><td>'+A.integer(r.base_added)+'</td><td>'+A.integer(r.baseSum)+'</td><td>'+A.integer(M.contacted(r))+'</td><td>'+A.integer(r.confirmed)+'</td><td>'+A.integer(r.not_confirmed)+'</td><td>'+A.integer(r.does_not_know)+'</td><td>'+A.integer(r.mailbox)+'</td><td>'+A.integer(r.number_not_exists)+'</td><td>'+A.integer(r.not_voting)+'</td><td>'+A.integer(r.base_added-r.processed)+'</td><td>'+A.esc(r.notes||'—')+'</td><td><button class="secondary" data-edit="'+r.id+'">Editar</button> '+(admin?'<button class="secondary" data-delete="'+r.id+'">Excluir</button>':'')+'</td></tr>').join('')||'<tr><td colspan="13" class="empty">Nenhum lançamento para esta base.</td></tr>';
}
function reset(){
 editing=null;M.entryFields.forEach(k=>form.elements[k].value=0);form.elements.notes.value='';form.elements.record_date.value=M.today();form.elements.record_date.max=M.today();
 $('#entry-title').textContent='Produção do dia';$('#cancel-edit').hidden=true;$('#coordinator').disabled=false;$('#leader').disabled=false;$('#save').textContent='Salvar lançamento';projection();history();
}
function leaders(selected){
 const rows=base.filter(b=>b.coordinator===$('#coordinator').value);
 $('#leader').innerHTML=rows.map(b=>'<option value="'+b.id+'">'+A.esc(b.leader)+' • base '+A.integer(b.total_base)+'</option>').join('');
 if(rows.some(b=>String(b.id)===String(selected)))$('#leader').value=String(selected);
 reset();
}
async function load(){
 const c=$('#coordinator').value,l=$('#leader').value;
 ({base,daily}=await D.load());
 const names=[...new Set(base.map(b=>b.coordinator))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 $('#coordinator').innerHTML=names.map(n=>'<option>'+A.esc(n)+'</option>').join('');
 if(names.includes(c))$('#coordinator').value=c;leaders(l);
}
form.addEventListener('input',projection);
$('#coordinator').onchange=()=>leaders();
$('#leader').onchange=reset;$('#cancel-edit').onclick=reset;
$('#refresh').onclick=async()=>{try{await load();}catch(e){$('#form-error').textContent=e.message;}};
form.onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 const b=current();if(!b)return;
 const value=payload(),error=M.validateEntry(value,b,daily,editing);
 if(error){$('#form-error').className='form-error';$('#form-error').textContent=error;return;}
 busy=true;$('#save').disabled=true;
 try{await D.saveDaily(editing,value);await load();$('#form-error').className='success-message';$('#form-error').textContent='Lançamento salvo no Supabase. O acumulado foi atualizado.';}
 catch(e){$('#form-error').className='form-error';$('#form-error').textContent='Não foi possível salvar: '+e.message;}
 finally{busy=false;projection();}
};
$('#history').onclick=async event=>{
 const edit=event.target.closest('[data-edit]'),del=event.target.closest('[data-delete]');if(busy||(!edit&&!del))return;
 const id=(edit||del).dataset[edit?'edit':'delete'],row=daily.find(d=>String(d.id)===id);
 if(!row)return;
 if(edit){editing=row.id;M.entryFields.forEach(k=>form.elements[k].value=row[k]);form.elements.notes.value=row.notes||'';form.elements.record_date.value=row.record_date;$('#entry-title').textContent='Editar lançamento de '+M.dateLabel(row.record_date);$('#cancel-edit').hidden=false;$('#coordinator').disabled=true;$('#leader').disabled=true;$('#save').textContent='Salvar correção';projection();form.scrollIntoView({behavior:'smooth'});return;}
 if(!admin||!confirm('Excluir o lançamento de '+M.dateLabel(row.record_date)+'? O acumulado será recalculado.'))return;
 busy=true;try{await D.removeDaily(row.id);await load();}catch(e){$('#form-error').textContent=e.message;}finally{busy=false;projection();}
};
(async()=>{try{const profile=await A.setup();if(!profile)return;admin=profile.role==='admin';await load();$('#notice').hidden=true;$('#content').hidden=false;}catch(e){$('#notice').textContent=e.message;$('#notice').className='notice error';}})();
})();
