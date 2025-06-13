import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Sidebar from '../components/Sidebar';
import ProjectModal from '../components/ProjectModal';
import { Outlet } from 'react-router-dom';
import { getProjects, saveProject, updateProject, deleteProject } from '../services/CommonApis';

const Home = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [projectName, setProjectname] = useState('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectDetails, setProjectDetails] = useState([]);
  const [error, setError] = useState('');

  const handleSidebarToggle = (collapsed) => {
    setIsSidebarCollapsed(collapsed);
  };

  const handleOpenProjectModal = async () => {
    setIsProjectModalOpen(true);
    try {
      const response = await getProjects();
      if (response.status === 200) {
        setProjectDetails(response.data.row || []);
        setProjects(response.data.row || []);
      } else {
        setError(`Unexpected response status: ${response.status}`);
        setProjects([]);
      }
    } catch (error) {
      setError('Failed to fetch projects. Please try again.');
      setProjects([]);
    }
  };

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false);
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header projectName={projectName} />
      <div className="d-flex flex-grow-1" style={{ marginTop: '50px' }}>
        <aside
          className="bg-dark"
          style={{
            width: isSidebarCollapsed ? '0px' : '300px',
            position: 'fixed',
            height: 'calc(100vh - 50px - 30px)',
            top: '50px',
            left: 0,
            zIndex: 1000,
            transition: 'width 0.3s ease',
          }}
        >
          <Sidebar
            onToggle={handleSidebarToggle}
            setProjectname={setProjectname}
            onOpenProjectModal={handleOpenProjectModal}
          />
        </aside>

        <main
          className="flex-grow-1"
          style={{
            marginLeft: isSidebarCollapsed ? '0px' : '300px',
            minHeight: 'calc(100vh - 50px - 30px)',
            transition: 'margin-left 0.3s ease',
            width: isSidebarCollapsed ? '100%' : 'calc(100% - 300px)',
            overflow: 'hidden',
          }}
        >
          <Outlet context={{ isSidebarCollapsed }} />
        </main>
      </div>
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={handleCloseProjectModal}
        projects={projects}
        projectDetails={projectDetails}
        setProjects={setProjects}
        setProjectDetails={setProjectDetails}
        setProjectname={setProjectname}
        saveProject={saveProject}
        updateProject={updateProject}
        deleteProject={deleteProject}
      />
      <Footer />
    </div>
  );
};

export default Home;