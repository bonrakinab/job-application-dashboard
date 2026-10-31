"""Import published agency team cards; requires beautifulsoup4 and a cached-source directory.
Usage: python scripts/recruiter-research/expand-network.py <cache-dir>
Only explicit names/titles/contact details are imported. Existing IDs and records are preserved.
"""
import json,re,sys,hashlib,unicodedata
from pathlib import Path
from urllib.parse import urljoin,unquote,urlparse
from collections import Counter
from bs4 import BeautifulSoup
root=Path(sys.argv[1]);sources=json.loads((root/'sources.json').read_text());new=[]
def soup(k):return BeautifulSoup((root/(k+'.html')).read_text(),'html.parser')
def txt(n):return n.get_text(' ',strip=True) if n else ''
def kind(title):
 if re.search(r'\bHR\b|human resources|talent acquisition|people.*culture',title,re.I):return 'HR / talent acquisition'
 if re.search(r'recruit|placement|employment specialist|staffing consultant|personnel consultant',title,re.I):return 'Recruiter / staffing consultant'
 return 'Leadership / referral contact'
def photo(n):
 im=n.find('img')
 if im:
  for f in ['data-src','nitro-lazy-src','src']:
   u=im.get(f,'')
   if u.startswith('http'):return u
 style=str(n)
 m=re.search(r'background-image:\s*url\([\"\']?(https?[^)\"\']+)',style)
 return m.group(1) if m else ''
def links(n):
 result={'email':'','phone':'','linkedin':''}
 for a in n.select('a[href]'):
  h=a['href']
  if h.startswith('mailto:'):result['email']=unquote(h[7:].split('?')[0])
  elif h.startswith('tel:'):result['phone']=txt(a) if re.search(r'\d{3}',txt(a)) else unquote(h[4:])
  elif 'linkedin.com/in/' in h:result['linkedin']=h
  elif '/cdn-cgi/l/email-protection#' in h:
   try:
    b=bytes.fromhex(h.split('#')[1]);result['email']=''.join(chr(x^b[0]) for x in b[1:])
   except (ValueError,IndexError):pass
 return result
def domains(s):
 out=[]
 for p,d in [('information technology|technology|IT contract|IT client','IT Support'),('administration|administrative|office support','Administrative'),('human resources|\\bHR\\b','Human Resources'),('accounting|finance|payroll','Finance & Accounting'),('marketing|communications|sales','Sales & Marketing'),('construction|engineering|manufactur|industrial|operations','Engineering & Operations'),('government','Government'),('legal|compliance','Legal & Compliance')]:
  if re.search(p,s,re.I):out.append(d)
 return out

def add(k,n,name,title,company,location,ds=None,source=None,notes=''):
 if not name or not title or len(name)>70:raise ValueError((k,name,title))
 c=dict(name=name,company=company,title=title,location=location,domains=ds or [],source=source or sources[k],verification='Official agency team page · checked Oct 31, 2026',notes=notes or 'Publicly listed staffing-company professional. Confirm the appropriate desk, current mandates and permanent early-career availability.',photo=photo(n),checked_at='2026-10-31',contactKind=kind(title),**links(n))
 new.append(c)
# Recruiting in Motion: explicitly retain only Ontario office cards, not BC cards or marketing/accounting support staff.
for m in soup('rim').select('.wpt-teamprofiles-member'):
 name=txt(m.select_one('.wpt-teamprofiles-name'));title=txt(m.select_one('.wpt-teamprofiles-title'));loc=txt(m.select_one('.wpt-teamprofiles-category')).replace('Location:','').strip();special=txt(m.select_one('.wpt-teamprofiles-division')).replace('Specialization:','').strip()
 if 'Ontario' not in loc or not re.search(r'recruit|placement|partner|human resources|talent acquisition|HR',title,re.I):continue
 add('rim',m,name,title,'Recruiting in Motion',loc,domains(special),notes=('Published desk specialties: '+special+'. ' if special else 'Individual desk specialty is not published. ')+('HR/internal team: request a referral to the relevant candidate-facing recruiter. ' if 'talent acquisition' in title.lower() else '')+'Confirm permanent early-career mandates.')
# LRO Staffing: complete public recruitment and leadership cards, excluding unrelated internal creative/office staff.
for m in soup('lro').select('.team__card'):
 name=txt(m.select_one('.team__card-name-text'));title=txt(m.select_one('.team__card-title'))
 if not re.search(r'recruit|director|partner|CEO|account executive|manager.*IT',title,re.I) or re.search(r'graphic|creative|communications & DEI|branding',title,re.I):continue
 add('lro',m,name,title,'LRO Staffing','Ottawa / Toronto agency; individual office to confirm',domains(title),m.get('href'),notes='Published team role; exact office and client mandate should be confirmed. '+('Contract-focused title; permanent placement fit unconfirmed.' if 'contract' in title.lower() else 'Permanent early-career availability unconfirmed.'))
