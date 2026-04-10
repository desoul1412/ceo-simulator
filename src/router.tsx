import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { MasterDashboard } from './components/MasterDashboard';
import { CompanyView } from './components/CompanyView';
import { AgentsPage } from './components/AgentsPage';
import { AgentDetail } from './components/AgentDetail';
import { GoalsPage } from './components/GoalsPage';
import { DocumentsPage } from './components/DocumentsPage';
import { CostsPage } from './components/CostsPage';
import { OrgChartPage } from './components/OrgChartPage';
import { ProjectSettings } from './components/ProjectSettings';
import { SettingsPage } from './components/SettingsPage';
import { ScrumBoard } from './components/ScrumBoard';
import { ProjectOverview } from './components/ProjectOverview';
import { MergeRequestsPage } from './components/MergeRequestsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <MasterDashboard /> },
      { path: 'company/:companyId', element: <CompanyView /> },
      { path: 'company/:companyId/agents', element: <AgentsPage /> },
      { path: 'company/:companyId/agents/:agentId', element: <AgentDetail /> },
      { path: 'company/:companyId/goals', element: <GoalsPage /> },
      { path: 'company/:companyId/documents', element: <DocumentsPage /> },
      { path: 'company/:companyId/costs', element: <CostsPage /> },
      { path: 'company/:companyId/org-chart', element: <OrgChartPage /> },
      { path: 'company/:companyId/board', element: <ScrumBoard /> },
      { path: 'company/:companyId/merge-requests', element: <MergeRequestsPage /> },
      { path: 'company/:companyId/overview', element: <ProjectOverview /> },
      { path: 'company/:companyId/settings', element: <ProjectSettings /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/:tab', element: <SettingsPage /> },
    ],
  },
]);
