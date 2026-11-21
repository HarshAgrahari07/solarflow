import ActivityFeed from './ActivityFeed'
import DemoBanner from './DemoBanner'
import InstallationChart from './InstallationChart'
import InstallationsTable from './InstallationsTable'
import QuickActions from './QuickActions'
import StatCards from './StatCards'

export default function Dashboard({ installations, activities, query, onClearSearch, onAction }) {
  return (
    <div className="dashboard">
      <DemoBanner />
      <StatCards />
      <InstallationChart />
      <InstallationsTable rows={installations} query={query} onClear={onClearSearch} />
      <div className="split">
        <ActivityFeed activities={activities} />
        <QuickActions onAction={onAction} />
      </div>
    </div>
  )
}
