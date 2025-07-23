import React, { useEffect, useState } from 'react';
import { getUserProjects } from '../services/CommonApis';

function AdminPanel() {
  const [projects, setProjects] = useState([]);

  const Projects = JSON.parse(sessionStorage.getItem('projects'));
const projectIds = Object.keys(Projects);
console.log(projectIds)

  const getAdminProjects = async()=>{
    const response = await getUserProjects({projectIds})
    if(response.status===200){
      console.log(response.data);
      
      setProjects(response.data)
    }
  }

  // Example static data — replace with API call later
  useEffect(() => {
   

    getAdminProjects()


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
          {projects?.map((project, idx) => (
            <tr key={idx}>
              <td style={{ backgroundColor: '#f0f0f0' }}>{project.projectNumber}</td>
              <td>{project.projectName}</td>
              <td>{project.projectDescription}</td>
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
