(function(root){
'use strict';
const fields=['confirmed','not_confirmed','does_not_know','mailbox'];
const entryFields=['base_added',...fields];
const sumBase=rows=>rows.reduce((n,r)=>n+num(r.base_added),0);
const num=v=>Number(v)||0;
const contacted=r=>['confirmed','not_confirmed','does_not_know'].reduce((n,k)=>n+num(r[k]),0);
const processed=r=>contacted(r)+num(r.mailbox);
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const dateLabel=d=>d?d.split('-').reverse().join('/'):'Sem limite';
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function stats(base,rows){const t={total_base:base,...Object.fromEntries(fields.map(k=>[k,rows.reduce((n,r)=>n+num(r[k]),0)]))};t.contacted=contacted(t);t.pending=base-t.contacted;t.coverage=base?t.contacted/base*100:0;t.confirmation=t.contacted?t.confirmed/t.contacted*100:0;return t;}
function report(bases,entries,options={}){
 const {from='',to='',coordinator='',recordId=''}=options;
 if(from&&!validDate(from)||to&&!validDate(to))throw new Error('Informe datas válidas.');
 if(from&&to&&from>to)throw new Error('A data inicial não pode ser posterior à data final.');
 const selected=bases.filter(b=>(!coordinator||b.coordinator===coordinator)&&(!recordId||String(b.id)===String(recordId)));
 const ids=new Set(selected.map(b=>String(b.id)));
 const history=entries.filter(e=>ids.has(String(e.record_id))&&(!to||e.record_date<=to));
 const rows=history.filter(e=>!from||e.record_date>=from);
 const base=sumBase(history),baseAdded=sumBase(rows);
 const total=stats(base,rows),end=stats(base,history);
 const days=new Map();
 rows.forEach(e=>{if(!days.has(e.record_date))days.set(e.record_date,[]);days.get(e.record_date).push(e);});
 let running=contacted(stats(0,history.filter(e=>from&&e.record_date<from)));
 let runningBase=sumBase(history.filter(e=>from&&e.record_date<from));
 let runningConfirmed=history.filter(e=>from&&e.record_date<from).reduce((n,e)=>n+num(e.confirmed),0);
 const daily=[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,list])=>{const t=stats(sumBase(list),list);runningBase+=sumBase(list);running+=t.contacted;runningConfirmed+=t.confirmed;return {...t,date,base_added:sumBase(list),accumulatedBase:runningBase,accumulated:running,accumulatedConfirmed:runningConfirmed};});
 const leaders=selected.map(b=>({...b,...stats(sumBase(history.filter(e=>String(e.record_id)===String(b.id))),rows.filter(e=>String(e.record_id)===String(b.id)))})).sort((a,b)=>b.confirmed-a.confirmed||b.contacted-a.contacted||a.leader.localeCompare(b.leader,'pt-BR'));
 const coordinators=[...new Set(selected.map(b=>b.coordinator))].map(name=>({coordinator:name,...stats(sumBase(history.filter(e=>selected.find(b=>String(b.id)===String(e.record_id))?.coordinator===name)),rows.filter(e=>selected.find(b=>String(b.id)===String(e.record_id))?.coordinator===name))})).sort((a,b)=>b.confirmed-a.confirmed);
 return {rows,total,end,daily,leaders,coordinators,base,baseAdded,from,to,label:!from&&!to?'Todo o período':from&&to?dateLabel(from)+' a '+dateLabel(to):from?'A partir de '+dateLabel(from):'Até '+dateLabel(to),scopeDetail:'Coordenador: '+(coordinator||'todos')+' • Líder: '+(recordId?(selected[0]?.leader||'nenhum'):'todos')};
}
function validateEntry(value,base,entries,editingId){
 if(!validDate(value.record_date)||value.record_date>today())return 'Informe uma data válida, até hoje.';
 for(const k of entryFields)if(!Number.isSafeInteger(Number(value[k]))||Number(value[k])<0||Number(value[k])>2147483647)return 'Use números inteiros não negativos.';
 const previous=entries.filter(e=>String(e.record_id)===String(base.id)&&String(e.id)!==String(editingId));
 const days=new Map();for(const e of [...previous,value])days.set(e.record_date,(days.get(e.record_date)||0)+num(e.base_added)-processed(e));
 let balance=0;for(const [,delta] of [...days].sort(([a],[b])=>a.localeCompare(b))){balance+=delta;if(balance<0)return 'Os contatos ultrapassam a base acumulada em uma das datas.';}
 if(sumBase([...previous,value])>2147483647)return 'A base acumulada ultrapassa o limite suportado.';
 return '';
}
const api={fields,entryFields,sumBase,num,contacted,processed,today,dateLabel,validDate,stats,report,validateEntry};root.DailyModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
