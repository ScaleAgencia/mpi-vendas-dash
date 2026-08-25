/* MPI — dashboard de vendas · render puro (sem libs, SVG na mão) sobre window.MPI */
(function(){
'use strict';
var D = window.MPI || {};
var arr = function(x){ return Array.isArray(x) ? x : (x ? [x] : []); };
var clamp = function(x){ return Math.max(0, Math.min(1, x)); };
var nf0 = new Intl.NumberFormat('pt-BR');
var nf1 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
var nf2 = new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
var money = function(v){ return 'R$ ' + nf2.format(v||0); };
var money0 = function(v){ return 'R$ ' + nf0.format(Math.round(v||0)); };
var intf = function(v){ return nf0.format(Math.round(v||0)); };
var pct = function(v){ return nf1.format(v||0) + '%'; };
var roasf = function(v){ return nf2.format(v||0); };
var dv = function(a,b){ return b>0 ? a/b : 0; };
function fmtBR(iso){ if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; var p=iso.split('-'); return p[2]+'/'+p[1]; }
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function isDate(x){ return /^\d{4}-\d{2}-\d{2}$/.test(x); }

var COL={grn:'#23c286',grn2:'#5fe3b0',gold:'#e8b64a',gold2:'#f6d582',meta:'#5b9dff',goog:'#f4a93b'};

/* ---------- prepara cada origem (resolve grain interned) ---------- */
function prep(S){
  S = S || {}; S.daily = arr(S.daily);
  var names = arr(S.names);
  S._grain = arr(S.grain).map(function(g){
    return { date:g.d, campaign:names[g.c]||'', adset:names[g.s]||'', ad:names[g.a]||'',
      spend:+g.sp||0, spendRaw:+g.spr||0, impr:+g.im||0, clicks:+g.ck||0, lpv:+g.lp||0,
      checkout:+g.chk||0, sales:+g.vn||0, rev:+g.rv||0, gross:+g.gr||0 }; });
  return S;
}
var META = prep(D.meta), GOOG = prep(D.google);
var OB = arr(D.ob && D.ob.daily);
var OB_LABELS={combo3:'Combo 3 em 1',exterior:'Investimentos no Exterior',cripto:'Criptomoedas',planilhas:'Planilhas complementares MPI'};
var OB_ORDER=['combo3','exterior','cripto','planilhas'];

/* ---------- período global ---------- */
function boundsOf(){
  var ds=[];
  [META,GOOG].forEach(function(S){ S.daily.forEach(function(d){ if(isDate(d.date))ds.push(d.date); }); });
  ds.sort(); return [ds[0]||'', ds[ds.length-1]||''];
}
var B=boundsOf(), minDate=B[0], maxDate=B[1];
function addDays(iso,n){ var p=iso.split('-'); var dt=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])); dt.setUTCDate(dt.getUTCDate()+n); return dt.toISOString().slice(0,10); }
function daysBetween(a,b){ var pa=a.split('-'),pb=b.split('-'); return Math.round((Date.UTC(+pb[0],+pb[1]-1,+pb[2])-Date.UTC(+pa[0],+pa[1]-1,+pa[2]))/86400000); }
function inRange(dt,r){ return dt>=r[0] && dt<=r[1]; }
var PRESETS=[{k:'hoje',label:'Hoje'},{k:'ontem',label:'Ontem'},{k:'mes',label:'Este mês'},{k:'7d',label:'7 dias'},{k:'30d',label:'30 dias'},{k:'90d',label:'90 dias'},{k:'tudo',label:'Tudo'}];
var period='tudo', customRange=null;
function rangeFor(k){
  if(k==='custom'&&customRange) return customRange;
  if(k==='tudo') return [minDate,maxDate];
  if(k==='hoje') return [maxDate,maxDate];
  if(k==='ontem'){ var y=addDays(maxDate,-1); return [y,y]; }
  if(k==='mes')  return [maxDate.slice(0,7)+'-01', maxDate];   // do dia 1 do mes atual ate a ultima data
  if(k==='7d')  return [addDays(maxDate,-6),maxDate];
  if(k==='30d') return [addDays(maxDate,-29),maxDate];
  if(k==='90d') return [addDays(maxDate,-89),maxDate];
  return [minDate,maxDate];
}
function prevRange(rng){ var len=daysBetween(rng[0],rng[1])+1; var pe=addDays(rng[0],-1); return [addDays(pe,-(len-1)),pe]; }

var METS=['spend','spendRaw','impr','clicks','lpv','checkout','sales','rev','gross'];
function aggDaily(S,rng){ var o={}; METS.forEach(function(k){o[k]=0;});
  S.daily.forEach(function(d){ if(!inRange(d.date,rng))return; METS.forEach(function(k){o[k]+=(d[k]||0);}); }); return o; }
