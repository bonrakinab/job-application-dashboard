"""Conservative person-level audit. Cached official pages are inputs, never agency-wide keyword matches.
Usage: PYTHONPATH=<bs4 location> python scripts/recruiter-research/audit-domains.py <audit-cache> <team-cache>
Unretrievable/ambiguous evidence removes tags instead of guessing. IDs remain stable.
"""
import json,re,sys,hashlib,unicodedata
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup
p=Path(sys.argv[1]); team=Path(sys.argv[2]); target=Path('src/data/recruiters.json');data=json.loads(target.read_text());ix={v['url']:v for v in json.loads((p/'source-index.json').read_text())}
def text(n):return n.get_text(' ',strip=True) if n else ''
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def read(u):
 v=ix.get(u,{})
 if not v.get('file'):return None
 s=BeautifulSoup((p/v['file']).read_text(),'html.parser')
 for q in s(['script','style','nav','header','footer']):q.decompose()
 return s
# Vocabulary applies ONLY to a person's explicit Recruitment Specialties / Specialist Area field.
def map_special(s):
 out=[]
 for pat,d in [(r'software|\bdevelopers?\b|\.net|\bjava\b|application development','Software Engineering'),(r'AI/ML|\bdata\b|machine learning|artificial intelligence|AI Engineering','AI & Data'),(r'\bERP\b|SAP|Oracle|PeopleSoft|JDE|enterprise applications|business systems','ERP & Business Systems'),(r'cloud|DevOps|\bAWS\b','Cloud & DevOps'),(r'cyber|IT Risk|GRC','Cybersecurity'),(r'information technology|technology|\bIT\b','Technology (general)'),(r'administration|administrative|office support','Administrative'),(r'human resources|\bHR\b|talent acquisition','Human Resources'),(r'accounting|finance|bookkeeping|payroll','Finance & Accounting'),(r'marketing|sales|communications|advertising|media','Sales & Marketing'),(r'engineering|manufactur|construction|supply chain|logistics','Engineering & Operations'),(r'government staffing','Government'),(r'legal|lawyer|law clerk|compliance','Legal & Compliance')]:
  if re.search(pat,s,re.I):out.append(d)
 return out
why={
'Software Engineering':'Your Angular experience and Next.js, TypeScript and Python projects offer a relevant introduction for software searches.',
'AI & Data':'Your MSc AI research, CLIP/vector-search work and Python/SQL projects provide a relevant AI/data introduction.',
'ERP & Business Systems':'Your Oracle Fusion AP, AR, GL and Procurement support experience is relevant to business-systems searches; SAP-specific roles may require different product experience.',
'Cloud & DevOps':'Your IT operations, patching, change-management and deployment experience supports a junior cloud/operations introduction; senior engineering requirements need separate assessment.',
'IT Support':'Your enterprise application and user-support experience provides a relevant support introduction.',
'Technology (general)':'Your enterprise IT and MSc background justify asking which colleague handles junior software, ERP or support searches; no narrower specialty is established.',
'Cybersecurity':'Your audit/change-management exposure supports an IT governance introduction; dedicated security engineering experience is not established.',
'Administrative':'Your documentation, business-data and issue-tracking experience may fit administrative support searches.',
}
def evidence(ds,basis,summary,source,lim='No completed placement or current junior permanent vacancy verified.'):
 return [dict(domain=d,basis=basis,summary=summary,source=source,whySuitable=why.get(d,'This is a supported recruiter specialty, but your supplied background does not establish a direct match. Use only for an appropriate referral.'),limitation=lim) for d in ds]
# Extract exact named RIM cards, not the whole team page.
rim=BeautifulSoup((team/'rim.html').read_text(),'html.parser');rimfields={}
for m in rim.select('.wpt-teamprofiles-member'):
 name=text(m.select_one('.wpt-teamprofiles-name'));special=text(m.select_one('.wpt-teamprofiles-division')).replace('Specialization:','').strip()
 if name:rimfields[norm(name)]=special
