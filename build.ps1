# =====================================================================
#  MPI - Dashboard de VENDAS (funil de venda direta)  -  data engine
#  Baixa 3 planilhas Google (CSV export): vendas + queries Meta + queries
#  Google/YouTube. Filtra o produto MPI, separa a venda pela origem
#  (utm_source: facebook-ads = Meta / google-ads = Google) e cruza com o
#  gasto de midia p/ calcular ROAS, CAC, ticket, funil e otimizacao.
#  Escreve data.js (window.MPI) lido pela pagina estatica (index.html).
#  Imposto (+13,85%) SO no Meta. Somente leitura - NAO altera planilhas.
#  ASCII-only de proposito (PS5.1 le .ps1 como ANSI; acentos so no front).
# =====================================================================
param([ValidateSet('all')][string]$Mode='all')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$BR = [Globalization.CultureInfo]::GetCultureInfo('pt-BR')
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# ---- Fontes (somente leitura) --------------------------------------
$VENDAS_ID  = '1BJ-T_Aj5oeMge667xWtX_SfGCSiibcFo7l0yLWTt_BQ'; $VENDAS_GID = '0'   # aba "vendas"
$META_ID    = '1sz1FSorsozC1pkSKJi8JGQai7-jj6-eOSk5oa65ng-k'; $META_GID   = '0'   # queries Meta
$GOOGLE_ID  = '1uXhxl7xafcdE8jLbA611a_KNYzEjipTEtpiP0HePD58'; $GOOGLE_GID = '0'   # queries Google/YouTube
$TAX = 1.1385      # imposto Meta (+13,85%) aplicado em TODO gasto de Meta
# produto MPI = venda direta principal (rotulo mudou ao longo do tempo)
$MPI_PRODUCTS = @('MAPA DO PRIMEIRO INVESTIMENTO (MPI)','MPI')
$SENT = 'SEM_RASTREIO'

function Get-Sheet($id,$gid,$out){
  $url = "https://docs.google.com/spreadsheets/d/$id/gviz/tq?tqx=out:csv&gid=$gid"
  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
  (New-Object System.Net.WebClient).DownloadFile($url,$out)
  if((Get-Item $out).Length -lt 30){ throw "Download muito pequeno: $out" }
}
Add-Type -AssemblyName Microsoft.VisualBasic
function Read-Csv($path){
  $rows = New-Object System.Collections.Generic.List[object]
  $p = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($path,[System.Text.Encoding]::UTF8)
  $p.TextFieldType='Delimited'; $p.SetDelimiters(','); $p.HasFieldsEnclosedInQuotes=$true
  while(-not $p.EndOfData){ try { $rows.Add($p.ReadFields()) } catch { } }
  $p.Close(); return $rows
}
function Norm($s){ if($null -eq $s){return ''}; return ($s -replace [char]0x200b,'').Trim() }
function MoneyBR($s){ $s=Norm $s; if($s -eq ''){return 0.0}
  $s = $s -replace '[R$\s]',''
  # pt-BR: 1.234,56  -> tira ponto de milhar, virgula vira ponto
  if($s -match ','){ $s = ($s -replace '\.','') -replace ',','.' }
  if($s -notmatch '^-?\d'){ return 0.0 }; return [double]$s }
function ToInt($s){ $s=Norm $s; if($s -eq ''){return 0}; $v=($s -replace '\.','' -replace ',','.'); if($v -notmatch '^-?\d'){return 0}; return [int][double]$v }
function Deaccent($s){ if($null -eq $s){return ''}; $s=$s.Normalize([Text.NormalizationForm]::FormD); $sb=New-Object Text.StringBuilder
  foreach($c in $s.ToCharArray()){ if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark){ [void]$sb.Append($c) } }
  return $sb.ToString().ToLower().Trim() }
function HdrLike($hdr,$frag){ for($i=0;$i -lt $hdr.Count;$i++){ if((Deaccent $hdr[$i]) -like $frag){ return $i } }; return -1 }
# vendas: "2024-11-21" OU "21/11/2024" OU "21/11/2024, 23:11:50" -> yyyy-mm-dd
function SaleDate($s){ $s=Norm $s
  if($s -match '^(\d{4})-(\d{2})-(\d{2})'){ return ('{0}-{1}-{2}' -f $Matches[1],$Matches[2],$Matches[3]) }
  if($s -match '^(\d{1,2})/(\d{1,2})/(\d{4})'){ return ('{0}-{1:d2}-{2:d2}' -f $Matches[3],[int]$Matches[2],[int]$Matches[1]) }
  return '' }