function daysInRange(S,rng){ return S.daily.filter(function(d){return isDate(d.date)&&inRange(d.date,rng);}).sort(function(a,b){return a.date.localeCompare(b.date);}); }
function median(xs){ var a=xs.filter(function(x){return x!=null&&isFinite(x);}).sort(function(x,y){return x-y;}); if(!a.length)return 0; var m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
/* CAC: menor melhor (verde). ROAS: maior melhor (verde). vs mediana */
function cacClass(v,med){ if(v==null||!isFinite(v)||v<=0||med<=0)return 'cac-n'; var r=v/med; if(r<=0.85)return 'cac-g'; if(r<=1.3)return 'cac-a'; return 'cac-r'; }
function roasClass(v){ if(v==null||!isFinite(v)||v<=0)return 'roas-n'; if(v>=1)return 'roas-g'; if(v>=0.8)return 'roas-a'; return 'roas-r'; }
function trendHTML(cur,prev,higherBetter){ if(prev==null||!isFinite(prev)||prev===0||!isFinite(cur))return ''; var ch=(cur-prev)/Math.abs(prev)*100; if(Math.abs(ch)<0.1)return '';
  var up=ch>0, good=higherBetter?up:!up; return '<span class="trend '+(good?'up':'down')+'">'+(up?'▲':'▼')+' '+nf1.format(Math.abs(ch))+'%</span>'; }

/* =================================================================
   CONFIG por origem
==================================================================*/
var CFG={
  meta:{ S:META, pfx:'m', label:'Meta Ads', taxed:true, hasLpv:true, hasCheckout:true, midLabel:'Conjunto',
    stages:[{k:'impr',l:'Impressões',cost:'CPM',costfn:function(a){return dv(a.spend,a.impr)*1000;},rate:'CTR',ratefn:function(a){return dv(a.clicks,a.impr);},next:'clicks'},
            {k:'clicks',l:'Cliques',cost:'CPC',costfn:function(a){return dv(a.spend,a.clicks);},rate:'Connect',ratefn:function(a){return dv(a.lpv,a.clicks);},next:'lpv'},
            {k:'lpv',l:'View LP',cost:'Custo/LPV',costfn:function(a){return dv(a.spend,a.lpv);},rate:'Checkout',ratefn:function(a){return dv(a.checkout,a.lpv);},next:'checkout'},
            {k:'checkout',l:'Checkouts',cost:'Custo/Chk',costfn:function(a){return dv(a.spend,a.checkout);},rate:'Compra',ratefn:function(a){return dv(a.sales,a.checkout);},next:'sales'},
            {k:'sales',l:'Vendas',cost:'CAC',costfn:function(a){return dv(a.spend,a.sales);},rate:null}] },
  google:{ S:GOOG, pfx:'g', label:'Google / YouTube', taxed:false, hasLpv:false, hasCheckout:false, midLabel:'Grupo',
    stages:[{k:'impr',l:'Impressões',cost:'CPM',costfn:function(a){return dv(a.spend,a.impr)*1000;},rate:'CTR',ratefn:function(a){return dv(a.clicks,a.impr);},next:'clicks'},
            {k:'clicks',l:'Cliques',cost:'CPC',costfn:function(a){return dv(a.spend,a.clicks);},rate:'Conversão',ratefn:function(a){return dv(a.sales,a.clicks);},next:'sales'},
            {k:'sales',l:'Vendas',cost:'CAC',costfn:function(a){return dv(a.spend,a.sales);},rate:null}] }
};

/* =================== KPI COLUMN =================== */
function subRow(l,v,tr){ return '<div class="sub-row"><span class="s-l">'+l+'</span><span class="s-v">'+v+(tr||'')+'</span></div>'; }
function kpiCard(cls,label,val,subs){ return '<div class="kpi-card'+(cls?' '+cls:'')+'"><div class="kpi-main"><div class="m-lab">'+label+'</div><div class="m-val">'+val+'</div></div><div class="kpi-sub">'+subs+'</div></div>'; }
function renderKpi(cfg,a,p,ob){
  ob=ob||{sales:0,rev:0};
  var roas=dv(a.rev,a.spend), lucro=a.rev-a.spend, cac=dv(a.spend,a.sales), ticket=dv(a.rev,a.sales);
  var fatTotal=a.rev+ob.rev, roasOB=dv(fatTotal,a.spend);
  var taxaCompra = cfg.hasCheckout ? dv(a.sales,a.checkout) : dv(a.sales,a.clicks);
  var taxaLbl = cfg.hasCheckout ? 'Checkout → venda' : 'Clique → venda';
  var hero='<div class="kpi-hero"><div class="h-lab">Investimento'+(cfg.taxed?' com imposto':'')+'</div>'
    +'<div class="h-val">'+money(a.spend)+'</div>'
    +'<div class="h-foot"><span>Gerenciador <b>'+money0(a.spendRaw)+'</b></span>'
    +'<span>'+(cfg.taxed?'imposto <b>+13,85%</b>':'sem imposto')+'</span></div>'
    +goalStrip()+'</div>';
  var subLucro = subRow('Lucro (fat. − invest.)', '<span class="'+(lucro>=0?'pos':'neg')+'">'+money0(lucro)+'</span>', '');
  var cards='';
  cards+=kpiCard('hl','Faturamento',money0(a.rev),
    subLucro + subRow('Ticket médio', a.sales?money(ticket):'—', trendHTML(ticket,dv(p.rev,p.sales),true)));
  cards+=kpiCard('gold','Faturamento Total',money0(fatTotal),
    subRow('Só MPI', money0(a.rev),'')
    + subRow('Order bump', '<b style="color:var(--gold2)">'+money0(ob.rev)+'</b>','')
    + subRow('ROAS c/ OB', '<b>'+roasf(roasOB)+'</b>',''));
  cards+=kpiCard('hl','Vendas',intf(a.sales),
    subRow('CAC', a.sales?money(cac):'—', trendHTML(cac,dv(p.spend,p.sales),false))
    + subRow(taxaLbl, pct(taxaCompra*100), trendHTML(taxaCompra,cfg.hasCheckout?dv(p.sales,p.checkout):dv(p.sales,p.clicks),true)));
  var rc=roasClass(roas), barw=clamp(roas/1.5)*100, barcol=roas>=1?COL.grn:(roas>=0.8?COL.gold:'#f2637e');
  cards+=kpiCard('gold','ROAS'+(cfg.taxed?' c/ imposto':''),roasf(roas),
    subRow('Retorno por R$ 1', 'R$ '+roasf(roas), trendHTML(roas,dv(p.rev,p.spend),true))
    + '<div class="sub-row"><span class="s-l">até o break-even (1,00)</span><span class="s-v">'+(roas>=1?'✓ lucro':pct(roas*100)+' do ponto de equilíbrio')+'</span></div>'
    + '<div class="mini-bar"><span style="width:'+barw.toFixed(0)+'%;background:'+barcol+'"></span></div>');
  el(cfg.pfx+'-kpi').innerHTML=hero+cards;
}

/* =================== FUNNEL =================== */
var FN_W5=[100,85,70,54,40], FN_W3=[100,66,41];
var FN_COL5=['#5fe3b0','#3fd6a3','#23c286','#18ac78','#e8b64a'];
var FN_COL3=['#5fe3b0','#23c286','#e8b64a'];
function renderFunnel(cfg,a,p){
  var stg=cfg.stages, ws=(stg.length===5?FN_W5:FN_W3), cols=(stg.length===5?FN_COL5:FN_COL3);
  var html='<div class="funnel">';
  for(var i=0;i<stg.length;i++){
    var s=stg[i], val=a[s.k]||0, cost=s.costfn(a), pcost=s.costfn(p);
    var costHtml='<div class="fs-v">'+ (s.cost==='CPM'?money(cost):money(cost)) +'</div><div>'+s.cost+' '+trendHTML(cost,pcost,false)+'</div>';
    var rateHtml='';
    if(s.rate){ var rt=s.ratefn(a), prt=s.ratefn(p); rateHtml='<div class="fs-v">'+pct(rt*100)+'</div><div>'+s.rate+' '+trendHTML(rt,prt,true)+'</div>'; }
    html+='<div class="fn-stage">'
      +'<div class="fn-side right">'+costHtml+'</div>'
      +'<div class="fn-bar-wrap"><div class="fn-bar" style="width:'+ws[i]+'%;background:linear-gradient(180deg,'+cols[i]+',rgba(0,0,0,.12))">'
      +'<span class="fn-n">'+intf(val)+'</span><span class="fn-l">'+s.l+'</span></div></div>'
      +'<div class="fn-side">'+rateHtml+'</div></div>';
    if(i<stg.length-1) html+='<div class="fn-rate"><span class="ar">↓</span></div>';
  }
  html+='</div>';
  el(cfg.pfx+'-funnel').innerHTML=html;
}

/* =================== CHARTS =================== */
function xticks(days){ var n=days.length; if(n<=1)return [0]; var step=Math.max(1,Math.round(n/7)); var t=[]; for(var i=0;i<n;i+=step)t.push(i); if(t[t.length-1]!==n-1)t.push(n-1); return t; }
var _tip=null;
function tipEl(){ if(!_tip){ _tip=document.createElement('div'); _tip.className='chart-tip'; _tip.style.display='none'; document.body.appendChild(_tip); } return _tip; }
function tipShow(html,x,y){ var t=tipEl(); t.innerHTML=html; t.style.display='block'; var w=t.offsetWidth,h=t.offsetHeight,nx=x+14,ny=y+14; if(nx+w>window.innerWidth-8)nx=x-w-14; if(ny+h>window.innerHeight-8)ny=y-h-14; t.style.left=Math.max(6,nx)+'px'; t.style.top=Math.max(6,ny)+'px'; }
function tipHide(){ if(_tip)_tip.style.display='none'; }
function hitRects(days,pl,gw,pt,ph){ var s=''; for(var i=0;i<days.length;i++){ s+='<rect class="hit" data-i="'+i+'" x="'+(pl+gw*i).toFixed(1)+'" y="'+pt+'" width="'+gw.toFixed(1)+'" height="'+ph+'" fill="transparent" pointer-events="all"/>'; } return s; }
function bindHits(cid,days,fmt){ var c=el(cid); if(!c)return; Array.prototype.forEach.call(c.querySelectorAll('.hit'),function(r){
  r.addEventListener('mousemove',function(e){ var i=+r.getAttribute('data-i'); if(days[i])tipShow(fmt(days[i]),e.clientX,e.clientY); });
  r.addEventListener('mouseleave',tipHide); }); }
function renderChartSales(cfg,days){
  var W=560,H=200,pl=32,pr=34,pt=12,pb=22,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
  var maxV=Math.max.apply(null,days.map(function(d){return d.sales||0;}).concat([1]));
  var maxR=Math.max.apply(null,days.map(function(d){return d.rev||0;}).concat([1]));
  var n=days.length||1,gw=pw/n,bw=Math.max(2,Math.min(14,gw*0.5));
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#16281f" stroke-dasharray="2 3"/>';
    s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#587567" font-size="9">'+Math.round(maxV*f)+'</text>'; });
  days.forEach(function(d,i){ var xc=pl+gw*i+gw/2, vh=ph*dv(d.sales,maxV); if(d.sales>0) s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-vh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+vh.toFixed(1)+'" rx="1.5" fill="rgba(35,194,134,.55)"/>'; });
  var pts=[]; days.forEach(function(d,i){ var xc=pl+gw*i+gw/2, y=base-ph*dv(d.rev,maxR); pts.push([xc,y]); });
  if(pts.length>1){ s+='<path d="M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L')+'" fill="none" stroke="'+COL.gold+'" stroke-width="2"/>'; }
  xticks(days).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" fill="#587567" font-size="9">'+fmtBR(days[i].date)+'</text>'; });
  s+=hitRects(days,pl,gw,pt,ph)+'</svg>';
  el(cfg.pfx+'-chartSales').innerHTML='<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:rgba(35,194,134,.6)"></span>Vendas</span><span><span class="ln" style="background:'+COL.gold+'"></span>Faturamento</span></div>';
  bindHits(cfg.pfx+'-chartSales',days,function(d){ return '<div class="tt-d">'+fmtBR(d.date)+'</div><div class="tt-r"><span style="color:'+COL.grn2+'">Vendas</span><b>'+intf(d.sales)+'</b></div><div class="tt-r"><span style="color:'+COL.gold2+'">Faturamento</span><b>'+money0(d.rev)+'</b></div><div class="tt-sub">CAC '+(d.sales?money(dv(d.spend,d.sales)):'—')+' · ROAS '+roasf(dv(d.rev,d.spend))+'</div>'; });
}
function renderChartRoas(cfg,days){
  var W=560,H=200,pl=34,pr=30,pt=12,pb=22,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
  var maxS=Math.max.apply(null,days.map(function(d){return d.spend||0;}).concat([1]));
  var roas=days.map(function(d){return dv(d.rev,d.spend);});
  var maxR=Math.max.apply(null,roas.concat([1]));
  var n=days.length||1,gw=pw/n,bw=Math.max(2,Math.min(15,gw*0.55));
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  [0,0.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#16281f" stroke-dasharray="2 3"/>';
    s+='<text x="'+(pl-4)+'" y="'+(y+3)+'" text-anchor="end" fill="#587567" font-size="9">'+Math.round(maxS*f)+'</text>';
    s+='<text x="'+(W-pr+3)+'" y="'+(y+3)+'" text-anchor="start" fill="#c98a2a" font-size="9">'+nf1.format(maxR*f)+'</text>'; });
  // linha break-even ROAS=1
  if(maxR>0){ var y1=base-ph*clamp(1/maxR); s+='<line x1="'+pl+'" y1="'+y1.toFixed(1)+'" x2="'+(W-pr)+'" y2="'+y1.toFixed(1)+'" stroke="rgba(35,194,134,.4)" stroke-dasharray="4 3"/>'; }
  days.forEach(function(d,i){ var xc=pl+gw*i+gw/2, sh=ph*dv(d.spend,maxS); if(d.spend>0) s+='<rect x="'+(xc-bw/2).toFixed(1)+'" y="'+(base-sh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+sh.toFixed(1)+'" rx="1.5" fill="rgba(91,157,255,.32)"/>'; });
  var pts=[]; days.forEach(function(d,i){ if(d.spend>0){ var xc=pl+gw*i+gw/2, y=base-ph*clamp(roas[i]/maxR); pts.push([xc,y]); } });
  if(pts.length>1){ s+='<path d="M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L')+'" fill="none" stroke="'+COL.gold+'" stroke-width="2"/>'; }
  pts.forEach(function(p){ s+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.4" fill="'+COL.gold+'"/>'; });
  xticks(days).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" fill="#587567" font-size="9">'+fmtBR(days[i].date)+'</text>'; });
  s+=hitRects(days,pl,gw,pt,ph)+'</svg>';
  el(cfg.pfx+'-chartRoas').innerHTML='<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:rgba(91,157,255,.6)"></span>Investimento</span><span><span class="ln" style="background:'+COL.gold+'"></span>ROAS</span><span style="color:var(--muted2)">tracejado = break-even</span></div>';
  bindHits(cfg.pfx+'-chartRoas',days,function(d){ return '<div class="tt-d">'+fmtBR(d.date)+'</div><div class="tt-r"><span style="color:'+COL.meta+'">Investimento</span><b>'+money0(d.spend)+'</b></div><div class="tt-r"><span style="color:'+COL.gold2+'">ROAS</span><b>'+roasf(dv(d.rev,d.spend))+'</b></div><div class="tt-sub">Vendas '+intf(d.sales)+' · Fat. '+money0(d.rev)+'</div>'; });
}

/* =================== DAILY TABLE =================== */
function heatBg(rgb,frac){ return 'background:rgba('+rgb+','+(0.10+0.42*clamp(frac)).toFixed(3)+')'; }
function renderDaily(cfg,rng){
  var chk=cfg.hasCheckout;
  var rows=daysInRange(cfg.S,rng).slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  var maxS=Math.max.apply(null,rows.map(function(r){return r.spend||0;}).concat([1]));
  var medCac=median(rows.map(function(r){return r.sales>0?dv(r.spend,r.sales):null;}));
  var chkH=chk?'<th>Tx Chk</th><th>Tx Compra</th>':'';
  var head='<thead><tr><th>Dia</th><th>Investimento</th><th>Vendas</th><th>CAC</th>'+chkH+'<th>Faturamento</th><th>ROAS</th><th>Lucro</th></tr></thead>';
  var body=rows.map(function(r){ var roas=dv(r.rev,r.spend), cac=r.sales>0?dv(r.spend,r.sales):null, lucro=r.rev-r.spend;
    var chkC=chk?('<td class="num">'+(r.lpv>0?pct(dv(r.checkout,r.lpv)*100):'—')+'</td><td class="num">'+(r.checkout>0?pct(dv(r.sales,r.checkout)*100):'—')+'</td>'):'';
    return '<tr><td>'+fmtBR(r.date)+'</td>'
      +'<td class="num"><span class="heatcell" style="'+heatBg('91,157,255',r.spend/maxS)+'">'+money0(r.spend)+'</span></td>'
      +'<td class="num">'+intf(r.sales)+'</td>'
      +'<td class="num">'+(cac!=null?'<span class="cac-pill '+cacClass(cac,medCac)+'">'+money0(cac)+'</span>':'—')+'</td>'
      +chkC
      +'<td class="num">'+money0(r.rev)+'</td>'
      +'<td class="num">'+(r.spend>0?'<span class="roas-pill '+roasClass(roas)+'">'+roasf(roas)+'</span>':'—')+'</td>'
      +'<td class="num '+(lucro>=0?'pos':'neg')+'">'+money0(lucro)+'</td></tr>'; }).join('');
  if(!rows.length) body='<tr><td colspan="'+(chk?9:7)+'" class="empty">Sem dados no período.</td></tr>';
  var a=aggDaily(cfg.S,rng), tr=dv(a.rev,a.spend), tl=a.rev-a.spend, tc=a.sales>0?dv(a.spend,a.sales):null;
  var chkF=chk?('<td class="num">'+(a.lpv>0?pct(dv(a.checkout,a.lpv)*100):'—')+'</td><td class="num">'+(a.checkout>0?pct(dv(a.sales,a.checkout)*100):'—')+'</td>'):'';
  var foot='<tfoot><tr><td>Total</td><td class="num">'+money0(a.spend)+'</td><td class="num">'+intf(a.sales)+'</td><td class="num">'+(tc!=null?money0(tc):'—')+'</td>'+chkF+'<td class="num">'+money0(a.rev)+'</td><td class="num">'+(a.spend>0?roasf(tr):'—')+'</td><td class="num '+(tl>=0?'pos':'neg')+'">'+money0(tl)+'</td></tr></tfoot>';
  el(cfg.pfx+'-daily').innerHTML=head+'<tbody>'+body+'</tbody>'+foot;
}

/* =================== OTIMIZAÇÃO (árvore) =================== */
function prettyName(x){ return x==='SEM_RASTREIO' ? '— sem rastreio —' : x; }
function newNode(name,full){ return {name:name,full:full,spend:0,impr:0,clicks:0,lpv:0,checkout:0,sales:0,rev:0,kids:{}}; }
function accum(n,r){ n.spend+=r.spend||0;n.impr+=r.impr||0;n.clicks+=r.clicks||0;n.lpv+=r.lpv||0;n.checkout+=r.checkout||0;n.sales+=r.sales||0;n.rev+=r.rev||0; }
var expanded={meta:{},google:{}}, treeInit={meta:false,google:false};
function buildTree(rows){ var c={}; rows.forEach(function(r){
  var cn=c[r.campaign]||(c[r.campaign]=newNode(prettyName(r.campaign),r.campaign)); accum(cn,r);
  var sn=cn.kids[r.adset]||(cn.kids[r.adset]=newNode(prettyName(r.adset),r.adset)); accum(sn,r);
  var an=sn.kids[r.ad]||(sn.kids[r.ad]=newNode(prettyName(r.ad),r.ad)); accum(an,r); }); return c; }
function actTag(n,medRoas){
  if(n.spend===0 && n.sales>0) return {t:'s/ gasto',c:'act-ins'};
  if(n.spend>0 && n.sales===0) return {t:'Pausar',c:'act-pause'};
  if(n.sales<3) return {t:'Dado insuf.',c:'act-ins'};
  if(medRoas<=0) return {t:'—',c:'act-ins'};
  var r=dv(n.rev,n.spend)/medRoas;
  if(r>=1.2) return {t:'Acelerar',c:'act-acel'};
  if(r<=0.6) return {t:'Revisar',c:'act-rev'};
  return {t:'Manter',c:'act-mant'};
}
// coluna -> HTML da celula (data-driven; VSL: txchk=Checkout/LPV, txcpr=Vendas/Checkout)
function cellHTML(key,n,medR,medC){
  switch(key){
    case 'spend': return money0(n.spend);
    case 'cpm':   return n.impr>0?money(dv(n.spend,n.impr)*1000):'—';
    case 'ctr':   return n.impr>0?pct(dv(n.clicks,n.impr)*100):'—';
    case 'cpc':   return n.clicks>0?money(dv(n.spend,n.clicks)):'—';
    case 'txchk': return n.lpv>0?pct(dv(n.checkout,n.lpv)*100):'—';
    case 'txcpr': return n.checkout>0?pct(dv(n.sales,n.checkout)*100):'—';
    case 'sales': return intf(n.sales);
    case 'cac':   var cac=(n.sales>0&&n.spend>0)?dv(n.spend,n.sales):null; return cac!=null?'<span class="cac-pill '+cacClass(cac,medC)+'">'+money0(cac)+'</span>':'—';
    case 'rev':   return money0(n.rev);
    case 'roas':  var r=dv(n.rev,n.spend); return n.spend>0?'<span class="roas-pill '+roasClass(r)+'">'+roasf(r)+'</span>':'—';
    case 'act':   var t=actTag(n,medR); return '<span class="act '+t.c+'">'+t.t+'</span>';
  }
  return '';
}
function metricsCells(cols,n,medR,medC){ var s=''; for(var i=1;i<cols.length;i++){ s+='<td class="num">'+cellHTML(cols[i].k,n,medR,medC)+'</td>'; } return s; }
function treeRow(cols,n,lvl,key,hasKids,medR,medC){
  var caret=hasKids?'<span class="caret'+(expanded[curKey][key]?' open':'')+'">▶</span>':'<span class="caret" style="opacity:.2">•</span>';
  return '<tr class="lvl'+lvl+(hasKids?' parent':'')+'" data-key="'+encodeURIComponent(key)+'"><td><span class="name" title="'+esc(n.full||n.name)+'">'+caret+' '+esc(n.name)+'</span></td>'+metricsCells(cols,n,medR,medC)+'</tr>';
}
// ordenacao clicavel: sortValOf devolve valor onde MENOR = MELHOR (1o clique = melhor->pior)
var treeSort={meta:{key:'rev',rev:false},google:{key:'rev',rev:false}};
var ACT_RANK={'Acelerar':0,'Manter':1,'Revisar':2,'Pausar':3,'s/ gasto':4,'Dado insuf.':5};
// colunas por origem: Meta (VSL) ganha Tx Chk + Tx Compra; Google nao tem esses estagios
function treeCols(cfg){
  var c=[{k:'name'},{k:'spend',l:'Gasto'},{k:'cpm',l:'CPM'},{k:'ctr',l:'CTR'},{k:'cpc',l:'CPC'}];
  if(cfg.hasCheckout){ c.push({k:'txchk',l:'Tx Chk'},{k:'txcpr',l:'Tx Compra'}); }
  c.push({k:'sales',l:'Vendas'},{k:'cac',l:'CAC'},{k:'rev',l:'Faturamento'},{k:'roas',l:'ROAS'},{k:'act',l:'Ação'});
  return c;
}
function sortValOf(key,n,medR){
  if(key==='spend') return -(n.spend||0);
  if(key==='sales') return -(n.sales||0);
  if(key==='rev')   return -(n.rev||0);
  if(key==='cpm')   return n.impr>0?dv(n.spend,n.impr)*1000:Infinity;
  if(key==='ctr')   return n.impr>0?-dv(n.clicks,n.impr):Infinity;
  if(key==='cpc')   return n.clicks>0?dv(n.spend,n.clicks):Infinity;
  if(key==='txchk') return n.lpv>0?-dv(n.checkout,n.lpv):Infinity;
  if(key==='txcpr') return n.checkout>0?-dv(n.sales,n.checkout):Infinity;
  if(key==='cac')   return (n.sales>0&&n.spend>0)?dv(n.spend,n.sales):Infinity;
  if(key==='roas')  return n.spend>0?-dv(n.rev,n.spend):Infinity;
  if(key==='act'){ var r=ACT_RANK[actTag(n,medR).t]; return r==null?9:r; }
  return 0;
}
var curKey='meta';
function renderTree(cfg,rng){
  var sk=cfg.pfx==='m'?'meta':'google'; curKey=sk;
  var ss=treeSort[sk];
  var rows=cfg.S._grain.filter(function(r){return inRange(r.date,rng);});
  var camps=buildTree(rows);
  var leafR=[],leafC=[]; Object.keys(camps).forEach(function(cK){ if(cK==='SEM_RASTREIO')return; var c=camps[cK]; Object.keys(c.kids).forEach(function(sK){ var sN=c.kids[sK]; Object.keys(sN.kids).forEach(function(aK){ var an=sN.kids[aK]; if(an.spend>0&&an.sales>0){leafR.push(dv(an.rev,an.spend));leafC.push(dv(an.spend,an.sales));} }); }); });
  var medR=median(leafR), medC=median(leafC);
  function cmp(a,b){
    if(ss.key==='name'){ var rn=String(a.name).localeCompare(String(b.name),'pt',{numeric:true}); return ss.rev?-rn:rn; }
    var va=sortValOf(ss.key,a,medR), vb=sortValOf(ss.key,b,medR);
    var na=!isFinite(va), nb=!isFinite(vb);
    if(na&&nb) return (b.rev||0)-(a.rev||0);
    if(na) return 1; if(nb) return -1;   // sem dado (—) sempre por ultimo
    var r=va-vb; if(r===0){ r=(b.rev||0)-(a.rev||0); }
    return ss.rev?-r:r;
  }
  function skeys(obj){ return Object.keys(obj).sort(function(x,y){ return cmp(obj[x],obj[y]); }); }
  var order=skeys(camps);
  if(!treeInit[sk]){ order.slice(0,3).forEach(function(cK){ expanded[sk]['c:'+cK]=true; }); treeInit[sk]=true; }
  var cols=treeCols(cfg);
  var head='<thead><tr>'+cols.map(function(c){ var on=ss.key===c.k; var lab=(c.k==='name')?('Campanha › '+cfg.midLabel+' › Anúncio'):c.l;
    return '<th class="sortable'+(on?' sorton':'')+'" data-col="'+c.k+'">'+lab+(on?' <span class="sarr">'+(ss.rev?'▲':'▼')+'</span>':'')+'</th>'; }).join('')+'</tr></thead>';
  var out=[];
  order.forEach(function(cK){ var c=camps[cK],cKey='c:'+cK,cHas=Object.keys(c.kids).length>0; out.push(treeRow(cols,c,0,cKey,cHas,medR,medC));
    if(expanded[sk][cKey]){ skeys(c.kids).forEach(function(sK){ var sN=c.kids[sK],sKey=cKey+'|s:'+sK,sHas=Object.keys(sN.kids).length>0; out.push(treeRow(cols,sN,1,sKey,sHas,medR,medC));
      if(expanded[sk][sKey]){ skeys(sN.kids).forEach(function(aK){ out.push(treeRow(cols,sN.kids[aK],2,sKey+'|a:'+aK,false,medR,medC)); }); } }); } });
  if(!out.length) out.push('<tr><td colspan="'+cols.length+'" class="empty">Sem dados no período.</td></tr>');
  var tEl=el(cfg.pfx+'-tree'); tEl.innerHTML=head+'<tbody>'+out.join('')+'</tbody>';
  el(cfg.pfx+'-treeLegend').innerHTML='<span><span class="act act-acel">Acelerar</span> ROAS ≥ 1,2× a mediana</span><span><span class="act act-rev">Revisar</span> ROAS ≤ 0,6×</span><span><span class="act act-pause">Pausar</span> gastou e não vendeu</span><span style="color:var(--muted2)">clique num cabeçalho p/ ordenar (melhor→pior); clique de novo p/ inverter</span>';
  Array.prototype.forEach.call(tEl.querySelectorAll('th.sortable'),function(th){
    th.addEventListener('click',function(){ var k=th.getAttribute('data-col'); var s=treeSort[sk];
      if(s.key===k){ s.rev=!s.rev; } else { s.key=k; s.rev=false; } renderTree(cfg,rangeFor(period)); }); });
  Array.prototype.forEach.call(tEl.querySelectorAll('tr.parent'),function(tr){
    tr.addEventListener('click',function(){ var k=decodeURIComponent(tr.getAttribute('data-key')); expanded[sk][k]=!expanded[sk][k]; renderTree(cfg,rangeFor(period)); }); });
}

/* =================== INSIGHTS (acelerar & pausar) =================== */
function aggBy(rows,keyf){ var m={}; rows.forEach(function(r){ var k=keyf(r); if(k==null)return; var n=m[k]||(m[k]={key:k,spend:0,sales:0,rev:0,clicks:0}); n.spend+=r.spend||0;n.sales+=r.sales||0;n.rev+=r.rev||0;n.clicks+=r.clicks||0; }); return Object.keys(m).map(function(k){return m[k];}); }
function insCard(kind,icon,tag,title,desc){ return '<div class="ins '+kind+'"><div class="ic">'+icon+'</div><div><div class="it">'+title+'</div><div class="id">'+desc+'</div><span class="tag">'+tag+'</span></div></div>'; }
function renderInsights(cfg,rng){
  var rows=cfg.S._grain.filter(function(r){return inRange(r.date,rng);});
  var a=aggDaily(cfg.S,rng), accRoas=dv(a.rev,a.spend), out=[];
  var camps=aggBy(rows,function(r){return r.campaign==='SEM_RASTREIO'?null:r.campaign;}).filter(function(n){return n.spend>0;});
  var ads=aggBy(rows,function(r){return (r.ad==='SEM_RASTREIO'||r.campaign==='SEM_RASTREIO')?null:r.ad+' ⟨'+r.campaign+'⟩';}).filter(function(n){return n.spend>0;});
  function rz(n){return dv(n.rev,n.spend);}
  function shortAd(k){ return k.split(' ⟨')[0]; }
  // ACELERAR: campanha ROAS alto e volume relevante
  var accel=camps.filter(function(n){return n.sales>=8 && rz(n)>=Math.max(1, accRoas*1.15);}).sort(function(x,y){return rz(y)-rz(x);});
  accel.slice(0,2).forEach(function(n){ out.push(insCard('acel','🚀','Escalar',esc(n.key.length>52?n.key.slice(0,52)+'…':n.key),
    'ROAS <b>'+roasf(rz(n))+'</b> ('+pct((rz(n)/accRoas-1)*100)+' acima da média) · <b>'+intf(n.sales)+'</b> vendas · CAC <b>'+money0(dv(n.spend,n.sales))+'</b> · gasto '+money0(n.spend)+'. Tem espaço p/ aumentar orçamento.')); });
  // melhor anúncio
  var goodAds=ads.filter(function(n){return n.sales>=6;}).sort(function(x,y){return rz(y)-rz(x);});
  if(goodAds.length){ var g=goodAds[0]; if(rz(g)>=accRoas*1.1) out.push(insCard('acel','🎯','Criativo campeão',esc(shortAd(g.key)),
    'Melhor ROAS entre os anúncios: <b>'+roasf(rz(g))+'</b> · '+intf(g.sales)+' vendas · CAC '+money0(dv(g.spend,g.sales))+'. Vale duplicar em novos conjuntos/públicos.')); }
  // PAUSAR: gastou e não vendeu (ou quase)
  var noSale=camps.filter(function(n){return n.sales===0 && n.spend>=(a.spend*0.01);}).sort(function(x,y){return y.spend-x.spend;});
  noSale.slice(0,2).forEach(function(n){ out.push(insCard('pause','⛔','Pausar',esc(n.key.length>52?n.key.slice(0,52)+'…':n.key),
    'Gastou <b>'+money0(n.spend)+'</b> e <b>não gerou venda</b> no período. Candidata a pausa imediata.')); });
  // REVISAR: ROAS muito baixo com gasto alto
  var bleed=camps.filter(function(n){return n.sales>0 && rz(n)<=accRoas*0.6 && n.spend>=(a.spend*0.03);}).sort(function(x,y){return (x.rev-x.spend)-(y.rev-y.spend);});
  bleed.slice(0,2).forEach(function(n){ out.push(insCard('pause','⚠️','Revisar',esc(n.key.length>52?n.key.slice(0,52)+'…':n.key),
    'ROAS <b>'+roasf(rz(n))+'</b> (bem abaixo da média '+roasf(accRoas)+') · gasto '+money0(n.spend)+' p/ '+money0(n.rev)+' · prejuízo '+money0(n.spend-n.rev)+'. Reveja criativo/público ou corte.')); });
  // INFO: resumo
  out.push(insCard('info','📊','Panorama do período',
    accRoas>=1?'Operação no lucro (ROAS '+roasf(accRoas)+')':'Break-even em ROAS 1,00 — falta '+pct((1-accRoas)*100)+' p/ empatar',
    '<b>'+intf(a.sales)+'</b> vendas · faturamento <b>'+money0(a.rev)+'</b> · investimento '+money0(a.spend)+' · CAC médio '+money0(dv(a.spend,a.sales))+' · ticket '+money(dv(a.rev,a.sales))+'. '+(cfg.taxed?'Lembrando: front-end de baixo ticket — o lucro real aparece com order bump/upsell.':'')));
  if(!out.length) out.push('<div class="empty">Sem dados suficientes no período p/ gerar insights.</div>');
  el(cfg.pfx+'-insights').innerHTML=out.join('');
}

/* =================== GERAL =================== */
function combineDaily(rng){
  var m={};
  [META,GOOG].forEach(function(S){ S.daily.forEach(function(d){ if(!isDate(d.date)||!inRange(d.date,rng))return; var o=m[d.date]||(m[d.date]={date:d.date,spend:0,spendRaw:0,sales:0,rev:0}); o.spend+=d.spend||0;o.spendRaw+=d.spendRaw||0;o.sales+=d.sales||0;o.rev+=d.rev||0; }); });
  return Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return a.date.localeCompare(b.date);});
}
function qcard(cls,lab,val,sub){ return '<div class="qcard'+(cls?' '+cls:'')+'"><div class="q-l">'+lab+'</div><div class="q-v">'+val+'</div>'+(sub?'<div class="q-s">'+sub+'</div>':'')+'</div>'; }
function obTile(big,lab,val,sub){ return '<div class="obtile'+(big?' big':'')+'"><div class="ot-l">'+lab+'</div><div class="ot-v">'+val+'</div><div class="ot-s">'+sub+'</div></div>'; }
// agrega order bumps no periodo (srcFilter: 'm'|'g'|null=ambos)
function obAggFor(rng,srcFilter){
  var sales=0, rev=0, by={}, byDay={};
  OB.forEach(function(o){ if(!isDate(o.d)||!inRange(o.d,rng))return; if(srcFilter&&o.src!==srcFilter)return;
    sales+=o.s; rev+=o.r;
    (by[o.k]=by[o.k]||{s:0,r:0}); by[o.k].s+=o.s; by[o.k].r+=o.r;
    (byDay[o.d]=byDay[o.d]||{s:0,r:0}); byDay[o.d].s+=o.s; byDay[o.d].r+=o.r; });
  return {sales:sales, rev:rev, by:by, byDay:byDay};
}
// renderiza o card de OB (tiles + breakdown) em qualquer aba. pfx: ''|'m-'|'g-'
function renderOBcard(pfx,ob,mpiSales,mpiRev,spend){
  var convOB=dv(ob.sales,mpiSales), roasBase=dv(mpiRev,spend), fatTotal=mpiRev+ob.rev, roasOB=dv(fatTotal,spend);
  el(pfx+'obStats').innerHTML=
    obTile(false,'Vendas Order Bump',intf(ob.sales),'de '+intf(mpiSales)+' vendas MPI')
    +obTile(false,'Faturamento OB',money0(ob.rev),'líquido, no período')
    +obTile(false,'Conv. OB',pct(convOB*100),'take rate (OB ÷ MPI)')
    +obTile(true,'Faturamento Total',money0(fatTotal),'MPI + order bump')
    +obTile(true,'ROAS c/ OB',roasf(roasOB),(roasOB>=1?'✓ no lucro':'sobe de '+roasf(roasBase)));
  var maxObR=Math.max.apply(null,OB_ORDER.map(function(k){return ob.by[k]?ob.by[k].r:0;}).concat([1]));
  var totObR=ob.rev||1;
  el(pfx+'obBreak').innerHTML=OB_ORDER.map(function(k){ var b=ob.by[k]||{s:0,r:0}; var w=maxObR>0?Math.max(2,b.r/maxObR*100):0;
    return '<div class="obrow"><div class="obrow-top"><span class="obl">'+esc(OB_LABELS[k])+'</span>'
      +'<span class="obn">'+intf(b.s)+' vendas · <b>'+money0(b.r)+'</b> · '+pct(dv(b.r,totObR)*100)+'</span></div>'
      +'<div class="obtrack"><span style="width:'+w.toFixed(1)+'%"></span></div></div>'; }).join('')
    +'<div class="ob-foot">Order bump = produto levado junto no checkout do MPI. Faturamento líquido; ROAS c/ OB = (faturamento MPI + OB) ÷ investimento'+(pfx==='g-'?'':' c/ imposto')+'.</div>';
}
/* =================== META DE INVESTIMENTO (mensal, R$ 250k) =================== */
var INVEST_GOAL=250000;   // meta de investimento gerenciador por mes
var MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function monthLabel(iso){ return MONTHS[(+iso.slice(5,7))-1]+' '+iso.slice(0,4); }
function daysInMonthOf(iso){ return new Date(Date.UTC(+iso.slice(0,4), +iso.slice(5,7), 0)).getUTCDate(); }
function investIn(range){ var raw=0; [META,GOOG].forEach(function(S){ S.daily.forEach(function(d){ if(isDate(d.date)&&inRange(d.date,range)) raw+=d.spendRaw||0; }); }); return raw; }
function gt(hero,lab,val,sub,cls){ return '<div class="gtile'+(hero?' hero':'')+'"><div class="gt-l">'+lab+'</div><div class="gt-v'+(cls?' '+cls:'')+'">'+val+'</div><div class="gt-s">'+sub+'</div></div>'; }
function goalData(){
  if(!maxDate) return null;
  var mStart=maxDate.slice(0,7)+'-01', mDays=daysInMonthOf(maxDate), dayN=+maxDate.slice(8,10);
  var inv=investIn([mStart,maxDate]), goal=INVEST_GOAL, falta=Math.max(0,goal-inv), pct=dv(inv,goal);
  var dr=mDays-dayN, perDay=dr>0?falta/dr:falta, pace=dayN>0?inv/dayN:0, target=goal*(dayN/mDays);
  return {mDays:mDays,dayN:dayN,inv:inv,goal:goal,falta:falta,pct:pct,dr:dr,perDay:perDay,pace:pace,proj:pace*mDays,target:target,ahead:inv-target,done:inv>=goal,onTrack:inv>=target};
}
// faixa compacta da meta p/ embutir no hero de investimento (Meta/Google)
function goalStrip(){
  var g=goalData(); if(!g) return '';
  var good=g.done||g.onTrack, col=good?COL.grn:'#f0a93b';
  return '<div class="hero-goal"><div class="hg-top"><span>🎯 Meta do mês <b>'+money0(g.goal)+'</b> <small>Meta+Google</small></span>'
    +'<span class="'+(good?'pos':'neg')+'">'+(g.done?'✓ batida':money0(g.perDay)+'/dia · '+g.dr+'d')+'</span></div>'
    +'<div class="hg-bar"><span style="width:'+(clamp(g.pct)*100).toFixed(1)+'%;background:'+col+'"></span></div>'
    +'<div class="hg-sub">Investido <b>'+money0(g.inv)+'</b> · '+nf0.format(g.pct*100)+'% · falta '+money0(g.falta)+'</div></div>';
}
function renderGoal(){
  var host=el('geralGoal'); var g=goalData(); if(!host||!g) return;
  var mDays=g.mDays,dayN=g.dayN,inv=g.inv,goal=g.goal,falta=g.falta,pct=g.pct,dr=g.dr,perDay=g.perDay,pace=g.pace,proj=g.proj,target=g.target,ahead=g.ahead,done=g.done,onTrack=g.onTrack;
  var fillCol=(done||onTrack)?COL.grn:'#f0a93b';
  var projCls=proj>=goal?'pos':'neg', projSub=proj>=goal?'bate a meta no ritmo atual':money0(goal-proj)+' abaixo da meta';
  var statusV,statusCls,statusSub;
  if(done){ statusV='Meta batida 🎉'; statusCls='pos'; statusSub='investimento do mês completo'; }
  else if(onTrack){ statusV='No ritmo'; statusCls='pos'; statusSub=money0(ahead)+' adiantado vs. ideal de hoje'; }
  else { statusV='Atrasado'; statusCls='neg'; statusSub=money0(-ahead)+' atrás do ideal de hoje'; }
  host.innerHTML=
    '<div class="goal-head"><span class="goal-month">'+monthLabel(maxDate)+' · dia '+dayN+' de '+mDays+'</span>'
    + '<span class="goal-pct"><b>'+nf1.format(pct*100)+'%</b> da meta</span></div>'
    + '<div class="goal-bar"><span class="goal-fill" style="width:'+(clamp(pct)*100).toFixed(1)+'%;background:'+fillCol+'"></span>'
    +   '<span class="goal-mark" style="left:'+(clamp(dayN/mDays)*100).toFixed(1)+'%" title="onde deveria estar hoje"></span></div>'
    + '<div class="goal-scale"><span>Investido <b>'+money0(inv)+'</b></span>'
    +   '<span class="gm">▲ ideal hoje '+money0(target)+'</span>'
    +   '<span>Meta <b>'+money0(goal)+'</b></span></div>'
    + '<div class="goal-tiles">'
    +   gt(true,'Necessário por dia', done?'✓ meta batida':money0(perDay), done?'sobra '+money0(inv-goal):'nos próximos <b>'+dr+'</b> dia'+(dr===1?'':'s')+' · falta '+money0(falta),'')
    +   gt(false,'Ritmo atual', money0(pace)+'/dia', 'média dos '+dayN+' dias do mês','')
    +   gt(false,'Projeção do mês', money0(proj), projSub, projCls)
    +   gt(false,'Status', statusV, statusSub, statusCls)
    + '</div>';
}
function renderGeral(rng){
  var am=aggDaily(META,rng), ag=aggDaily(GOOG,rng);
  var spend=am.spend+ag.spend, spendRaw=am.spendRaw+ag.spendRaw, sales=am.sales+ag.sales, rev=am.rev+ag.rev;
  var roas=dv(rev,spend), lucro=rev-spend, cac=dv(spend,sales), ticket=dv(rev,sales);
  // ----- order bumps (period-reactive) -----
  var ob=obAggFor(rng,null);
  var fatTotal=rev+ob.rev, lucroOB=fatTotal-spend, roasOB=dv(fatTotal,spend);
  var totalSales = sales + ob.sales;
  el('geralQuad').innerHTML=
    qcard('','Investimento Gerenciador',money0(spendRaw),'sem imposto')
    +qcard('','Investimento c/ Imposto',money0(spend),'imposto Meta +13,85%')
    +qcard('','Faturamento',money0(rev),'só MPI · ticket <b>'+money(ticket)+'</b>')
    +qcard('gold','Faturamento Total',money0(fatTotal),'MPI + order bump (<b>'+money0(ob.rev)+'</b> OB)')
    +qcard('','Vendas',intf(sales),'só MPI · CAC <b>'+money0(cac)+'</b>')
    +qcard('gold','Vendas Totais',intf(totalSales),'MPI + order bump (<b>'+intf(ob.sales)+'</b> OB)')
    +qcard('big','ROAS c/ Imposto',roasf(roas),'só MPI')
    +qcard('gold','ROAS c/ OB',roasf(roasOB),'com order bump')
    +qcard('','Lucro',money0(lucroOB),(lucroOB>=0?'<span class="pos">positivo</span>':'<span class="neg">negativo</span>')+' · fat. total − invest')
    +qcard('','Meta',intf(am.sales)+' vendas','ROAS '+roasf(dv(am.rev,am.spend))+' · '+money0(am.rev))
    +qcard('','Google / YouTube',intf(ag.sales)+' vendas','ROAS '+roasf(dv(ag.rev,ag.spend))+' · '+money0(ag.rev));
  // split Meta x Google
  function splitBar(title,vm,vg){ var t=vm+vg; if(t<=0)t=1; var wm=vm/t*100, wg=vg/t*100;
    return '<div style="font-size:11.5px;color:var(--muted);margin:2px 0 3px">'+title+'</div><div class="split">'
      +(wm>0?'<span style="width:'+wm.toFixed(1)+'%;background:'+COL.meta+'" title="Meta">'+(wm>10?nf0.format(Math.round(wm))+'%':'')+'</span>':'')
      +(wg>0?'<span style="width:'+wg.toFixed(1)+'%;background:'+COL.goog+'" title="Google">'+(wg>10?nf0.format(Math.round(wg))+'%':'')+'</span>':'')+'</div>'; }
  el('geralSplit').innerHTML=splitBar('Faturamento',am.rev,ag.rev)+splitBar('Investimento',am.spend,ag.spend)+splitBar('Vendas',am.sales,ag.sales)
    +'<div class="split-leg"><span><span class="dot" style="background:'+COL.meta+'"></span>Meta Ads</span><span><span class="dot" style="background:'+COL.goog+'"></span>Google / YouTube</span></div>';
  // comparativo
  function row(name,dot,x){ var rz=dv(x.rev,x.spend), lu=x.rev-x.spend;
    return '<tr><td><span class="srcname"><span class="sd" style="background:'+dot+'"></span>'+name+'</span></td>'
      +'<td class="num">'+money0(x.spend)+'</td><td class="num">'+intf(x.sales)+'</td><td class="num">'+money0(x.rev)+'</td>'
      +'<td class="num">'+(x.sales?money(dv(x.rev,x.sales)):'—')+'</td><td class="num">'+(x.sales?money0(dv(x.spend,x.sales)):'—')+'</td>'
      +'<td class="num">'+(x.spend>0?'<span class="roas-pill '+roasClass(rz)+'">'+roasf(rz)+'</span>':'—')+'</td>'
      +'<td class="num '+(lu>=0?'pos':'neg')+'">'+money0(lu)+'</td></tr>'; }
  var tot={spend:spend,sales:sales,rev:rev};
  var totRoas=dv(rev,spend), totRow='<tr><td>Total</td><td class="num">'+money0(spend)+'</td><td class="num">'+intf(sales)+'</td><td class="num">'+money0(rev)+'</td>'
    +'<td class="num">'+(sales?money(dv(rev,sales)):'—')+'</td><td class="num">'+(sales?money0(dv(spend,sales)):'—')+'</td>'
    +'<td class="num">'+(spend>0?'<span class="roas-pill '+roasClass(totRoas)+'">'+roasf(totRoas)+'</span>':'—')+'</td>'
    +'<td class="num '+(lucro>=0?'pos':'neg')+'">'+money0(lucro)+'</td></tr>';
  el('geralCmp').innerHTML='<thead><tr><th>Origem</th><th>Investimento</th><th>Vendas</th><th>Faturamento</th><th>Ticket</th><th>CAC</th><th>ROAS</th><th>Lucro</th></tr></thead><tbody>'
    +row('Meta Ads',COL.meta,am)+row('Google / YouTube',COL.goog,ag)+'</tbody><tfoot>'+totRow+'</tfoot>';
  // ----- seção Order Bumps (Meta + Google) -----
  renderOBcard('', ob, sales, rev, spend);

  // ----- daily combinado c/ order bump -----
  var rows=combineDaily(rng).slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  var maxS=Math.max.apply(null,rows.map(function(r){return r.spend||0;}).concat([1]));
  var head='<thead><tr><th>Dia</th><th>Investimento</th><th>Vendas</th><th>Fat. MPI</th><th>Fat. OB</th><th>Fat. Total</th><th>ROAS c/ OB</th><th>Lucro c/ OB</th></tr></thead>';
  var body=rows.map(function(r){ var od=ob.byDay[r.date]||{s:0,r:0}, ft=r.rev+od.r, rz=dv(ft,r.spend), lu=ft-r.spend;
    return '<tr><td>'+fmtBR(r.date)+'</td><td class="num"><span class="heatcell" style="'+heatBg('35,194,134',r.spend/maxS)+'">'+money0(r.spend)+'</span></td>'
      +'<td class="num">'+intf(r.sales)+'</td><td class="num">'+money0(r.rev)+'</td>'
      +'<td class="num'+(od.r>0?' obcell':'')+'">'+(od.r>0?money0(od.r):'—')+'</td>'
      +'<td class="num">'+money0(ft)+'</td>'
      +'<td class="num">'+(r.spend>0?'<span class="roas-pill '+roasClass(rz)+'">'+roasf(rz)+'</span>':'—')+'</td>'
      +'<td class="num '+(lu>=0?'pos':'neg')+'">'+money0(lu)+'</td></tr>'; }).join('');
  if(!rows.length)body='<tr><td colspan="8" class="empty">Sem dados no período.</td></tr>';
  var fRoas=dv(fatTotal,spend);
  var foot='<tfoot><tr><td>Total</td><td class="num">'+money0(spend)+'</td><td class="num">'+intf(sales)+'</td><td class="num">'+money0(rev)+'</td><td class="num">'+money0(ob.rev)+'</td><td class="num">'+money0(fatTotal)+'</td><td class="num">'+(spend>0?roasf(fRoas):'—')+'</td><td class="num '+(lucroOB>=0?'pos':'neg')+'">'+money0(lucroOB)+'</td></tr></tfoot>';
  el('geralDaily').innerHTML=head+'<tbody>'+body+'</tbody>'+foot;
}

