export function Sidebar() {
  return <aside className="sidebar">
    <div className="brand">JOB<span>AGENT</span></div>
    <nav className="nav">
      <a href="/">⌂ &nbsp;Dashboard</a>
      <a href="/recommended">★ &nbsp;Recommended Jobs</a>
      <a href="/companies">◫ &nbsp;Target Companies</a>
      <a href="/applications">◎ &nbsp;Applications</a>
      <a href="/settings">⚙ &nbsp;Settings</a>
    </nav>
    <div className="side-foot">Human approval stays between AI preparation and application submission.</div>
  </aside>;
}
