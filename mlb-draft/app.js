const MLB_LOGO=id=>`https://www.mlbstatic.com/team-logos/${id}.svg`;
const TEAMS=[
['Arizona Diamondbacks','ARI',109],['Atlanta Braves','ATL',144],['Baltimore Orioles','BAL',110],['Boston Red Sox','BOS',111],['Chicago Cubs','CHC',112],['Chicago White Sox','CWS',145],['Cincinnati Reds','CIN',113],['Cleveland Guardians','CLE',114],['Colorado Rockies','COL',115],['Detroit Tigers','DET',116],['Houston Astros','HOU',117],['Kansas City Royals','KC',118],['Los Angeles Angels','LAA',108],['Los Angeles Dodgers','LAD',119],['Miami Marlins','MIA',146],['Milwaukee Brewers','MIL',158],['Minnesota Twins','MIN',142],['New York Mets','NYM',121],['New York Yankees','NYY',147],['Athletics','ATH',133],['Philadelphia Phillies','PHI',143],['Pittsburgh Pirates','PIT',134],['San Diego Padres','SD',135],['San Francisco Giants','SF',137],['Seattle Mariners','SEA',136],['St. Louis Cardinals','STL',138],['Tampa Bay Rays','TB',139],['Texas Rangers','TEX',140],['Toronto Blue Jays','TOR',141],['Washington Nationals','WSH',120]
].map(([name,abbr,id])=>({name,abbr,id,logo:MLB_LOGO(id)}));

const SLOT_DEFS=[
...Array.from({length:5},(_,i)=>({key:`SP${i+1}`,type:'SP',label:`선발 ${i+1}`})),
...Array.from({length:5},(_,i)=>({key:`RP${i+1}`,type:'RP',label:`불펜 ${i+1}`})),
{key:'CL',type:'CL',label:'마무리'},{key:'C',type:'C',label:'포수'},{key:'1B',type:'1B',label:'1루수'},
{key:'2B',type:'2B',label:'2루수'},{key:'SS',type:'SS',label:'유격수'},{key:'3B',type:'3B',label:'3루수'},
{key:'DH',type:'DH',label:'지명타자'},...Array.from({length:3},(_,i)=>({key:`OF${i+1}`,type:'OF',label:`외야수 ${i+1}`}))
];
const ROUNDS=SLOT_DEFS.length, TOTAL_PICKS=ROUNDS*TEAMS.length;
let allPlayers=[],state=null,selectedTeamIndex=0;
const $=id=>document.getElementById(id);