# google Day dd/mm/yyyy -> yyyy-mm-dd ; meta Date ja vem yyyy-mm-dd
function GDay($s){ $s=Norm $s; if($s -match '^(\d{1,2})/(\d{1,2})/(\d{4})'){ return ('{0}-{1:d2}-{2:d2}' -f $Matches[3],[int]$Matches[2],[int]$Matches[1]) }; if($s -match '^\d{4}-\d{2}-\d{2}'){ return $s.Substring(0,10) }; return '' }

# =====================================================================
#  Parse VENDAS uma vez, filtra MPI, separa por origem
# =====================================================================
Write-Host "Baixando planilhas..."
$vCsv=Join-Path $dataDir 'vendas.csv'; $mCsv=Join-Path $dataDir 'meta.csv'; $gCsv=Join-Path $dataDir 'google.csv'
Get-Sheet $VENDAS_ID $VENDAS_GID $vCsv
Get-Sheet $META_ID   $META_GID   $mCsv
Get-Sheet $GOOGLE_ID $GOOGLE_GID $gCsv

$v = Read-Csv $vCsv; $vh=$v[0]; $vd=$v[1..($v.Count-1)]
$V_PROD=HdrLike $vh 'produto'; $V_DATE=HdrLike $vh 'data'; $V_VAL=HdrLike $vh 'valor'; $V_FAT=HdrLike $vh 'faturamento'
$V_SRC=HdrLike $vh 'utm_source'; $V_MED=HdrLike $vh 'utm_medium'; $V_CONT=HdrLike $vh 'utm_content'; $V_TERM=HdrLike $vh 'utm_term'; $V_CAMP=HdrLike $vh 'utm_campaign'
foreach($pair in @(@('Produto',$V_PROD),@('Data',$V_DATE),@('Faturamento',$V_FAT),@('utm_source',$V_SRC),@('utm_campaign',$V_CAMP))){ if($pair[1] -lt 0){ throw ("Vendas: coluna nao encontrada: "+$pair[0]) } }

# order bumps do MPI (chave ASCII; front prettifica os acentos)
function ObKey($prod){ $p=Deaccent $prod
  if($p -like 'planilhas complementares mpi*'){ return 'planilhas' }
  if($p -eq 'investimentos no exterior'){ return 'exterior' }
  if($p -eq 'combo 3 em 1'){ return 'combo3' }
  if($p -eq 'criptomoedas'){ return 'cripto' }
  return '' }

$metaSales = New-Object System.Collections.Generic.List[object]
$googleSales = New-Object System.Collections.Generic.List[object]
$obSales = New-Object System.Collections.Generic.List[object]
$nSkip=0
foreach($r in $vd){
  if($r.Count -le $V_CAMP){ continue }
  $src = Deaccent $r[$V_SRC]
  if($src -ne 'facebook-ads' -and $src -ne 'google-ads'){ continue }   # so trafego pago (mesma regra do MPI)
  $d = SaleDate $r[$V_DATE]; if($d -eq ''){ continue }
  $prod = Norm $r[$V_PROD]
  $rev = MoneyBR $r[$V_FAT]; $gross = if($V_VAL -ge 0){ MoneyBR $r[$V_VAL] } else { $rev }
  $stag='g'; if($src -eq 'facebook-ads'){ $stag='m' }
  if($MPI_PRODUCTS -contains $prod){
    if($src -eq 'facebook-ads'){ $dst=$metaSales } else { $dst=$googleSales }
    $dst.Add([pscustomobject]@{ date=$d; rev=$rev; gross=$gross
      camp=(Norm $r[$V_CAMP]); term=(Norm $r[$V_TERM]); cont=(Norm $r[$V_CONT]); med=(Norm $r[$V_MED]) })
  } else {
    $ok = ObKey $prod
    if($ok -ne ''){ $obSales.Add([pscustomobject]@{ date=$d; k=$ok; src=$stag; rev=$rev; gross=$gross }) }
    else { $nSkip++ }
  }
}
# agrega OB por dia x produto x origem (period-reactive no front)
$obAgg=@{}
foreach($s in $obSales){ $key="$($s.date)`u$($s.k)`u$($s.src)"
  if(-not $obAgg.ContainsKey($key)){ $obAgg[$key]=[pscustomobject]@{date=$s.date;k=$s.k;src=$s.src;sales=0;rev=0.0;gross=0.0} }
  $o=$obAgg[$key]; $o.sales++; $o.rev+=$s.rev; $o.gross+=$s.gross }