/* =================== HISTÓRICO POR DIA DA SEMANA =================== */
var WD_ORDER=[1,2,3,4,5,6,0], WD_NAME={0:'Domingo',1:'Segunda',2:'Terça',3:'Quarta',4:'Quinta',5:'Sexta',6:'Sábado'}, WD_SHORT={0:'Dom',1:'Seg',2:'Ter',3:'Qua',4:'Qui',5:'Sex',6:'Sáb'};
var RANK_COL=['#23c286','#4dd39a','#86d979','#c9d24a','#f0c043','#ef9a4a','#f2637e'];
var histWeeks=8;
function weekdayOf(iso){ var p=iso.split('-'); return new Date(Date.UTC(+p[0],+p[1]-1,+p[2])).getUTCDay(); }
function monthShort(mo){ return MONTHS[(+mo.slice(5,7))-1].slice(0,3)+'/'+mo.slice(2,4); }
function histDaily(){ var m={};
  [META,GOOG].forEach(function(S){ S.daily.forEach(function(d){ if(!isDate(d.date))return; var o=m[d.date]||(m[d.date]={date:d.date,sales:0,spend:0,rev:0}); o.sales+=d.sales||0;o.spend+=d.spend||0;o.rev+=d.rev||0; }); });
  OB.forEach(function(o2){ if(m[o2.d]){ m[o2.d].rev+=o2.r||0; } });   // ROAS do historico inclui order bump
  return Object.keys(m).map(function(k){return m[k];}).filter(function(d){return d.date!==maxDate;}).sort(function(a,b){return a.date.localeCompare(b.date);}); }