function init(){
 renderTeamGrid();
 $('startBtn').addEventListener('click',startDraft);
 $('newDraftBtn').addEventListener('click',resetApp);
 $('restartBtn').addEventListener('click',resetApp);
 $('autoToUserBtn').addEventListener('click',autoUntilUser);
 $('searchInput').addEventListener('input',renderPlayers);
 $('posFilter').addEventListener('change',renderPlayers);
 $('sortMode').addEventListener('change',renderPlayers);
 loadData();
}
function renderTeamGrid(){
 $('teamGrid').innerHTML=TEAMS.map((t,i)=>`<button class="team-card ${i===selectedTeamIndex?'selected':''}" data-team="${i}"><img src="${t.logo}" alt="${escapeHtml(t.name)} 로고"><span>${escapeHtml(t.name)}</span><b>${t.abbr}</b></button>`).join('');
 document.querySelectorAll('.team-card').forEach(el=>el.addEventListener('click',()=>{selectedTeamIndex=Number(el.dataset.team);renderTeamGrid()}));
}
async function loadData(){
 try{
  const r=await fetch('./data/players.json',{cache:'no-cache'});if(!r.ok)throw new Error('players.json load failed');
  allPlayers=await r.json();
  $('dataStatus').className='data-status ok';
  $('dataStatus').textContent=`역대 선수 ${allPlayers.length.toLocaleString()}명 로드 완료 · 시대보정/수상경력 OVR 적용`;
  $('startBtn').disabled=allPlayers.length<TOTAL_PICKS;
 }catch(e){
  console.error(e);$('dataStatus').className='data-status bad';
  $('dataStatus').textContent='선수 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
  $('startBtn').disabled=true;
 }
}
function resetApp(){state=null;$('draftView').classList.add('hidden');$('resultView').classList.add('hidden');$('setupView').classList.remove('hidden');$('autoToUserBtn').disabled=true}
function secureShuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){let r;if(window.crypto?.getRandomValues){const x=new Uint32Array(1);window.crypto.getRandomValues(x);r=x[0]/4294967296}else r=Math.random();const j=Math.floor(r*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function startDraft(){
 const userTeamIndex=selectedTeamIndex,order=secureShuffle([...Array(TEAMS.length).keys()]),teams=TEAMS.map((t,i)=>({...t,index:i,roster:{},picks:[]}));
 state={userTeamIndex,order,teams,available:new Set(allPlayers.map(p=>p.id)),history:[],pickIndex:0,complete:false};
 $('setupView').classList.add('hidden');$('draftView').classList.remove('hidden');
 $('myTeamName').textContent=`${TEAMS[userTeamIndex].name} · ${TEAMS[userTeamIndex].abbr}`;$('myTeamLogo').src=TEAMS[userTeamIndex].logo;$('autoToUserBtn').disabled=false;
 renderDraftOrder();renderAll();processAiTurns();
}
function renderDraftOrder(){const mySlot=state.order.indexOf(state.userTeamIndex)+1;$('myPickBadge').textContent=`내 1R 순번 ${mySlot}번`;$('draftOrder').innerHTML=state.order.map((teamIndex,i)=>{const t=state.teams[teamIndex],mine=teamIndex===state.userTeamIndex;return `<div class="order-team ${mine?'mine':''}"><span class="order-num">${i+1}</span><img src="${t.logo}" alt=""><b>${t.abbr}</b></div>`}).join('')}
function roundNumber(){return Math.floor(state.pickIndex/TEAMS.length)+1}
function pickInRound(){return state.pickIndex%TEAMS.length}
function currentTeamIndex(){const r=roundNumber(),idx=pickInRound();return r%2===1?state.order[idx]:state.order[TEAMS.length-1-idx]}
function overallPick(){return state.pickIndex+1}
function compatibleSlots(team,p){const empty=SLOT_DEFS.filter(s=>!team.roster[s.key]);return empty.filter(s=>p.positions.includes(s.type)||(s.type==='DH'&&p.kind==='H'))}
function slotUrgency(team,type){return SLOT_DEFS.filter(s=>s.type===type&&!team.roster[s.key]).length}
function missingTypes(team){const m={};SLOT_DEFS.forEach(s=>{if(!team.roster[s.key])m[s.type]=(m[s.type]||0)+1});return m}
function picksRemainingForTeam(team){return ROUNDS-team.picks.length}
function chooseSlot(team,p){const opts=compatibleSlots(team,p);if(!opts.length)return null;const nonDH=opts.filter(s=>s.type!=='DH');if(nonDH.length)return nonDH.sort((a,b)=>slotUrgency(team,b.type)-slotUrgency(team,a.type))[0];return opts[0]}
function draftPlayer(teamIndex,player,slotOverride=null){
 if(!state.available.has(player.id))return false;const team=state.teams[teamIndex],slot=slotOverride||chooseSlot(team,player);if(!slot)return false;
 team.roster[slot.key]=player;team.picks.push({player,slot:slot.key});state.available.delete(player.id);
 state.history.unshift({overall:overallPick(),round:roundNumber(),teamIndex,team:team.abbr,player,slot:slot.label});state.pickIndex++;
 if(state.pickIndex>=TOTAL_PICKS){finishDraft();return true}renderAll();return true;
}
function playerAdjustedIndex(p){return p.kind==='H'?(p.hitting?.OPSplus||100):(p.pitching?.ERAplus||100)}
function honorScore(p){const h=p.honors||{};return(h.mvp||0)*5+(h.cy||0)*5+(h.gg||0)*1.2+(h.allstar||0)*.7+(h.hof?8:0)}
function aiPick(teamIndex){
 const team=state.teams[teamIndex],miss=missingTypes(team),remaining=picksRemainingForTeam(team),forceNeed=remaining===Object.values(miss).reduce((a,b)=>a+b,0);
 let best=null,bestScore=-1e9;
 for(const p of allPlayers){
  if(!state.available.has(p.id))continue;const slots=compatibleSlots(team,p);if(!slots.length)continue;const fillsRequired=slots.some(s=>miss[s.type]>0);if(forceNeed&&!fillsRequired)continue;
  const bestSlot=[...slots].sort((a,b)=>slotUrgency(team,b.type)-slotUrgency(team,a.type))[0],needCount=miss[bestSlot.type]||0;
  let score=p.ovr+(playerAdjustedIndex(p)-100)*.025+Math.random()*3-1.5;if(needCount>0)score+=5+Math.min(9,needCount*1.8);
  if(bestSlot.type==='CL'&&roundNumber()<8)score-=2;if(bestSlot.type==='RP'&&roundNumber()<6)score-=1.5;score+=scarcityBonus(bestSlot.type,p.ovr);
  if(p.positions.length>1)score+=.8;if(p.twoWay)score+=.4;if(score>bestScore){bestScore=score;best={p,slot:bestSlot}}
 }
 if(best)draftPlayer(teamIndex,best.p,best.slot);
}
function scarcityBonus(type,ovr){let count=0,elite=0;for(const p of allPlayers){if(!state.available.has(p.id))continue;if(p.positions.includes(type)||(type==='DH'&&p.kind==='H')){count++;if(p.ovr>=ovr-3)elite++}}if(!count)return 0;return Math.max(0,Math.min(5,8/Math.sqrt(elite+1)))}
function processAiTurns(){if(!state||state.complete)return;while(currentTeamIndex()!==state.userTeamIndex&&!state.complete)aiPick(currentTeamIndex());renderAll()}
function autoUntilUser(){
 if(!state||state.complete)return;$('autoToUserBtn').disabled=true;
 if(currentTeamIndex()===state.userTeamIndex){const best=bestAutoForUser(state.teams[state.userTeamIndex]);if(best)draftPlayer(state.userTeamIndex,best.p,best.slot)}
 while(!state.complete&&currentTeamIndex()!==state.userTeamIndex)aiPick(currentTeamIndex());
 $('autoToUserBtn').disabled=state.complete;renderAll();
}
function bestAutoForUser(team){let best=null,bestScore=-Infinity;for(const p of allPlayers){if(!state.available.has(p.id))continue;const slot=chooseSlot(team,p);if(!slot)continue;const score=p.ovr+(missingTypes(team)[slot.type]?8:0)+scarcityBonus(slot.type,p.ovr)+(playerAdjustedIndex(p)-100)*.02;if(score>bestScore){bestScore=score;best={p,slot}}}return best}
function userDraft(id){if(currentTeamIndex()!==state.userTeamIndex||state.complete)return;const p=allPlayers.find(x=>x.id===id);if(!p)return;const team=state.teams[state.userTeamIndex],slot=chooseSlot(team,p);if(!slot){alert('현재 남은 로스터 슬롯에는 이 선수를 배치할 수 없습니다.');return}draftPlayer(state.userTeamIndex,p,slot);processAiTurns()}
window.userDraft=userDraft;
function renderAll(){if(!state)return;renderStatus();renderPlayers();renderRoster();renderHistory()}
function renderStatus(){
 if(state.complete)return;const ti=currentTeamIndex(),t=state.teams[ti];$('currentPickLabel').textContent=`Round ${roundNumber()} · Pick ${pickInRound()+1} · Overall ${overallPick()}`;$('currentTeamLabel').textContent=`${t.name} (${t.abbr})`;$('currentTeamLogo').src=t.logo;
 let n=0;for(let i=state.pickIndex;i<TOTAL_PICKS;i++){const r=Math.floor(i/TEAMS.length)+1,idx=i%TEAMS.length,team=r%2===1?state.order[idx]:state.order[TEAMS.length-1-idx];if(team===state.userTeamIndex){n=i-state.pickIndex;break}}
 $('untilUserPick').textContent=currentTeamIndex()===state.userTeamIndex?'지금 내 차례':`${n}픽`;$('remainingPlayers').textContent=state.available.size.toLocaleString();
}
function honorBadges(p){const h=p.honors||{},badges=[];if(h.hof)badges.push('<span class="honor hof">HOF</span>');if(h.mvp)badges.push(`<span class="honor mvp">MVP ×${h.mvp}</span>`);if(h.cy)badges.push(`<span class="honor cy">CY ×${h.cy}</span>`);if(h.gg)badges.push(`<span class="honor gg">GG ×${h.gg}</span>`);if(h.allstar)badges.push(`<span class="honor as">AS ×${h.allstar}</span>`);return badges.join('')}
function initials(name){return name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function fmtAvg(v){return Number(v||0).toFixed(3).replace(/^0/,'')}
function fmtOps(v){return Number(v||0).toFixed(3).replace(/^0/,'')}
function playerPhoto(p){return p.mlbam?`https://img.mlbstatic.com/mlb-photos/image/upload/w_220,q_auto:best,f_auto/v1/people/${p.mlbam}/headshot/67/current`:''}
function skillName(k){return({CON:'컨택',POW:'파워',DISC:'선구안',SPD:'주루',DEF:'수비',STF:'구위',CTL:'제구',STA:'이닝',CLU:'위기'})[k]||k}
function skillHtml(p){const s=p.skills||{};return `<div class="skills">${Object.entries(s).map(([k,v])=>`<div class="skill"><span>${skillName(k)}</span><div class="skill-track"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div><b>${v}</b></div>`).join('')}</div>`}
function adjustedLabel(p){return p.kind==='H'?`OPS+* ${Math.round(p.hitting?.OPSplus||100)}`:`ERA+* ${Math.round(p.pitching?.ERAplus||100)}`}
function renderPlayers(){
 if(!state)return;const q=$('searchInput').value.trim().toLowerCase(),pf=$('posFilter').value,sort=$('sortMode').value,myTurn=currentTeamIndex()===state.userTeamIndex;
 let arr=allPlayers.filter(p=>state.available.has(p.id)).filter(p=>!q||p.name.toLowerCase().includes(q)).filter(p=>pf==='ALL'||p.positions.includes(pf)||(pf==='DH'&&p.kind==='H'));
 if(sort==='ovr')arr.sort((a,b)=>b.ovr-a.ovr||playerAdjustedIndex(b)-playerAdjustedIndex(a));else if(sort==='adjusted')arr.sort((a,b)=>playerAdjustedIndex(b)-playerAdjustedIndex(a)||b.ovr-a.ovr);else if(sort==='awards')arr.sort((a,b)=>honorScore(b)-honorScore(a)||b.ovr-a.ovr);else if(sort==='name')arr.sort((a,b)=>a.name.localeCompare(b.name));else arr.sort((a,b)=>b.careerGames-a.careerGames);
 arr=arr.slice(0,180);const team=state.teams[state.userTeamIndex];
 $('playerCards').innerHTML=arr.map(p=>{const can=myTurn&&compatibleSlots(team,p).length>0,h=p.hitting,pt=p.pitching;const statline=p.kind==='H'?`<span><b>${(h?.H||0).toLocaleString()}</b> H</span><span><b>${(h?.HR||0).toLocaleString()}</b> HR</span><span><b>${fmtAvg(h?.AVG)}</b> AVG</span><span><b>${fmtOps(h?.OPS)}</b> OPS</span>`:`<span><b>${pt?.W||0}</b> W</span><span><b>${Number(pt?.ERA||0).toFixed(2)}</b> ERA</span><span><b>${(pt?.SO||0).toLocaleString()}</b> K</span><span><b>${pt?.SV||0}</b> SV</span>`;
 const photo=playerPhoto(p),avatar=photo?`<div class="avatar photo"><img loading="lazy" src="${photo}" alt="${escapeHtml(p.name)}" onerror="this.remove();this.parentElement.classList.remove('photo')"><span>${initials(p.name)}</span></div>`:`<div class="avatar"><span>${initials(p.name)}</span></div>`;
 return `<article class="player-card ${p.ovr>=95?'legend':''}"><div class="card-top">${avatar}<div class="card-id"><h3>${escapeHtml(p.name)}</h3><div class="career">${p.firstYear}–${p.lastYear}${p.twoWay?' · TWO-WAY':''}</div></div><div class="ovr-disc"><small>OVR</small>${p.ovr}</div></div><div class="pos-badges">${p.positions.map(x=>`<span class="badge">${x}</span>`).join('')}</div><div class="adjusted-index">${adjustedLabel(p)} <span>시대보정</span></div><div class="card-stats">${statline}</div>${skillHtml(p)}<div class="honors">${honorBadges(p)||'<span class="no-honor">주요 수상 없음</span>'}</div><div class="card-footer"><span class="bonus">수상 보너스 +${Number(p.awardBonus||0).toFixed(1)}</span><button class="draft-btn" ${can?'':'disabled'} onclick="userDraft('${p.id}')">지명</button></div></article>`}).join('');
}
function renderRoster(){const t=state.teams[state.userTeamIndex];$('rosterSlots').innerHTML=SLOT_DEFS.map(s=>{const p=t.roster[s.key];return `<div class="slot ${p?'filled':''}"><div class="slot-name">${s.label}</div><div class="slot-player">${p?`${escapeHtml(p.name)} · ${p.ovr}`:'-'}</div></div>`}).join('');const vals=t.picks.map(x=>x.player.ovr);$('teamAvgOvr').textContent=vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'-'}
function renderHistory(){$('draftHistory').innerHTML=state.history.slice(0,18).map(h=>{const t=state.teams[h.teamIndex];return `<div class="history-item"><span class="pick">#${h.overall}</span><img src="${t.logo}" alt=""><div><strong>${h.team}</strong> · ${escapeHtml(h.player.name)}<div class="muted">${h.slot} · ${adjustedLabel(h.player)}</div></div><span class="ovr">${h.player.ovr}</span></div>`}).join('')}
function finishDraft(){
 state.complete=true;$('draftView').classList.add('hidden');$('resultView').classList.remove('hidden');$('autoToUserBtn').disabled=true;
 const rankings=state.teams.map(t=>({name:t.name,abbr:t.abbr,logo:t.logo,avg:t.picks.reduce((s,x)=>s+x.player.ovr,0)/ROUNDS})).sort((a,b)=>b.avg-a.avg),userAbbr=state.teams[state.userTeamIndex].abbr,userRank=rankings.findIndex(x=>x.abbr===userAbbr)+1;
 $('resultSummary').innerHTML=`<div class="result-hero"><img src="${state.teams[state.userTeamIndex].logo}" alt=""><div><div class="big-status">${state.teams[state.userTeamIndex].name}</div><p>드래프트 OVR 순위 <b>${userRank}위</b></p></div></div><div class="ranking-list">${rankings.map((r,i)=>`<div class="ranking-row ${r.abbr===userAbbr?'mine':''}"><b>${i+1}</b><img src="${r.logo}" alt=""><span>${r.name}</span><strong>${r.avg.toFixed(1)}</strong></div>`).join('')}</div>`;
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
init();