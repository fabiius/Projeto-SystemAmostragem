(() => {
  'use strict';
  let client, daily = [];
  const db = () => {
    const config = window.APP_CONFIG || {};
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || config.SUPABASE_URL.includes('COLE_AQUI')) throw new Error('A conexão com o banco não foi configurada.');
    if (!window.supabase) throw new Error('Não foi possível carregar a conexão. Verifique sua internet e tente novamente.');
    return client || (client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY));
  };
  const unwrap = response => { if (response.error) throw response.error; return response.data; };
  window.SamplingService = {
    async session() { return unwrap(await db().auth.getSession()).session; },
    async profile(userId) { return unwrap(await db().from('profiles').select('display_name,role').eq('id', userId).single()); },
    async list() {
      // Pagination avoids silently truncating dashboards at Supabase's row limit.
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const page = unwrap(await db().from('sample_records').select('*').order('id').range(offset, offset + 499));
        rows.push(...page);
        if (page.length < 500) {
          daily = [];
          for (let start = 0; ; start += 500) {
            const result = await db().from('daily_records').select('*').order('id').range(start,start+499);
            if (result.error) throw new Error('A atualização do histórico diário ainda não foi aplicada. Execute ATUALIZACAO-DIARIA-V2.sql no Supabase.');
            if(result.data.some(d=>d.base_added==null))throw new Error('Execute BASE-DIARIA-V3.sql no Supabase antes de usar esta atualização.');
            daily.push(...result.data);
            if (result.data.length < 500) break;
          }
          return rows;
        }
      }
    },
    filterRecords(rows, coordinator, from, to) {
      if (!from && !to) return rows.filter(r => !coordinator || r.coordinator === coordinator);
      return rows.filter(r => !coordinator || r.coordinator === coordinator).flatMap(r => {
        const items = daily.filter(d => String(d.record_id) === String(r.id) && (!from || d.record_date >= from) && (!to || d.record_date <= to));
        if (!items.length) return [];
        const result = {...r,total_base:daily.filter(d=>String(d.record_id)===String(r.id)&&(!to||d.record_date<=to)).reduce((n,d)=>n+Number(d.base_added),0)};
        ['confirmed','not_confirmed','does_not_know','mailbox','number_not_exists','not_voting'].forEach(k => result[k] = items.reduce((n,d) => n + Number(d[k]),0));
        return [result];
      });
    },
    async save(id, values) {
      const payload = Object.fromEntries(['coordinator','leader','total_base','confirmed','not_confirmed','does_not_know','mailbox','record_date'].filter(k => values[k] !== undefined).map(k => [k,values[k]]));
      return unwrap(await db().rpc('save_sampling_base_v2',{p_id:id,p_values:payload}));
    },
    async remove(id) {
      const rows = unwrap(await db().from('sample_records').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('O registro não foi excluído. Confira sua permissão e atualize os dados.');
    },
    async signOut() { unwrap(await db().auth.signOut()); }
  };
})();