function wdStats(days){ var w={}; for(var i=0;i<7;i++)w[i]={w:i,nDays:0,sales:0,spend:0,rev:0};
  days.forEach(function(d){ var o=w[weekdayOf(d.date)]; o.nDays++;o.sales+=d.sales;o.spend+=d.spend;o.rev+=d.rev; });
  for(var j=0;j<7;j++){ var o=w[j]; o.vndDia=o.nDays?o.sales/o.nDays:0; o.roas=dv(o.rev,o.spend); o.cac=o.sales?dv(o.spend,o.sales):0; o.fatDia=o.nDays?o.rev/o.nDays:0; } return w; }
function rankVol(st){ return [0,1,2,3,4,5,6].slice().sort(function(a,b){ return st[b].vndDia-st[a].vndDia; }); }
function rankBars(st,order,cmp){ var mx=Math.max.apply(null,order.map(function(w){return st[w].vndDia;}).concat([1]));
  return order.map(function(w,i){ var o=st[w],frac=o.vndDia/mx,col=RANK_COL[i],medal=i===0?'🥇':(i===1?'🥈':(i===2?'🥉':(i+1)+'º'));
    var delta=''; if(cmp){ var hp=cmp.indexOf(w),mv=hp-i; delta=mv>0?' <span class="hist-up">▲'+mv+'</span>':(mv<0?' <span class="hist-down">▼'+(-mv)+'</span>':' <span class="hist-eq">=</span>'); }
    return '<div class="hbrow"><span class="hb-rank">'+medal+'</span><span class="hb-name">'+WD_NAME[w]+delta+'</span>'
      +'<span class="hb-bar"><span style="width:'+Math.max(6,frac*100).toFixed(0)+'%;background:'+col+'"></span></span>'
      +'<span class="hb-v">'+nf1.format(o.vndDia)+'<small>/dia</small></span><span class="hb-r">ROAS '+roasf(o.roas)+'</span></div>'; }).join(''); }
