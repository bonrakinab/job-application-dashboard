"""Merge a reviewed public contact batch while retaining every existing record and ID."""
import json,re,unicodedata,hashlib,sys
from pathlib import Path
from urllib.parse import urlparse
from collections import Counter
p=Path('src/data/recruiters.json');old=json.loads(p.read_text());incoming=json.loads(Path(sys.argv[1]).read_text());previous=list(old['contacts']);seen={}
def key(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
alias={'staffworks':'staffworksltd','elbyprofessionalrecruitment':'elbyprofessionalrecruitment','altisrecruitmenttechnology':'altisrecruitmenttechnology'}
def ck(c):return key(c['name'])+':'+alias.get(key(c['company']),key(c['company']))
for c in previous:seen[ck(c)]=c
added=[]
for c in incoming:
 k=ck(c)
 if k in seen:continue
 c['id']='contact-'+hashlib.sha1(k.encode()).hexdigest()[:12];seen[k]=c;added.append(c)
old['contacts'].extend(added)
# Add company-level evidence for new agencies, matching existing domains where available.
for c in added:
 host=urlparse(c['source']).netloc.removeprefix('www.')
 a=next((a for a in old['agencies'] if key(a['name'])==key(c['company']) or urlparse(a.get('website','')).netloc.removeprefix('www.')==host),None)
 if a:continue
 old['agencies'].append({'id':'agency-'+hashlib.sha1(key(c['company']).encode()).hexdigest()[:12],'name':c['company'],'website':'https://'+urlparse(c['source']).netloc,'location':c['location'],'domains':[],'source':c['source'],'notes':'Ontario-serving staffing / recruitment firm. See named team contacts for published roles and individual specialties.'})
old['researchedAt']='October 31, 2026'
for u in dict.fromkeys(c['source'] for c in added):
 # Team-directory coverage provenance, not a claim that every team member is a technical recruiter.
 if u not in {s['url'] for s in old['coverageSources']}:old['coverageSources'].append({'name':next(c['company'] for c in added if c['source']==u)+' — public team source','url':u,'notes':'October 31 expansion: published recruitment, HR/TA and leadership/referral contacts. Individual titles and scope are retained; technical or permanent early-career mandates are not assumed.'})
# Preserve all original record payloads byte-for-byte at the JSON value level.
assert old['contacts'][:len(previous)]==previous
assert len({c['id'] for c in old['contacts']})==len(old['contacts'])
p.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'before':len(previous),'added':len(added),'total':len(old['contacts']),'companiesWithContacts':len({c['company'] for c in old['contacts']}),'newByCompany':dict(Counter(c['company'] for c in added))},indent=2))