# IQ PARTNERS: factual team-card identity and title. Do not manufacture desk specialties from company-wide sectors.
for m in soup('iq').select('.sorting-item'):
 a=m.select_one('.personal-info a');p=m.select_one('.position')
 if not a or not p:continue
 name=' '.join(str(v).strip() for v in a.find_all(string=True,recursive=False)).strip();title=txt(p)
 if not re.search(r'recruit|partner|client services|operations',title,re.I):continue
 add('iq',m,name,title,'IQ PARTNERS','Toronto-headquartered agency; individual office to confirm',domains(title),a['href'],notes='Published agency role. Agency primarily advertises mid-to-senior searches; early-career fit unconfirmed. Ask for a desk referral when relevant.')
# TDS: named consultant cards with explicitly published titles and email addresses.
for h in soup('tds').find_all('h3'):
 n=h.parent.parent
 if not n.find(['h5','h6']):continue
 title=txt(n.find(['h5','h6']))
 if 'Finance Manager' in title:continue
 card=n.parent
 add('tds',card,txt(h),title,'TDS Personnel','Toronto, Ontario',domains(title))
# ABL team publishes names and LinkedIn links, but not individual job titles. Keep that uncertainty visible.
for m in soup('abl').select('.bdt-flip-box'):
 h=m.find('h3')
 if not h:continue
 add('abl',m,txt(h),'Staffing team member — title not published','ABL Employment','Ontario / BC agency; Ontario desk to confirm',[],notes='Official team listing with public LinkedIn. Individual title, location and hiring specialty are not published on this page; verify Ontario coverage before outreach.')
for m in soup('staffworks').select('.team__item'):
 title=txt(m.select_one('.team__position'))
 if not re.search(r'recruit|sales|founder|president|operations',title,re.I):continue
 add('staffworks',m,txt(m.select_one('.team__name')),title,'Staffworks','Toronto / Ontario agency',domains(title))
for m in soup('strive').select('.team-member-container'):
 h=m.find('h3');t=m.find('h4')
 if not h or not t:continue
 add('strive',m,txt(h),txt(t),'STRIVE Recruitment','GTA, Ontario',domains(txt(t)))
for m in soup('epc').select('.wpt-teamprofiles-member'):
 title=txt(m.select_one('.wpt-teamprofiles-title'))
 if not re.search(r'president|human resources|employment specialist|operations',title,re.I):continue
 add('epc',m,txt(m.select_one('.wpt-teamprofiles-name')),title,'Employment Professionals Canada','Thorold, Ontario',domains(title))
for h in soup('e3').find_all('h2'):
 if txt(h) not in ['Grant Molyneux','Reta Youhana','Steve Faroni','Morgan Malott']:continue
 p=h.parent;title=txt(p.find('i'))
 if not title:continue
 add('e3',p,txt(h),title,'E3 Work Solutions','Windsor–Essex, Ontario',domains(title))
for m in soup('power').select('figure.gallery-item'):
 cap=m.find('figcaption');sp=cap.find('span') if cap else None
 if not sp:continue
 title=txt(sp);name=' '.join(cap.find_all(string=True,recursive=False)).strip()
 if title=='CFO':continue
 add('power',m,name,title,'Power Staffing Solutions','Toronto, Ontario',[],notes='Staffing-company leadership / referral contact. Agency offers IT, office/professional and healthcare recruitment; individual candidate-facing scope is not established.')
# BJRC cards explicitly indicate Toronto vs Montreal; exclude Montreal-only contacts.
s=soup('bjrc')
for h in s.select('.fiche-nom'):
 m=h.find_parent('article');loc=txt(m.select_one('.fiche-ville'))
 if 'Toronto' not in loc:continue
 a=h.find('a');t=txt(m.select_one('.fiche-role'))
 add('bjrc',m,txt(h),t,'BJRC Recruiting',loc,['Legal & Compliance'] if 'Legal' in t else [],urljoin(sources['bjrc'],a['href']))
 if new[-1]['photo'].startswith('/'):new[-1]['photo']=urljoin(sources['bjrc'],new[-1]['photo'])