$obDaily=@()
foreach($o in ($obAgg.Values | Sort-Object date)){ $obDaily += [pscustomobject]@{ d=$o.date; k=$o.k; src=$o.src; s=[int]$o.sales; r=[math]::Round($o.rev,2); g=[math]::Round($o.gross,2) } }
Write-Host ("Vendas MPI: Meta={0}  Google={1}  |  Order bumps: {2} vendas ({3} linhas/dia-produto)" -f $metaSales.Count,$googleSales.Count,$obSales.Count,$obDaily.Count)

# =====================================================================
#  Build-Source: cruza queries x vendas de uma origem
#   $cfg: hasLpv, hasCheckout, tax (bool aplica *TAX no gasto)
# =====================================================================
function MatchName($val,$deMap){ $vd=Deaccent $val; if($vd -eq ''){return ''}; if($deMap.ContainsKey($vd)){return $deMap[$vd]}; return '' }

function Build-Source($qRows,$qh,$sales,$cfg){
  $Q_CAMP=HdrLike $qh 'campaign name'
  $Q_SET = if($cfg.hasLpv){ HdrLike $qh 'adset name' } else { HdrLike $qh 'ad group name' }
  $Q_AD  =HdrLike $qh 'ad name'
  $Q_SPEND = HdrLike $qh '*spend*'; if($Q_SPEND -lt 0){ $Q_SPEND=HdrLike $qh '*cost*' }
  $Q_IMP=HdrLike $qh 'impressions'
  $Q_CLK = HdrLike $qh '*link clicks*'; if($Q_CLK -lt 0){ $Q_CLK=HdrLike $qh 'clicks' }
  $Q_DAY = HdrLike $qh 'date'; if($Q_DAY -lt 0){ $Q_DAY=HdrLike $qh 'day' }
  $Q_LPV = if($cfg.hasLpv){ HdrLike $qh '*landing page view*' } else { -1 }
  $Q_CHK = if($cfg.hasCheckout){ HdrLike $qh '*checkout*' } else { -1 }
  foreach($pair in @(@('Campaign',$Q_CAMP),@('Ad',$Q_AD),@('Spend',$Q_SPEND),@('Impr',$Q_IMP),@('Clicks',$Q_CLK),@('Day',$Q_DAY))){ if($pair[1] -lt 0){ throw ("Query: coluna nao encontrada: "+$pair[0]) } }

  # ---- mapas de nome p/ atribuicao (deaccent -> nome real) + pares/triplas validas ----
  $campDe=@{}; $adDe=@{}; $setDe=@{}; $qPair=@{}; $qTriple=@{}
  foreach($r in $qRows){ if($r.Count -le $Q_AD){continue}
    $cn=Norm $r[$Q_CAMP]; $sn=Norm $r[$Q_SET]; $an=Norm $r[$Q_AD]
    if($cn -ne ''){ $k=Deaccent $cn; if(-not $campDe.ContainsKey($k)){$campDe[$k]=$cn} }
    if($an -ne ''){ $k=Deaccent $an; if(-not $adDe.ContainsKey($k)){$adDe[$k]=$an} }
    if($sn -ne ''){ $k=Deaccent $sn; if(-not $setDe.ContainsKey($k)){$setDe[$k]=$sn} }
    if($cn -ne '' -and $sn -ne ''){ $qPair["$cn`u$sn"]=$true; if($an -ne ''){ $qTriple["$cn`u$sn`u$an"]=$true } }
  }

  # ---- daily + grain a partir das queries (gasto/impr/cliques/lpv/checkout) ----
  $daily=@{}; $grain=@{}
  function _gd($h,$d){ if(-not $h.ContainsKey($d)){ $h[$d]=[pscustomobject]@{date=$d;spendRaw=0.0;spend=0.0;impr=0;clicks=0;lpv=0;checkout=0;sales=0;rev=0.0;gross=0.0} }; return $h[$d] }
  function _gg($h,$k,$d,$c,$s,$a){ if(-not $h.ContainsKey($k)){ $h[$k]=[pscustomobject]@{date=$d;campaign=$c;adset=$s;ad=$a;spendRaw=0.0;spend=0.0;impr=0;clicks=0;lpv=0;checkout=0;sales=0;rev=0.0;gross=0.0} }; return $h[$k] }
  $mult = if($cfg.tax){ $TAX } else { 1.0 }
  foreach($r in $qRows){ if($r.Count -le $Q_AD){continue}
    $d=GDay $r[$Q_DAY]; if($d -notmatch '^\d{4}-\d{2}-\d{2}$'){continue}
    $spRaw=MoneyBR $r[$Q_SPEND]; $sp=$spRaw*$mult; $im=ToInt $r[$Q_IMP]; $ck=ToInt $r[$Q_CLK]
    $lp= if($Q_LPV -ge 0){ ToInt $r[$Q_LPV] } else { 0 }
    $chk= if($Q_CHK -ge 0){ ToInt $r[$Q_CHK] } else { 0 }
    $cn=Norm $r[$Q_CAMP]; $sn=Norm $r[$Q_SET]; $an=Norm $r[$Q_AD]
    $o=_gd $daily $d; $o.spendRaw+=$spRaw;$o.spend+=$sp;$o.impr+=$im;$o.clicks+=$ck;$o.lpv+=$lp;$o.checkout+=$chk
    $key="$d`u$cn`u$sn`u$an"
    $g=_gg $grain $key $d $cn $sn $an; $g.spendRaw+=$spRaw;$g.spend+=$sp;$g.impr+=$im;$g.clicks+=$ck;$g.lpv+=$lp;$g.checkout+=$chk
  }

  # ---- vendas: soma no daily e atribui no grain (campanha/conjunto/anuncio) ----
  $attr=0
  foreach($s in $sales){
    $d=$s.date
    $o=_gd $daily $d; $o.sales++; $o.rev+=$s.rev; $o.gross+=$s.gross
    $cName=MatchName $s.camp $campDe
    if($cName -eq ''){ $cName=$SENT; $sName=$SENT; $aName=$SENT }
    else {
      # conjunto pelo utm_term, anuncio pelo utm_content; exige co-localizacao com o gasto
      $sName=MatchName $s.term $setDe
      $aName=MatchName $s.cont $adDe
      if($sName -eq '' -or -not $qPair.ContainsKey("$cName`u$sName")){ $sName=$SENT; $aName=$SENT }
      elseif($aName -eq '' -or -not $qTriple.ContainsKey("$cName`u$sName`u$aName")){ $aName=$SENT }
      $attr++
    }
    $key="$d`u$cName`u$sName`u$aName"
    $g=_gg $grain $key $d $cName $sName $aName; $g.sales++; $g.rev+=$s.rev; $g.gross+=$s.gross
  }

  $dailyArr=@($daily.Values | Sort-Object date)
  $grainArr=@($grain.Values | Where-Object { $_.spend -gt 0 -or $_.sales -gt 0 })
  $qDates=@($dailyArr | Where-Object { ($_.spend -gt 0 -or $_.impr -gt 0) -and $_.date -match '^\d{4}-\d{2}-\d{2}$' } | ForEach-Object { $_.date } | Sort-Object)
  $sDates=@($sales | ForEach-Object { $_.date } | Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}$' } | Sort-Object)

  function _sum($arr,$p){ $x=($arr|Measure-Object $p -Sum).Sum; if($null -eq $x){return 0}; return $x }
  $tot=[pscustomobject]@{
    spendRaw=(_sum $dailyArr 'spendRaw'); spend=(_sum $dailyArr 'spend'); impr=(_sum $dailyArr 'impr'); clicks=(_sum $dailyArr 'clicks')
    lpv=(_sum $dailyArr 'lpv'); checkout=(_sum $dailyArr 'checkout'); sales=(_sum $dailyArr 'sales'); rev=(_sum $dailyArr 'rev'); gross=(_sum $dailyArr 'gross')
    salesAttr=$attr
  }

  # ---- intern de nomes p/ enxugar o grain ----
  $names=New-Object System.Collections.Generic.List[string]; $nameIdx=@{}
  function _ni($nm){ if(-not $nameIdx.ContainsKey($nm)){ $nameIdx[$nm]=$names.Count; $names.Add($nm) }; return $nameIdx[$nm] }
  $gOut=@()
  foreach($g in $grainArr){
    $gOut += [pscustomobject]@{ d=$g.date; c=(_ni $g.campaign); s=(_ni $g.adset); a=(_ni $g.ad)
      sp=[math]::Round($g.spend,2); spr=[math]::Round($g.spendRaw,2); im=[int]$g.impr; ck=[int]$g.clicks; lp=[int]$g.lpv; chk=[int]$g.checkout; vn=[int]$g.sales; rv=[math]::Round($g.rev,2); gr=[math]::Round($g.gross,2) }
  }
  $dOut=@()
  foreach($o in $dailyArr){
    $dOut += [pscustomobject]@{ date=$o.date; spend=[math]::Round($o.spend,2); spendRaw=[math]::Round($o.spendRaw,2); impr=[int]$o.impr; clicks=[int]$o.clicks; lpv=[int]$o.lpv; checkout=[int]$o.checkout; sales=[int]$o.sales; rev=[math]::Round($o.rev,2); gross=[math]::Round($o.gross,2) }
  }

  return [pscustomobject]@{
    dateMin=$(if($qDates.Count){$qDates[0]}else{''}); dateMax=$(if($qDates.Count){$qDates[-1]}else{''})
    salesDateMin=$(if($sDates.Count){$sDates[0]}else{''}); salesDateMax=$(if($sDates.Count){$sDates[-1]}else{''})
    totals=$tot; names=@($names); daily=@($dOut); grain=@($gOut)
  }
}