# Add every published IT Connex candidate-facing recruiter; no email patterns are invented.
s=BeautifulSoup((p/'itconnex.html').read_text(),'html.parser');existing={(norm(c['name']),norm(c['company'])) for c in data['contacts']}
for m in s.select('.team-member'):
 name=text(m.select_one('h3'));title=text(m.select_one('.position'))
 if not name or not re.search('Recruit|Founder',title,re.I) or (norm(name),norm('IT Connex')) in existing:continue
 parent=m.parent;bio=text(m.find('p'));em=re.search(r'[A-Za-z0-9._%+-]+@itconnex\.ca',text(parent));im=m.find('img')
 c=dict(id='contact-'+hashlib.sha256(('IT Connex|'+name).encode()).hexdigest()[:12],name=name,company='IT Connex',title=title,location='Toronto, Ontario',domains=[],source='https://www.itconnex.ca/',verification='Official named team bio',notes='Public professional contact; individual live mandate must be confirmed.',photo=urljoin('https://www.itconnex.ca/',im.get('src','')) if im else '')
 if em:c['email']=em.group(0)
 c['_bio']=bio;data['contacts'].append(c);existing.add((norm(name),norm('IT Connex')))
# Hand-reviewed public postings: attribution, domain and role constraints, never successful-hire claims.
posts={
'Tarah Katzberg':[('Software Engineering','api-developer-at-maplesoft-group-an-seb-company-4439300847','API Developer, Toronto; Java/Node.js APIs.','Six-month contract requiring 8+ years; use as desk evidence or referral, not a junior vacancy match.'),('Cloud & DevOps','api-developer-at-maplesoft-group-an-seb-company-4439300847','API Developer search includes Azure and containerized cloud services.','Senior development contract; cloud exposure alone does not establish junior DevOps mandates.')],
"Derek O'Connor":[('ERP & Business Systems','sap-tester-at-precisionerp-precisionit-4425608901','SAP Tester search in Toronto involving SD, MM, FI and supply-chain testing.','Nine-month-plus contract requiring 5+ years testing and retail experience; Oracle experience is not SAP testing experience.')],
'Anastasia Moskaleva':[('AI & Data','data-scientist-at-robert-half-4436803285','Data Scientist / Analytics Engineer search involving Python, SQL, BigQuery and predictive modeling.','One-year contract requiring 3+ years; this supports domain relevance, not junior fit.')],
"Arun D'Souza":[('Software Engineering','python-engineer-ai-at-procom-4462318964','Python Engineer–AI search in Mississauga for a financial-services client.','Contract-to-hire; required experience and current availability must be confirmed.'),('AI & Data','python-engineer-ai-at-procom-4462318964','Python Engineer–AI search attributed to this Procom recruiter.','No completed placement or junior eligibility established.')],
'Blythe Rogers':[('AI & Data','data-architect-at-insight-global-4480700643','Data Architect search in Toronto attributed to this recruiter.','Architecture search; junior permanent suitability unverified.')],
'Casey Thompson':[('Cybersecurity','incident-responder-manager-at-hays-4471772208','Incident Responder Manager search attributed to this Hays recruiter.','Management search; ask for a junior security/support desk referral.')],
'Minu Venugopal':[('ERP & Business Systems','servicenow-technical-lead-at-randstad-digital-4467786479','Permanent ServiceNow Technical Lead / service-enablement search in the GTA.','Senior ServiceNow mandate; Oracle background is adjacent business-systems experience, not a direct product match.')],
'Owen Williams':[('AI & Data','data-analyst-at-insight-global-4455460395','Full-time permanent Data Analyst search, remote with EST hours.','Evidence supports a data/analytics desk; confirm Ontario eligibility, experience requirements and whether still open.'),('Software Engineering','progress-developer-at-insight-global-4408669103','Level 2 Progress OpenEdge Analyst/Programmer search in Elmira, Ontario.','Specialist Progress stack; not evidence of junior JavaScript openings.')],
'Shina Sharma':[('Cloud & DevOps','devops-engineer-at-altis-4465151513','DevOps Engineer search in Toronto attributed to this Altis recruiter.','Current junior/permanent mandate and required experience unverified.')],
}
# Explicit personal activity/profile evidence, checked in indexed public profiles.
manual={
'Beatriz Silva':(['AI & Data'],'Attributed hiring activity','Her own profile activity advertises multilingual AI/ML data annotators requiring 1+ years.','https://ca.linkedin.com/in/biabrazuca','Language and work-authorization requirements apply; no matching junior research-engineering vacancy established.'),
'Jamie Dunne':(['AI & Data','Software Engineering','ERP & Business Systems'],'Attributed hiring activity','His own post advertises senior ML/AI, mobile, Python/Java, React and D365 developers.','https://www.linkedin.com/posts/jamie-dunne-pmp-2b8310194_we-are-currently-hiring-for-multiple-roles-activity-7425543268341444608-a5ue','Six-month contracts, several explicitly senior. Relevant desk; permanent early-career fit not established.'),
'Sam Stevens':(['ERP & Business Systems'],'Stated personal specialization','His public About section identifies enterprise applications recruitment.','https://ca.linkedin.com/in/samm-stevens','No evidence of a specific SAP or Oracle placement; ask which enterprise applications and levels he handles.'),
'Mike McDowell':(['ERP & Business Systems'],'Self-reported recruitment history','Founder bio describes over ten years in SAP recruitment and staffing growth at SAP consulting partners.','https://scaleituprecruiting.com/about','SAP focus is distinct from your Oracle Fusion experience; ask about transferable junior business-systems roles.'),
'Shawn Derouin':(['ERP & Business Systems','AI & Data','Software Engineering'],'Self-reported recruitment history','His individual bio describes leading recruitment spanning Oracle/PeopleSoft/JDE, BI/data warehousing and software development.','https://www.precisionerp.com/about/team/shawn-derouin','BI/data-warehousing history does not establish ML hiring. Leadership/account role; junior permanent desk needs confirmation.'),
'Mark Garbe':(['Technology (general)'],'Stated personal specialization','Individual bio specifies nationwide intermediate-to-senior IT searches, permanent and contract.','https://www.precisionerp.com/about/team/mark-garbe','Explicit seniority mismatch; useful for a recruiter referral, not evidence of junior software mandates.'),
}
removed=0
for c in data['contacts']:
 old=c['domains'];ev=[];u=c['source'];
 if 'oecm.ca/supplier-partners/' in u:c['contactKind']='Supplier account contacts'
 s=read(u);review=[dict(url=u,result='Retrieved public source; individual hiring scope reviewed' if s else ix.get(u,{}).get('status','Source not retrieved'))];reason='The available source establishes identity/role or agency services, but no attributable individual hiring domain. A referral request is appropriate; a domain match is not established.'
 if c['name'] in posts:
  for d,slug,summary,lim in posts[c['name']]:ev+=evidence([d],'Attributed hiring activity',summary,'https://ca.linkedin.com/jobs/view/'+slug,lim)
 elif c['name'] in manual:
  ds,b,sm,src,lim=manual[c['name']];ev=evidence(ds,b,sm,src,lim)
 elif c['company']=='Recruiting in Motion':
  spec=rimfields.get(norm(c['name']),'')
  if spec:ev=evidence(map_special(spec),'Stated personal specialization','Named team card lists these personal desk specialties: '+spec,u)
 elif 'iqpartners.com/recruiters/' in u and s:
  t=text(s);m=re.search(r'Recruitment Specialties (.*?) (?:Biography|Strengths)',t)
  if m:
   spec=m.group(1);ds=map_special(spec)
   # Client industries and personal background are not functional hiring expertise.
   if c['name']=='Bruce Powell':ds=['Technology (general)','Sales & Marketing']
   if c['name']=='Claire McConnachie':ds=['Sales & Marketing']
   ev=evidence(ds,'Stated personal specialization','Individual recruitment-specialties field: '+spec,u,'Published specialty; many searches are mid/senior or executive. Junior permanent demand and completed placements unverified.')
 elif 'morganmckinley.com/ca/consultant/' in u and s:
  m=re.search(r'Specialist Area (.*?) My Advice',text(s))
  if m:ev=evidence(map_special(m.group(1)),'Stated personal specialization','Individual consultant profile specifies '+m.group(1)+'.',u,'Profile showed no active personal postings at review. Junior permanent hiring unverified.')
 elif 'lrostaffing.com/team/' in u and s:
  t=text(s);m=re.search(r'Areas of Expertise: (.*?) About ',t)
  # Personal skills in HR/operations are not candidate-placement specialties.
  if m and c['name'] not in ['Tricia Cameron','Ron Palaczka','Cas Sotelo','Matt Traynor','Mia Laursen']:
   spec=m.group(1);ev=evidence(map_special(spec),'Stated personal specialization','Individual Areas of Expertise field: '+spec,u,'Personal expertise field, not independently verified placements. Confirm junior permanent searches; contract titles can indicate a different mandate.')
  if c['name']=='Natasha Ocal':ev=evidence(['Administrative','Human Resources'],'Self-reported recruitment history','Individual bio describes eight years recruiting administrative support and HR at national staffing firms.',u)
  if c['name']=='Andrew McDougall':ev=evidence(['Human Resources','Administrative','Finance & Accounting'],'Self-reported recruitment history','Individual bio describes recruiting HR, administration, finance and accounting before joining LRO in 2021.',u)
  if c['name']=='Stacey Leclaire':ev=evidence(['Finance & Accounting','Administrative'],'Self-reported recruitment history','Individual bio reports accounting/finance placements since 2009 and earlier accounting/administrative recruiting.',u)
 elif 'bjrcrecruiting.com/team/' in u and s:
  t=text(s).split('Reach ')[0].split('Types of Roles')[0]
  # Only functional recruitment claims in this person's bio, excluding past unrelated professional work.
  ds=[]
  if re.search(r'(legal|compliance) recruit|recruitment practice.*legal',t,re.I):ds.append('Legal & Compliance')
  if re.search(r'finance (?:&|and) accounting recruit|recruitment practice focuses on Finance',t,re.I):ds.append('Finance & Accounting')
  if ds:ev=evidence(ds,'Stated personal specialization','Individual bio describes a recruitment practice in '+', '.join(ds)+'.',u,'Specialist legal/finance practice; your supplied background does not establish the professional credentials for those roles.')
 elif c['company']=='STRIVE Recruitment':
  if c['name']=='Kim Tocher':ev=evidence(['Engineering & Operations'],'Self-reported recruitment history','Her individual bio describes Ontario manufacturing/logistics staffing and oversight of five Southwestern Ontario branches.',u,'Manufacturing/logistics scope does not establish software, AI or ERP hiring. Ask for a relevant referral.')
  elif c['name']=='Oksana Chanas':ev=evidence(['Engineering & Operations'],'Self-reported recruitment history','Her individual bio describes over five years in Southwestern Ontario industrial recruitment and temporary/permanent manufacturing/logistics mandates.',u,'Relevant industrial staffing background; no direct match to your technical domains is established.')
  elif c['name'] in ['Talar Koundakjian','Kloey Anderson','Jose Carmona']:ev=evidence(['Engineering & Operations'],'Stated personal specialization','Named team bio explicitly places this recruiter in manufacturing/operations or high-volume industrial recruitment.',u,'Industrial operations is distinct from software or cloud operations. Confirm Ontario desk; Jose’s bio places him in Vancouver.')
  elif c['name']=='Cynthia Akinsola':ev=evidence(['Administrative'],'Stated personal specialization','Named team profile explicitly identifies a corporate administration recruitment specialty.',u,'Confirm candidate-facing administration searches; bio also describes internal payroll duties.')
 elif c['company']=='IT Connex':
  bio=next((text(m.find('p')) for m in BeautifulSoup((p/'itconnex.html').read_text(),'html.parser').select('.team-member') if text(m.select_one('h3'))==c['name']), '')
  if c['name']=='Theresa Andrusko':ev=evidence(['AI & Data','Engineering & Operations','Technology (general)'],'Stated personal specialization','Her named bio describes full-cycle recruitment from junior to executive, with engineering, IoT and AI/ML coverage.',u,'Explicit all-level scope is useful, but no current permanent junior AI vacancy or completed placement is verified.')
  elif re.search('IT professionals|IT staffing|recruiting for both the IT',bio):ev=evidence(['Technology (general)'],'Stated personal specialization','The named bio describes recruiting IT professionals; narrower functional domains are not specified.',u)
 if c['name'] in ['Kathy Pak','Nikhil Joseph','Shina Sharma','Sam Stevens','Merin George','Minu Venugopal','Justus Geethan','Jessica Nagra','Melissa Woodhouse','Beatriz Silva','Casey Thompson',"Arun D'Souza",'Blythe Rogers','Anastasia Moskaleva','Jamie Dunne','Owen Williams','Charmi Mehta']:
  review[0]['result']='Public indexed profile/activity reviewed; full signed-in LinkedIn history unavailable'
 if c['name']=='Jessica Nagra':ev=evidence(['Software Engineering','Cloud & DevOps'],'Attributed hiring activity','Profile activity shares a Node.js/TypeScript backend search using AWS Lambda, API Gateway and CI/CD.',u,'Production experience required; no junior permanent vacancy or completed placement verified.')
 if c['name']=='Melissa Woodhouse':ev=evidence(['AI & Data','Cloud & DevOps'],'Attributed hiring activity','Profile activity shares a Toronto cloud data-migration search involving Snowflake and Azure AKS.',u,'Shared recruitment activity; authorship, current availability and junior permanent demand unverified.')
 if c['name']=='Merin George':ev=evidence(['ERP & Business Systems','Cloud & DevOps'],'Attributed hiring activity','Profile activity requests project managers with ITSM/application and Cloud/SaaS implementation experience; ServiceNow is preferred.',u,'Project-management search requiring 3–5 years; not evidence of hands-on junior cloud engineering vacancies.')
 c['domains']=list(dict.fromkeys(e['domain'] for e in ev));removed+=len(set(old)-set(c['domains']));c['domainEvidence']=ev
 c['audit']=dict(checkedAt='2026-10-31',status='Hiring activity found' if any(e['basis']=='Attributed hiring activity' for e in ev) else 'Recruitment history described' if any(e['basis']=='Self-reported recruitment history' for e in ev) else 'Personal specialty stated' if ev else 'Hiring history not verified',reviewedSources=review,conclusion='A source-backed domain connection is shown below. This is an outreach relevance assessment, not a job eligibility or placement claim.' if ev else reason,completedPlacementsVerified=False)
 # Remove old contradictory notes/tags rather than retaining unsupported claims in copy.
 c['notes']='Individual domain audit: '+c['audit']['conclusion']
 c['verification']=c['audit']['status']+' · reviewed Oct 31, 2026'
 for e in ev:
  if e['source'] not in [v['url'] for v in review]:review.append(dict(url=e['source'],result='Person-attributed evidence reviewed'))
# Explicit register and coverage limitations.
data['gaps']=["Ontario's public licence register returned a connection error during this review; complete reconciliation and licence status remain unverified.","This directory is not an exhaustive census. Nonmembers, unpublished employees, branches, trading names and firms without accessible websites remain gaps.","A published specialty is not past hiring evidence. Attributed job advertisements are not proof of completed placements or open junior permanent jobs.","Public indexed LinkedIn activity is partial; full signed-in work and posting history could not be reviewed.","Internal HR, leadership and supplier account contacts may only be useful for referrals. Agency specialties are not inherited by their staff.","Contact details and agency status can change. No guessed emails are added. Outreach and responses are logged manually."]
data['auditSummary']=dict(checkedAt='2026-10-31',contactsReviewed=len(data['contacts']),unsupportedTagsRemoved=removed,method='Person-attributed postings, explicit individual specialty fields, and self-reported recruitment history are distinguished. Agency services, employer sector, certifications and job-title keywords alone never justify personal domain tags.',registryStatus='Unavailable — connection error; reconciliation incomplete',completedPlacementsIndependentlyVerified=0)
target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(data['auditSummary']);from collections import Counter;print(Counter(c['audit']['status'] for c in data['contacts']))