# Fast Track: HR consultants are referral contacts, not assumed technical recruiters.
for m in soup('fasttrack').select('.elementor-image-box-wrapper'):
 title=txt(m.select_one('.elementor-image-box-description'));name=txt(m.find('h3'))
 if not name or 'HR Consultant' not in title:continue
 add('fasttrack',m,name,title,'Fast Track Staffing','Ottawa, Ontario',[],notes='HR consulting / government staffing professional. Technical candidate placement is unconfirmed; ask for a referral to the appropriate desk.')
# Explicitly Ontario-responsible OpTalent associate; published name/title/email from the team's matching section.
s=soup('optalent');h=s.find('h4',string='Philippe Mercure')
if h:
 m=h
 while m.parent and 'philippe@optalent.ca' not in txt(m):m=m.parent
 add('optalent',m,'Philippe Mercure','Associate — Ontario operations','OpTalent','Ontario operations',[],notes='Official bio explicitly identifies responsibility for Ontario operations. Recruitment/HR referral contact; confirm current candidate mandates.')
# Elby: complete published Ontario team; their practice is finance/accounting and executive recruitment.
for m in soup('elby').select('.wpt-teamprofiles-member'):
 title=txt(m.select_one('.wpt-teamprofiles-title'))
 if not re.search(r'recruit|partner|consultant|director|manager|acquisition|HR|president|client services',title,re.I):continue
 add('elby',m,txt(m.select_one('.wpt-teamprofiles-name')),title,'Elby Professional Recruitment','Burlington / Kitchener / Mississauga agency',['Finance & Accounting'],notes='Ontario staffing-company team. Agency specializes in finance/accounting and executive searches; request a relevant desk referral rather than assuming technical vacancies.')
# Clarity: structured person / role paragraphs, including internal People & Culture and TA staff.
for p in soup('clarity').find_all('p'):
 if not txt(p).startswith('My 9-5:'):continue
 m=p.find_parent(class_='elementor-widget-wrap');paras=m.find_all('p');name=txt(paras[0]);title=txt(p).removeprefix('My 9-5:').strip()
 if not re.search(r'recruit|search|talent|people|operations|client services|engagement',title,re.I):continue
 add('clarity',m,name,title,'Clarity Recruitment','Toronto-headquartered Ontario agency',['Finance & Accounting'] if not re.search('people|talent acquisition|operations',title,re.I) else [],notes='Published agency team role. Agency focuses on finance/accounting; People & Culture and internal talent contacts may provide a referral. Specific early-career mandates unconfirmed.')
for m in soup('altis').select('.why-altis_block'):
 h=m.find('h2');name=txt(h)
 if not h or not any(x in name for x in ['Kathryn','Erin']):continue
 name,title=name.split(',',1)
 add('altis',m,name.strip(),title.strip(),'Altis Recruitment & Technology','Ontario / Canada agency leadership',[],notes='Staffing-company leadership contact; request referral to the appropriate recruiter. No direct personal email published here.')
for h in soup('hays').find_all('h3'):
 line=txt(h)
 if '|' not in line:continue
 name,title=[x.strip() for x in line.split('|',1)]
 if name not in ["Travis O'Rourke",'Louisa Benedicto','Gillian Grand','Steve McVay','Andrea MacMillan']:continue
 m=h.parent
 add('hays',m,name,title,'Hays Canada','Canada-wide / Ontario-serving mandate',[],notes=('Head of People & Culture; internal HR / referral contact, not an assumed candidate-facing technical recruiter.' if name=='Andrea MacMillan' else 'National recruitment leadership. Confirm Ontario desk and early-career permanent fit; request the appropriate recruiter referral.'))
for m in soup('adecco').select('.avatar-wrapper'):
 name=txt(m.select_one('.avatar-title'));title=txt(m.select_one('.avatar-subtitle'))
 if name not in ['Gary Hayman','Amy Clemens','Eileen Gittens','Nicolette Mueller','John Cappelli','Theresa Bell']:continue
 add('adecco',m,name,title,'Adecco','Canada / Ontario-serving agency leadership',[],notes='Public agency leadership / HR contact. Candidate-facing recruitment responsibility and junior permanent mandates should be confirmed; request a desk referral.')
# Current public leadership identity, kept separate from older cached leadership pages.
add('adecco',soup('adecco').find('h2'), 'Britta Kroupa','Country Head, Adecco Canada; SVP Human Resources, Americas','Adecco','Canada / Ontario-serving mandate',[],notes='Official current leadership page. Senior HR / leadership referral contact; not an assumed junior placement recruiter.')
for c in new:
 if c.get('photo','').startswith('/'):c['photo']=urljoin(c['source'],c['photo'])
Path(root/'extracted.json').write_text(json.dumps(new,ensure_ascii=False,indent=2))
print('EXTRACTED',len(new));print(Counter(c['company'] for c in new))
