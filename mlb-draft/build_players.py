import json, math
from pathlib import Path
import pandas as pd
B='https://raw.githubusercontent.com/cbwinslow/lahman-database-csv/main/data/'
O=Path(__file__).parent/'data'/'players.json'; O.parent.mkdir(parents=True,exist_ok=True)
def csv(n): return pd.read_csv(B+n,low_memory=False).fillna(0)
def pct(s): return s.rank(pct=True,method='max')
def rate(d):
 a=d.AB; h=d.H; obpd=a+d.BB+d.HBP+d.SF; tb=h-d['2B']-d['3B']-d.HR+2*d['2B']+3*d['3B']+4*d.HR
 return h/a.replace(0,float('nan')), (h+d.BB+d.HBP)/obpd.replace(0,float('nan')), tb/a.replace(0,float('nan'))
pe=csv('People.csv'); ba=csv('Batting.csv'); pi=csv('Pitching.csv'); ap=csv('Appearances.csv'); aw=csv('AwardsPlayers.csv'); al=csv('AllstarFull.csv'); hf=csv('HallOfFame.csv')
for d in (ba,pi): d['lgID']=d.lgID.replace(0,'MLB')
bc=['G','AB','R','H','2B','3B','HR','RBI','SB','BB','HBP','SH','SF']; bs=ba.groupby(['playerID','yearID','lgID'],as_index=False)[bc].sum(); lg=bs.groupby(['yearID','lgID'],as_index=False)[bc].sum()
av,o,s=rate(bs); _,lo,ls=rate(lg); bs['PA']=bs.AB+bs.BB+bs.HBP+bs.SF+bs.SH; refs=bs[['yearID','lgID']].merge(lg.assign(lOBP=lo,lSLG=ls),on=['yearID','lgID']); bs['OPSplus']=100*((o/refs.lOBP)+(s/refs.lSLG)-1); bs.OPSplus=bs.OPSplus.clip(20,300).fillna(100)
hadj=(bs.assign(w=lambda x:x.OPSplus*x.PA).groupby('playerID').agg(w=('w','sum'),den=('PA','sum'))); hadj['OPSplus']=hadj.w/hadj.den
pc=['W','L','G','GS','SV','IPouts','H','ER','BB','SO']; ps=pi.groupby(['playerID','yearID','lgID'],as_index=False)[pc].sum(); pl=ps.groupby(['yearID','lgID'],as_index=False)[pc].sum(); ps['IP']=ps.IPouts/3; ps['ERA']=9*ps.ER/ps.IP.replace(0,float('nan')); pl['lIP']=pl.IPouts/3; pl['lERA']=9*pl.ER/pl.lIP.replace(0,float('nan')); ps=ps.merge(pl[['yearID','lgID','lERA']],on=['yearID','lgID']); ps['ERAplus']=(100*ps.lERA/ps.ERA).clip(20,300).fillna(300); ps['w']=ps.ERAplus*ps.IP; padj=ps.groupby('playerID').agg(w=('w','sum'),den=('IP','sum')); padj['ERAplus']=padj.w/padj.den
bat=ba.groupby('playerID')[bc].sum(); avg,obp,slg=rate(bat); bat['AVG']=avg;bat['OPS']=obp+slg;bat['PA']=bat.AB+bat.BB+bat.HBP+bat.SF+bat.SH;bat=bat[bat.PA>=500].join(hadj[['OPSplus']]).fillna({'OPSplus':100})
pit=pi.groupby('playerID')[pc].sum();pit['IP']=pit.IPouts/3;pit=pit[pit.IP>=100];pit['ERA']=9*pit.ER/pit.IP;pit['WHIP']=(pit.BB+pit.H)/pit.IP;pit['K9']=9*pit.SO/pit.IP;pit['BB9']=9*pit.BB/pit.IP;pit=pit.join(padj[['ERAplus']]).fillna({'ERAplus':100})
hs=.40*pct(bat.OPSplus)+.08*pct(bat.OPS)+.06*pct(bat.AVG)+.12*pct(bat.HR)+.08*pct(bat.H)+.07*pct(bat.RBI)+.05*pct(bat.R)+.05*pct(bat.BB)+.03*pct(bat.SB)+.06*pct(bat.G)
pscore=.38*pct(pit.ERAplus)+.10*(1-pct(pit.ERA))+.12*(1-pct(pit.WHIP))+.10*pct(pit.K9)+.04*(1-pct(pit.BB9))+.10*pct(pit.SO)+.08*pct(pit.IP)+.04*pct(pit.W)+.04*pct(pit.SV)
H={}
def hon(pid): return H.setdefault(pid,{'mvp':0,'cy':0,'gg':0,'allstar':0,'hof':False})
for _,r in aw.iterrows():
 a=str(r.awardID).lower();h=hon(r.playerID);h['mvp']+=int('most valuable' in a);h['cy']+=int('cy young' in a);h['gg']+=int('gold glove' in a)