function histHeat(days){ var months=[],wm={};
  days.forEach(function(d){ var mo=d.date.slice(0,7); if(months.indexOf(mo)<0)months.push(mo); var k=weekdayOf(d.date)+'|'+mo; var o=wm[k]||(wm[k]={s:0,n:0}); o.s+=d.sales;o.n++; });
  months.sort(); var mx=1; Object.keys(wm).forEach(function(k){ var a=wm[k].s/wm[k].n; if(a>mx)mx=a; });
  var head='<tr><th>Dia</th>'+months.map(function(mo){return '<th>'+monthShort(mo)+'</th>';}).join('')+'</tr>';
  var rows=WD_ORDER.map(function(w){ return '<tr><td class="hm-day">'+WD_SHORT[w]+'</td>'+months.map(function(mo){ var o=wm[w+'|'+mo]; if(!o)return '<td class="hm-c">·</td>'; var a=o.s/o.n; var bg='rgba(35,194,134,'+(0.06+0.6*clamp(a/mx)).toFixed(3)+')'; return '<td class="hm-c" style="background:'+bg+'">'+nf0.format(Math.round(a))+'</td>'; }).join('')+'</tr>'; }).join('');
  return '<table class="hm-table">'+head+rows+'</table>'; }
function histTableHTML(sAll,sRec){ var rk=rankVol(sRec)[0];
  var head='<thead><tr><th>Dia da semana</th><th>Vnd/dia (rec.)</th><th>ROAS (rec.)</th><th>CAC (rec.)</th><th>Vnd/dia (hist.)</th><th>ROAS (hist.)</th><th>CAC (hist.)</th></tr></thead>';
  var body=WD_ORDER.map(function(w){ var r=sRec[w],a=sAll[w];
    return '<tr'+(w===rk?' class="hist-champ-row"':'')+'><td>'+WD_NAME[w]+(w===rk?' 🥇':'')+'</td>'
      +'<td class="num">'+nf1.format(r.vndDia)+'</td><td class="num">'+roasf(r.roas)+'</td><td class="num">'+(r.cac?money0(r.cac):'—')+'</td>'
      +'<td class="num">'+nf1.format(a.vndDia)+'</td><td class="num">'+roasf(a.roas)+'</td><td class="num">'+(a.cac?money0(a.cac):'—')+'</td></tr>'; }).join('');
  return head+'<tbody>'+body+'</tbody>'; }
