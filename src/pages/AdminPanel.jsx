import React, { useEffect, useState } from 'react';

function AdminPanel() {
  const [projects, setProjects] = useState([]);

  // Example static data — replace with API call later
  useEffect(() => {
    const dummyProjects = [
      {
        projectNumber: 'PRJ001',
        name: 'Pipeline Maintenance',
        description: 'Pipeline maintenance project for northern region',
        createdDate: '2024-11-12',
        createdBy: 'superadmin@poulconsult.com'
      },
      {
        projectNumber: 'PRJ002',
        name: 'Tank Inspection',
        description: 'Annual inspection of oil storage tanks',
        createdDate: '2025-01-20',
        createdBy: 'admin@poulconsult.com'
      },
      {
        projectNumber: 'PRJ003',
        name: 'Site Survey',
        description: 'Topographical survey for new site',
        createdDate: '2025-07-01',
        createdBy: 'projectlead@poulconsult.com'
      }
    ];

    setProjects(dummyProjects);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: 'white', zIndex: '1', position: 'absolute' }}>
      <div className="table-container">
        <table className='tagTable'>
        <thead>
          <tr>
            <th>Project Number</th>
            <th>Name</th>
            <th>Description</th>
            <th>Created Date</th>
            <th>Created By</th>
          </tr>
        </thead>
        <tbody style={{color:'black'}}>
          {projects.map((project, idx) => (
            <tr key={idx}>
              <td style={{ backgroundColor: '#f0f0f0' }}>{project.projectNumber}</td>
              <td>{project.name}</td>
              <td>{project.description}</td>
              <td>{project.createdDate}</td>
              <td style={{ backgroundColor: '#f0f0f0' }}>{project.createdBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

export default AdminPanel;
