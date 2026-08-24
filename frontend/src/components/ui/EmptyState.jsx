import React from 'react';
import Card from './Card';

export default function EmptyState({ 
  icon = '📋', 
  title = 'No Data Available', 
  description = 'There is currently no data to display in this section.',
  action = null
}) {
  return (
    <Card style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '48px 24px',
      textAlign: 'center',
      borderStyle: 'dashed'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
        {icon}
      </div>
      <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', maxWidth: '400px' }}>
        {description}
      </p>
      {action && (
        <div>{action}</div>
      )}
    </Card>
  );
}
