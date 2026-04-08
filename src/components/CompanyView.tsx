import { useParams } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { CompanyDetail } from './CompanyDetail';

export function CompanyView() {
  const { companyId } = useParams();
  const companies = useDashboardStore(s => s.companies);
  const company = companies.find(c => c.id === companyId);

  if (!company) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: 'var(--font-hud)', color: '#2a3a50',
        fontSize: 'var(--font-sm)',
      }}>
        Company not found
      </div>
    );
  }

  return (
    <div style={{ height: '100%', padding: 'var(--gap)' }}>
      <CompanyDetail company={company} />
    </div>
  );
}