function renderHistorico(){ var all=histDaily(); if(!el('histVerdict'))return;
  if(all.length<7){ el('histVerdict').innerHTML='<div class="empty">Ainda sem histórico suficiente.</div>'; return; }
  var last=all[all.length-1].date, rStart=addDays(last,-(histWeeks*7-1));
  var rec=all.filter(function(d){return d.date>=rStart;});
  var sAll=wdStats(all), sRec=wdStats(rec), rkA=rankVol(sAll), rkR=rankVol(sRec);
  var cR=rkR[0], cA=rkA[0], wR=rkR[6], changed=cR!==cA;
  el('histVerdict').innerHTML='<div class="hv-grid">'
    +'<div class="hv-box champ"><div class="hv-lab">🏆 Melhor dia agora</div><div class="hv-day">'+WD_NAME[cR]+'</div><div class="hv-stat"><b>'+nf1.format(sRec[cR].vndDia)+'</b> vendas/dia · ROAS <b>'+roasf(sRec[cR].roas)+'</b> · CAC '+money0(sRec[cR].cac)+'</div></div>'
    +'<div class="hv-box '+(changed?'alert':'ok')+'"><div class="hv-lab">'+(changed?'⚠️ O padrão mudou!':'✓ Padrão consistente')+'</div><div class="hv-msg">'+(changed
        ?'O melhor dia no histórico geral é <b>'+WD_NAME[cA]+'</b>, mas nas últimas <b>'+histWeeks+' semanas</b> quem lidera é <b>'+WD_NAME[cR]+'</b>. Vale mover orçamento pro novo campeão.'
        :'<b>'+WD_NAME[cR]+'</b> lidera tanto nas últimas '+histWeeks+' semanas quanto no histórico geral. Segue firme como melhor dia.')+'</div></div>'
    +'<div class="hv-box worst"><div class="hv-lab">🔻 Pior dia agora</div><div class="hv-day sm">'+WD_NAME[wR]+'</div><div class="hv-stat"><b>'+nf1.format(sRec[wR].vndDia)+'</b> vendas/dia · ROAS '+roasf(sRec[wR].roas)+'</div></div>'
    +'</div>';
  el('histRecentLbl').textContent='últimas '+histWeeks+' semanas · '+rec.length+' dias';
  el('histRankRecent').innerHTML=rankBars(sRec,rkR,rkA);
  el('histRankAll').innerHTML=rankBars(sAll,rkA,null);
  el('histHeat').innerHTML=histHeat(all);
  el('histTable').innerHTML=histTableHTML(sAll,sRec);
  Array.prototype.forEach.call(el('histWin').querySelectorAll('.hwbtn'),function(b){ b.classList.toggle('on',+b.getAttribute('data-w')===histWeeks); });
}
function initHistWin(){ if(!el('histWin'))return; el('histWin').innerHTML=[4,8,12].map(function(w){return '<button class="hwbtn" data-w="'+w+'">'+w+' sem</button>';}).join('');
  Array.prototype.forEach.call(el('histWin').querySelectorAll('.hwbtn'),function(b){ b.addEventListener('click',function(){ histWeeks=+b.getAttribute('data-w'); renderHistorico(); }); }); }