for pid,n in al.groupby('playerID').yearID.nunique().items(): hon(pid)['allstar']=int(n)
for pid in hf[(hf.inducted=='Y')&(hf.category=='Player')].playerID: hon(pid)['hof']=True
names=pe.set_index('playerID').apply(lambda r:(str(r.nameFirst)+' '+str(r.nameLast)).strip(),axis=1).to_dict(); ag=ap.groupby('playerID').sum(numeric_only=True); yrs=pd.concat([ba[['playerID','yearID']],pi[['playerID','yearID']]]).groupby('playerID').yearID.agg(['min','max'])
def bonus(pid,k):
 h=hon(pid);c=min(1.8,h['allstar']*.12)+(1.8 if h['hof'] else 0);return min(7,c+(min(4.2,h['mvp']*1.4)+min(2,h['gg']*.2) if k=='H' else min(4.5,h['cy']*1.5)+min(1.6,h['mvp']*.8)+min(.8,h['gg']*.2)))
out=[]
for pid in set(hs.index)|set(pscore.index):
 htr=pid in hs; ptr=pid in pscore; a=ag.loc[pid] if pid in ag.index else pd.Series(dtype=float); pos=[]
 if htr:
  fld={'C':a.get('G_c',0),'1B':a.get('G_1b',0),'2B':a.get('G_2b',0),'SS':a.get('G_ss',0),'3B':a.get('G_3b',0),'OF':a.get('G_of',0)};mx=max(fld.values() or [0]);pos += [k for k,v in fld.items() if v>=200 or (mx and v>=.2*mx)]
  if not pos and a.get('G_dh',0)>0: pos=['DH']
 if ptr:
  p=pit.loc[pid];g=max(1,p.G);rel=(g-p.GS)/g
  if p.GS>=80 or p.GS/g>=.45: pos.append('SP')
  if rel>=.5 and g>=80: pos.append('RP')
  if p.SV>=60 or (p.SV>=30 and p.SV/g>=.10): pos.append('CL')
  if not any(x in pos for x in ['SP','RP','CL']): pos.append('RP' if rel>=.5 else 'SP')
 if not pos: continue
 hfval=50+42*(hs[pid]**.78)+bonus(pid,'H') if htr else -1; pfval=50+42*(pscore[pid]**.78)+bonus(pid,'P') if ptr else -1; kind='H' if hfval>=pfval else 'P'; ovr=max(50,min(99,round(max(hfval,pfval)))); hh=hon(pid)
 hv=None;pv=None
 if htr:
  b=bat.loc[pid];hv={'G':int(b.G),'H':int(b.H),'HR':int(b.HR),'RBI':int(b.RBI),'SB':int(b.SB),'AVG':round(b.AVG,3),'OPS':round(b.OPS,3),'OPSplus':round(b.OPSplus,1)}
 if ptr:
  p=pit.loc[pid];pv={'G':int(p.G),'W':int(p.W),'ERA':round(p.ERA,2),'WHIP':round(p.WHIP,2),'SO':int(p.SO),'SV':int(p.SV),'IP':round(p.IP,1),'ERAplus':round(p.ERAplus,1)}
 y=yrs.loc[pid] if pid in yrs.index else {'min':0,'max':0}; games=int((bat.loc[pid].G if kind=='H' else pit.loc[pid].G))
 out.append({'id':pid,'name':names.get(pid,pid),'kind':kind,'twoWay':htr and ptr,'positions':list(dict.fromkeys(pos)),'ovr':ovr,'careerGames':games,'firstYear':int(y['min']),'lastYear':int(y['max']),'hitting':hv,'pitching':pv,'honors':hh,'awardBonus':round(bonus(pid,kind),1)})
out.sort(key=lambda x:(-x['ovr'],-x['careerGames'],x['name'])); O.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8');print('wrote',len(out),'players')
if len(out)<600: raise SystemExit('not enough players')