# ---- roda as duas origens ------------------------------------------
$mAll = Read-Csv $mCsv; $mBuilt = Build-Source $mAll[1..($mAll.Count-1)] $mAll[0] $metaSales @{ hasLpv=$true; hasCheckout=$true; tax=$true }
$gAll = Read-Csv $gCsv; $gBuilt = Build-Source $gAll[1..($gAll.Count-1)] $gAll[0] $googleSales @{ hasLpv=$false; hasCheckout=$false; tax=$false }

$nowIso=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$nowBR=[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'E. South America Standard Time').ToString('dd/MM/yyyy HH:mm')
$utf8=[System.Text.UTF8Encoding]::new($false)

$payload=[pscustomobject]@{
  generatedAt=$nowIso; generatedAtBR=$nowBR; taxMultiplier=$TAX; product='MPI'
  meta=$mBuilt; google=$gBuilt
  ob=[pscustomobject]@{ daily=@($obDaily) }
}
$json=$payload | ConvertTo-Json -Depth 12 -Compress
[IO.File]::WriteAllText((Join-Path $root 'data.js'), ("window.MPI="+$json+";"), $utf8)

Write-Host ("OK  META  dias={0} grain={1} vendas={2} attrib={3}  gasto+imp=R$ {4}  fat=R$ {5}" -f `
  $mBuilt.daily.Count,$mBuilt.grain.Count,$mBuilt.totals.sales,$mBuilt.totals.salesAttr,($mBuilt.totals.spend.ToString('N2',$BR)),($mBuilt.totals.rev.ToString('N2',$BR)))
Write-Host ("OK  GOOGLE dias={0} grain={1} vendas={2} attrib={3}  gasto=R$ {4}  fat=R$ {5}" -f `
  $gBuilt.daily.Count,$gBuilt.grain.Count,$gBuilt.totals.sales,$gBuilt.totals.salesAttr,($gBuilt.totals.spend.ToString('N2',$BR)),($gBuilt.totals.rev.ToString('N2',$BR)))