/* =================== CONSOLIDADO (funil simples) =================== */
function consCard(label,val,sub,cls){ return '<div class="cons-card'+(cls?' '+cls:'')+'"><div class="cc-l">'+label+'</div><div class="cc-v">'+val+'</div>'+(sub?'<div class="cc-s">'+sub+'</div>':'')+'</div>'; }
function renderConsolidado(rng){
  if(!el('consFunnel'))return;
  var am=aggDaily(META,rng), ag=aggDaily(GOOG,rng), ob=obAggFor(rng,null);
  var spend=am.spend+ag.spend, impr=am.impr+ag.impr, clicks=am.clicks+ag.clicks, lpv=am.lpv+ag.lpv, checkout=am.checkout+ag.checkout, sales=am.sales+ag.sales, rev=am.rev+ag.rev;
  var fatTotal=rev+ob.rev, roasOB=dv(fatTotal,spend), cac=dv(spend,sales), ticket=dv(rev,sales), conv=dv(sales,clicks);
  var ar='<div class="cons-arrow">›</div>';
  el('consFunnel').innerHTML=
    consCard('Impressões',intf(impr),'CPM '+money(dv(spend,impr)*1000))
    +ar+consCard('Cliques',intf(clicks),'CTR '+pct(dv(clicks,impr)*100))
    +ar+consCard('View LP',intf(lpv),'só Meta')
    +ar+consCard('Checkouts',intf(checkout),'só Meta')
    +ar+consCard('Vendas',intf(sales),'conv. '+pct(conv*100),'goal');
  el('consResults').innerHTML=
    consCard('Investimento total',money0(spend),'c/ imposto (Meta)')
    +consCard('Faturamento',money0(fatTotal),'MPI + order bump')
    +consCard('ROAS',roasf(roasOB),'c/ order bump','goal')
    +consCard('CAC',money0(cac),'custo por venda')
    +consCard('Ticket médio',money(ticket),'líquido (MPI)')
    +consCard('Taxa de conversão',pct(conv*100),'venda ÷ clique');
}

/* =================== OTIMIZAÇÃO MICRO (tendência alta/queda) =================== */
var microSel={camp:null,adset:null,ad:null}, microExp={};
function selkey(c,s,a){ return (c||'')+''+(s||'')+''+(a||''); }
function microMatch(r){ if(microSel.camp==null)return true; if(r.campaign!==microSel.camp)return false; if(microSel.adset!=null&&r.adset!==microSel.adset)return false; if(microSel.ad!=null&&r.ad!==microSel.ad)return false; return true; }
function microLabel(){ if(microSel.camp==null)return {t:'Todas as campanhas',s:'conta inteira · Meta + Google'};
  if(microSel.ad!=null)return {t:prettyName(microSel.ad),s:'anúncio · '+prettyName(microSel.camp)};
  if(microSel.adset!=null)return {t:prettyName(microSel.adset),s:'conjunto · '+prettyName(microSel.camp)};
  return {t:prettyName(microSel.camp),s:'campanha'}; }
function bucketSeries(rows){ var bd={}; rows.forEach(function(r){ var o=bd[r.date]||(bd[r.date]={spend:0,rev:0,sales:0}); o.spend+=r.spend;o.rev+=r.rev;o.sales+=r.sales; });
  var days=Object.keys(bd).sort(); if(!days.length)return [];
  var span=daysBetween(days[0],days[days.length-1])+1;
  if(span<=56)return days.map(function(d){var o=bd[d];return {date:d,label:fmtBR(d),spend:o.spend,rev:o.rev,sales:o.sales};});
  var start=days[0], bk={}; days.forEach(function(d){ var wi=Math.floor(daysBetween(start,d)/7); var o=bk[wi]||(bk[wi]={first:d,spend:0,rev:0,sales:0}); var s=bd[d]; o.spend+=s.spend;o.rev+=s.rev;o.sales+=s.sales; });
  return Object.keys(bk).map(function(k){return +k;}).sort(function(a,b){return a-b;}).map(function(k){var o=bk[k];return {date:o.first,label:fmtBR(o.first),spend:o.spend,rev:o.rev,sales:o.sales};}); }
function seriesAgg(series,metric){ var sp=0,rv=0,sl=0; series.forEach(function(b){sp+=b.spend;rv+=b.rev;sl+=b.sales;}); return metric==='spend'?sp:(metric==='rev'?rv:(metric==='sales'?sl:dv(rv,sp))); }
function trendPct(series,metric){ if(series.length<2)return null; var mid=Math.floor(series.length/2);
  var a=seriesAgg(series.slice(0,mid),metric), b=seriesAgg(series.slice(mid),metric);
  if(a==null||a===0||!isFinite(a))return null; return (b-a)/Math.abs(a)*100; }
function fpct(p){ return nf0.format(Math.round(Math.abs(p)))+'%'; }
function trendBadge(pct,dir){ if(pct==null)return '<span class="mt-na">—</span>';
  if(Math.abs(pct)<8)return '<span class="mt-eq">➡ '+fpct(pct)+'</span>';
  var up=pct>0; if(dir==='neutral')return '<span class="mt-neutral">'+(up?'▲':'▼')+' '+fpct(pct)+'</span>';
  var good=dir==='high'?up:!up; return '<span class="mt-'+(good?'up':'down')+'">'+(up?'▲':'▼')+' '+fpct(pct)+'</span>'; }
function rowTrendArrow(merged,camp,adset,ad){ var bd={}; merged.forEach(function(r){ if(r.date===maxDate)return; if(r.campaign!==camp)return; if(adset!=null&&r.adset!==adset)return; if(ad!=null&&r.ad!==ad)return; var o=bd[r.date]||(bd[r.date]={spend:0,rev:0}); o.spend+=r.spend;o.rev+=r.rev; });
  var days=Object.keys(bd).sort(); if(days.length<4)return '<span class="mt-na">·</span>';
  var mid=Math.floor(days.length/2); function ag(ds){var sp=0,rv=0;ds.forEach(function(d){sp+=bd[d].spend;rv+=bd[d].rev;});return dv(rv,sp);}
  var a=ag(days.slice(0,mid)),b=ag(days.slice(mid)); if(a===0)return '<span class="mt-na">·</span>';
  return trendBadge((b-a)/Math.abs(a)*100,'high'); }
