const jobs = [
  { id: 1, company: 'Northstar Bank', title: 'AI Engineer', location: 'Toronto, ON · Hybrid', posted: '3h ago', source: 'Company ATS', score: 93, skills: 96, experience: 84, locationScore: 100, eligible: true, recommendation: 'exceptional', matched: ['Python','Machine Learning','SQL','Cloud','LLMs'], missing: ['Kubernetes'], blockers: [] },
  { id: 2, company: 'Maple Analytics', title: 'Machine Learning Engineer', location: 'Remote · Canada', posted: '7h ago', source: 'Greenhouse', score: 88, skills: 91, experience: 82, locationScore: 100, eligible: true, recommendation: 'strong', matched: ['Python','Computer Vision','Deep Learning','Git'], missing: ['Terraform','MLflow'], blockers: [] },
  { id: 3, company: 'Vector Systems', title: 'AI Solutions Engineer', location: 'Waterloo, ON · Hybrid', posted: '11h ago', source: 'Lever', score: 84, skills: 86, experience: 80, locationScore: 90, eligible: true, recommendation: 'strong', matched: ['Cloud','Python','Enterprise Systems','AI'], missing: ['Azure OpenAI'], blockers: [] },
  { id: 4, company: 'Signal Commerce', title: 'Data Scientist', location: 'Toronto, ON', posted: '19h ago', source: 'Ashby', score: 77, skills: 79, experience: 74, locationScore: 100, eligible: true, recommendation: 'reasonable', matched: ['Python','SQL','Machine Learning'], missing: ['Spark','dbt'], blockers: [] },
  { id: 5, company: 'Frontier Defense', title: 'ML Engineer II', location: 'Ottawa, ON · On-site', posted: '5h ago', source: 'Company ATS', score: 46, skills: 89, experience: 78, locationScore: 55, eligible: false, recommendation: 'skip', matched: ['Python','Machine Learning','Computer Vision'], missing: ['C++'], blockers: ['Active security clearance required.'] },
  { id: 6, company: 'Harbor Technologies', title: 'Senior ML Architect', location: 'Toronto, ON', posted: '1d ago', source: 'Company ATS', score: 42, skills: 84, experience: 36, locationScore: 100, eligible: false, recommendation: 'skip', matched: ['Python','Cloud','Machine Learning'], missing: ['Kubernetes','Architecture leadership'], blockers: ['Requires 10+ years of professional ML experience.'] }
];

let selectedId = null;

function visibleJobs() {
  const q = document.querySelector('#search').value.trim().toLowerCase();
  const min = Number(document.querySelector('#scoreFilter').value);
  const eligibleOnly = document.querySelector('#eligibleOnly').checked;
  return jobs.filter(j => {
    const haystack = `${j.company} ${j.title} ${j.location}`.toLowerCase();
    return (!q || haystack.includes(q)) && j.score >= min && (!eligibleOnly || j.eligible);
  });
}

function renderStats() {
  const eligible = jobs.filter(j => j.eligible);
  const strong = eligible.filter(j => j.score >= 80);
  const exceptional = eligible.filter(j => j.score >= 90);
  const cards = [['New jobs',jobs.length,'discovered in demo batch'],['Eligible',eligible.length,'after hard blockers'],['Strong matches',strong.length,'score ≥ 80'],['Exceptional',exceptional.length,'score ≥ 90']];
  document.querySelector('#stats').innerHTML = cards.map(([label,value,foot]) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`).join('');
}

function renderJobs() {
  const list = visibleJobs();
  document.querySelector('#resultCount').textContent = `${list.length} opportunities shown`;
  document.querySelector('#jobList').innerHTML = list.length ? list.map(j => `<button class="job-row ${selectedId === j.id ? 'selected' : ''}" data-id="${j.id}"><div><div class="job-title">${j.title}</div><div class="job-meta"><span>${j.company}</span><span>·</span><span>${j.location}</span><span>·</span><span>${j.posted}</span></div></div><div class="score">${j.score}<small>/100</small></div><div class="rec ${j.recommendation}">${j.recommendation}</div></button>`).join('') : `<div class="empty-results">No jobs match the current filters.</div>`;
  document.querySelectorAll('.job-row').forEach(row => row.addEventListener('click', () => selectJob(Number(row.dataset.id))));
}

function meter(label, value) {
  return `<div class="meter"><div class="meter-head"><span>${label}</span><span>${value}%</span></div><div class="bar"><i style="width:${value}%"></i></div></div>`;
}

function selectJob(id) {
  selectedId = id;
  renderJobs();
  const j = jobs.find(x => x.id === id);
  document.querySelector('#detailPanel').innerHTML = `<div class="detail-top"><div><div class="detail-company">${j.company}</div><h3>${j.title}</h3></div><div class="detail-score">${j.score}<span>/100</span></div></div><div class="detail-loc">${j.location} · ${j.posted} · ${j.source}</div><div class="rec ${j.recommendation}" style="display:inline-block">${j.recommendation}</div><div class="divider"></div><div class="section-title">Evidence-based match</div>${meter('Skills', j.skills)}${meter('Experience', j.experience)}${meter('Location', j.locationScore)}<div class="divider"></div><div class="section-title">Matched skills</div><div class="tags">${j.matched.map(x => `<span class="tag">✓ ${x}</span>`).join('')}</div><div style="height:14px"></div><div class="section-title">Gaps</div><div class="tags">${j.missing.map(x => `<span class="tag missing">△ ${x}</span>`).join('')}</div>${j.blockers.length ? `<div class="divider"></div><div class="section-title">Hard blockers</div>${j.blockers.map(x => `<div class="blocker">${x}</div>`).join('')}` : ''}<div class="actions"><button class="btn secondary">Skip</button><button class="btn primary" ${!j.eligible ? 'disabled' : ''}>Review job</button></div>`;
}

['search','scoreFilter','eligibleOnly'].forEach(id => document.querySelector(`#${id}`).addEventListener(id === 'search' ? 'input' : 'change', renderJobs));
document.querySelector('#refreshBtn').addEventListener('click', () => { selectedId = null; document.querySelector('#search').value=''; document.querySelector('#scoreFilter').value='80'; document.querySelector('#eligibleOnly').checked=true; renderJobs(); });
renderStats();
renderJobs();