function microChart(series){
  if(!series.length)return '<div class="empty">Sem dados no período pra este item.</div>';
  var W=780,H=250,pl=48,pr=44,pt=14,pb=28,pw=W-pl-pr,ph=H-pt-pb,base=pt+ph;
  var maxRS=Math.max.apply(null,series.map(function(b){return Math.max(b.spend,b.rev);}).concat([1]));
  var roas=series.map(function(b){return dv(b.rev,b.spend);}), maxRo=Math.max.apply(null,roas.concat([1]));
  var n=series.length||1, gw=pw/n, bw=Math.max(2,Math.min(16,gw*0.34));
  var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';
  [0,.5,1].forEach(function(f){ var y=pt+ph*(1-f); s+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#16281f" stroke-dasharray="2 3"/>';
    s+='<text x="'+(pl-5)+'" y="'+(y+3)+'" text-anchor="end" fill="#587567" font-size="9">'+money0(maxRS*f)+'</text>';
    s+='<text x="'+(W-pr+5)+'" y="'+(y+3)+'" text-anchor="start" fill="#c98a2a" font-size="9">'+nf1.format(maxRo*f)+'</text>'; });
  if(maxRo>0){ var y1=base-ph*clamp(1/maxRo); s+='<line x1="'+pl+'" y1="'+y1.toFixed(1)+'" x2="'+(W-pr)+'" y2="'+y1.toFixed(1)+'" stroke="rgba(35,194,134,.4)" stroke-dasharray="4 3"/>'; }
  series.forEach(function(b,i){ var xc=pl+gw*i+gw/2, sh=ph*dv(b.spend,maxRS), rh=ph*dv(b.rev,maxRS);
    if(b.spend>0)s+='<rect x="'+(xc-bw-1).toFixed(1)+'" y="'+(base-sh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+sh.toFixed(1)+'" rx="1.5" fill="rgba(91,157,255,.55)"/>';
    if(b.rev>0)s+='<rect x="'+(xc+1).toFixed(1)+'" y="'+(base-rh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+rh.toFixed(1)+'" rx="1.5" fill="rgba(35,194,134,.6)"/>'; });
  var pts=[]; series.forEach(function(b,i){ if(b.spend>0){var xc=pl+gw*i+gw/2,y=base-ph*clamp(roas[i]/maxRo);pts.push([xc,y]);} });
  if(pts.length>1)s+='<path d="M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L')+'" fill="none" stroke="'+COL.gold+'" stroke-width="2.2"/>';
  pts.forEach(function(p){s+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.6" fill="'+COL.gold+'"/>';});
  xticks(series).forEach(function(i){ var xc=pl+gw*i+gw/2; s+='<text x="'+xc.toFixed(1)+'" y="'+(H-7)+'" text-anchor="middle" fill="#587567" font-size="9">'+series[i].label+'</text>'; });
  s+=hitRects(series,pl,gw,pt,ph)+'</svg>';
  return '<div class="chart">'+s+'</div><div class="chart-legend"><span><span class="dot" style="background:rgba(91,157,255,.6)"></span>Investimento</span><span><span class="dot" style="background:rgba(35,194,134,.6)"></span>Faturamento</span><span><span class="ln" style="background:'+COL.gold+'"></span>ROAS</span><span style="color:var(--muted2)">tracejado = break-even</span></div>'; }
function microTile(label,val,pct,dir){ return '<div class="micro-tile"><div class="mtl-l">'+label+'</div><div class="mtl-v">'+val+'</div><div class="mtl-t">'+trendBadge(pct,dir)+'</div></div>'; }
function microRow(node,lvl,camp,adset,ad,hasKids,merged){
  var key=selkey(camp,adset,ad), sel=selkey(microSel.camp,microSel.adset,microSel.ad)===key, roas=dv(node.rev,node.spend);
  var caret=hasKids?'<span class="caret'+(microExp[key]?' open':'')+'">▶</span>':'<span class="caret" style="opacity:.2">•</span>';
  return '<tr class="mlvl'+lvl+(hasKids?' mparent':'')+(sel?' msel':'')+'" data-key="'+esc(key)+'" data-camp="'+encodeURIComponent(camp)+'" data-adset="'+encodeURIComponent(adset||'')+'" data-ad="'+encodeURIComponent(ad||'')+'" data-lvl="'+lvl+'">'
    +'<td><span class="name" title="'+esc(node.full||node.name)+'">'+caret+' '+esc(node.name)+'</span></td>'
    +'<td class="num">'+money0(node.spend)+'</td><td class="num">'+intf(node.sales)+'</td>'
    +'<td class="num">'+(node.spend>0?'<span class="roas-pill '+roasClass(roas)+'">'+roasf(roas)+'</span>':'—')+'</td>'
    +'<td class="num">'+rowTrendArrow(merged,camp,adset,ad)+'</td></tr>'; }
function renderMicro(rng){
  if(!el('microTree'))return;
  var merged=META._grain.concat(GOOG._grain).filter(function(r){return inRange(r.date,rng);});
  var camps=buildTree(merged), order=Object.keys(camps).sort(function(a,b){return camps[b].rev-camps[a].rev;});
  var out=[];
  order.forEach(function(cK){ var c=camps[cK],cHas=Object.keys(c.kids).length>0; out.push(microRow(c,0,cK,null,null,cHas,merged));
    if(microExp[selkey(cK,null,null)]){ Object.keys(c.kids).sort(function(a,b){return c.kids[b].rev-c.kids[a].rev;}).forEach(function(sK){ var sN=c.kids[sK],sHas=Object.keys(sN.kids).length>0; out.push(microRow(sN,1,cK,sK,null,sHas,merged));
      if(microExp[selkey(cK,sK,null)]){ Object.keys(sN.kids).sort(function(a,b){return sN.kids[b].rev-sN.kids[a].rev;}).forEach(function(aK){ out.push(microRow(sN.kids[aK],2,cK,sK,aK,false,merged)); }); } }); } });
  if(!out.length)out.push('<tr><td colspan="5" class="empty">Sem dados no período.</td></tr>');
  el('microTree').innerHTML='<thead><tr><th>Campanha › Conjunto › Anúncio</th><th>Gasto</th><th>Vendas</th><th>ROAS</th><th>Tendência (ROAS)</th></tr></thead><tbody>'+out.join('')+'</tbody>';
  var selAll=merged.filter(microMatch), forChart=selAll.filter(function(r){return r.date!==maxDate;}); if(!forChart.length)forChart=selAll;
  var series=bucketSeries(forChart), lb=microLabel(), rp=trendPct(series,'roas');
  var badge = (series.length<2||rp==null)?'':'<span class="micro-badge '+(Math.abs(rp)<8?'flat':(rp>0?'up':'down'))+'">'+(Math.abs(rp)<8?'➡ Estável':(rp>0?'📈 Em ALTA':'📉 Em QUEDA'))+'</span>';
  el('microTitle').innerHTML='<div><div class="mt-name">'+esc(lb.t)+'</div><div class="mt-sub">'+esc(lb.s)+'</div></div>'+badge+(microSel.camp!=null?'<button class="micro-reset" id="microReset">‹ conta inteira</button>':'');
  el('microTrend').innerHTML=microTile('Investimento',money0(seriesAgg(series,'spend')),trendPct(series,'spend'),'neutral')
    +microTile('Faturamento',money0(seriesAgg(series,'rev')),trendPct(series,'rev'),'high')
    +microTile('Vendas',intf(seriesAgg(series,'sales')),trendPct(series,'sales'),'high')
    +microTile('ROAS',roasf(seriesAgg(series,'roas')),rp,'high');
  el('microChart').innerHTML=microChart(series);
  bindHits('microChart',series,function(b){ return '<div class="tt-d">'+b.label+'</div><div class="tt-r"><span style="color:'+COL.meta+'">Investimento</span><b>'+money0(b.spend)+'</b></div><div class="tt-r"><span style="color:'+COL.grn2+'">Faturamento</span><b>'+money0(b.rev)+'</b></div><div class="tt-sub">Vendas '+intf(b.sales)+' · ROAS '+roasf(dv(b.rev,b.spend))+'</div>'; });
  var mt=el('microTree');
  Array.prototype.forEach.call(mt.querySelectorAll('tbody tr'),function(tr){ tr.addEventListener('click',function(e){
    var lvl=+tr.getAttribute('data-lvl'); if(isNaN(lvl))return; var key=tr.getAttribute('data-key');
    var onCaret=(e.target.classList&&e.target.classList.contains('caret'))||(e.target.closest&&e.target.closest('.caret'));
    if(onCaret){ if(tr.classList.contains('mparent')){ microExp[key]=!microExp[key]; renderMicro(rangeFor(period)); } return; }
    var camp=decodeURIComponent(tr.getAttribute('data-camp')), adset=tr.getAttribute('data-adset'), ad=tr.getAttribute('data-ad');
    adset=adset?decodeURIComponent(adset):''; ad=ad?decodeURIComponent(ad):'';
    microSel={camp:camp, adset:(lvl>=1?adset:null), ad:(lvl>=2?ad:null)};
    if(tr.classList.contains('mparent'))microExp[key]=true;
    renderMicro(rangeFor(period)); }); });
  var rst=el('microReset'); if(rst)rst.addEventListener('click',function(){ microSel={camp:null,adset:null,ad:null}; renderMicro(rangeFor(period)); });
}

/* =================== ORQUESTRAÇÃO =================== */
function renderSource(cfg,rng,prng){
  var a=aggDaily(cfg.S,rng), p=aggDaily(cfg.S,prng), days=daysInRange(cfg.S,rng);
  var ob=obAggFor(rng, cfg.pfx==='m'?'m':'g');
  renderKpi(cfg,a,p,ob); renderFunnel(cfg,a,p); renderChartSales(cfg,days); renderChartRoas(cfg,days);
  renderOBcard(cfg.pfx+'-', ob, a.sales, a.rev, a.spend);
  renderInsights(cfg,rng); renderDaily(cfg,rng); renderTree(cfg,rng);
}
function renderAll(){ var rng=rangeFor(period), prng=prevRange(rng);
  renderGeral(rng); renderSource(CFG.meta,rng,prng); renderSource(CFG.google,rng,prng);
  renderConsolidado(rng); renderMicro(rng); }

/* período UI */
function periodsHTML(){ return PRESETS.map(function(p){return '<button data-k="'+p.k+'" class="pbtn">'+p.label+'</button>';}).join('')
  +'<span class="daterange" id="daterange"><span class="dr-l">De</span> <input type="date" id="dtDe" min="'+minDate+'" max="'+maxDate+'"> <span class="dr-l">até</span> <input type="date" id="dtAte" min="'+minDate+'" max="'+maxDate+'"></span>'; }
function syncPeriodUI(){ var rng=rangeFor(period);
  Array.prototype.forEach.call(el('periods').querySelectorAll('.pbtn'),function(b){ b.classList.toggle('on',period===b.getAttribute('data-k')); });
  var dr=el('daterange'); if(dr)dr.classList.toggle('on',period==='custom');
  var de=el('dtDe'),at=el('dtAte'); if(de&&at){ de.value=rng[0]; at.value=rng[1]; } }
function initPeriods(){ el('periods').innerHTML=periodsHTML();
  Array.prototype.forEach.call(el('periods').querySelectorAll('.pbtn'),function(b){ b.addEventListener('click',function(){ period=b.getAttribute('data-k'); customRange=null; syncPeriodUI(); renderAll(); }); });
  var de=el('dtDe'),at=el('dtAte');
  function onDate(){ var s=de.value,e=at.value; if(!s||!e)return; if(s>e){var t=s;s=e;e=t;} if(s<minDate)s=minDate; if(e>maxDate)e=maxDate; customRange=[s,e]; period='custom'; syncPeriodUI(); renderAll(); }
  de.addEventListener('change',onDate); at.addEventListener('change',onDate); syncPeriodUI(); }

var TABS=['geral','consolidado','meta','google','micro','historico'];
function activateTab(id){ Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(x){x.classList.toggle('active',x.getAttribute('data-tab')===id);});
  TABS.forEach(function(k){ el('tab-'+k).classList.toggle('hidden',k!==id); }); }
function initTabs(){ Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(t){ t.addEventListener('click',function(){ var id=t.getAttribute('data-tab'); activateTab(id); if(history.replaceState)history.replaceState(null,'','#'+id); }); });
  var h=(location.hash||'').replace('#',''); if(TABS.indexOf(h)>=0)activateTab(h);
  window.addEventListener('hashchange',function(){ var k=(location.hash||'').replace('#',''); if(TABS.indexOf(k)>=0)activateTab(k); }); }
function initCoverage(){ el('updated').textContent=D.generatedAtBR||'—'; el('taxf').textContent=(D.taxMultiplier||1.1385).toFixed(4).replace('.',',');
  var tm=META.totals||{}, tg=GOOG.totals||{};
  el('coverage').innerHTML='Produto <b>MPI</b> · Meta '+fmtBR((META.dateMin||''))+' → '+fmtBR((META.dateMax||''))+' · Google '+fmtBR((GOOG.dateMin||''))+' → '+fmtBR((GOOG.dateMax||''))
    +' · <b>'+intf((tm.sales||0)+(tg.sales||0))+'</b> vendas MPI atribuídas ao tráfego pago ('+intf(tm.sales||0)+' Meta · '+intf(tg.sales||0)+' Google).'; }

if(!META.daily.length && !GOOG.daily.length){ el('coverage').innerHTML='<b>Sem dados.</b> Rode o build.ps1 para gerar o data.js.'; }
else { initCoverage(); initPeriods(); initTabs(); renderAll(); renderGoal(); initHistWin(); renderHistorico(); }
})();
