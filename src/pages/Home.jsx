import React, { useState,useEffect,useContext } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Sidebar from '../components/Sidebar';
import ProjectModal from '../components/ProjectModal';
import { Outlet } from 'react-router-dom';
import { getProjects, saveProject, updateProject, deleteProject, AllSavedView, getUserProjects } from '../services/CommonApis';
import { updateProjectContext } from '../context/ContextShare';

const Home = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [projectName, setProjectname] = useState('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectDetails, setProjectDetails] = useState([]);
  const [error, setError] = useState('');
  const { updateProject } = useContext(updateProjectContext);

   const [allSavedViews, setAllSavedViews] = useState([]);
    const Projects = JSON.parse(sessionStorage.getItem('projects'));
const projectIds = Object.keys(Projects);
   const userDetails = JSON.parse(sessionStorage.getItem("userDetails") || "{}");
  const isAdmin = userDetails?.role === "admin";
    const projectString = sessionStorage.getItem("selectedProject");
    const project = projectString ? JSON.parse(projectString) : null;
    const projectId = project?.projectId;
  const handleSidebarToggle = (collapsed) => {
    setIsSidebarCollapsed(collapsed);
  };

 const handleOpenProjectModal = async () => {
  setIsProjectModalOpen(true);
  
  try {
    // Get user details and projects from session storage
    const userDetails = JSON.parse(sessionStorage.getItem("userDetails") || {});
    const isAdmin = userDetails?.role === "admin";
    
    // Safely get projects from session storage
    let storedProjects = {};
    try {
      const projectsString = sessionStorage.getItem('projects');
      storedProjects = projectsString ? JSON.parse(projectsString) : {};
    } catch (e) {
      console.error("Error parsing projects from sessionStorage:", e);
      storedProjects = {};
    }
    
    const projectIds = Object.keys(storedProjects);
    
    let response;
    if (isAdmin) {
      // Admin gets all projects
      response = await getProjects();
    } else {
      // Regular user gets only their assigned projects
      if (projectIds.length === 0) {
        throw new Error("No projects assigned to user");
      }
      response = await getUserProjects({ projectIds });
    }

    if (response.status === 200) {
      const projects = response.data.row || response.data || [];
      console.log(projects);
      
      setProjects(projects);
      setProjectDetails(projects);
      
      // Update session storage for non-admin users
      if (!isAdmin && projects.length > 0) {
        const newProjects = {};
        projects.forEach(project => {
          newProjects[project.projectId] = project;
        });
        sessionStorage.setItem('projects', JSON.stringify(newProjects));
      }
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    console.error('Project fetch error:', error);
    setError(error.message || 'Failed to fetch projects. Please try again.');
    setProjects([]);
    setProjectDetails([]);
  }
};

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false);
  };
    const getAllSavedViews = async (projectId) => {
      try {
        const response = await AllSavedView(projectId);
        if (response.status === 200) {
          setAllSavedViews(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch all saved views table data:", error);
      }
    };
  
    useEffect(() => {
      getAllSavedViews(projectId);
    }, [updateProject]);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header projectName={projectName} />
      <div className="d-flex flex-grow-1" style={{ marginTop: '70px' }}>
        <aside
          className="bg-dark"
          style={{
            width: isSidebarCollapsed ? '0px' : '300px',
            position: 'fixed',
            height: 'calc(100vh - 70px - 30px)',
            top: '70px',
            left: 0,
            zIndex: 1000,
            transition: 'width 0.3s ease',
          }}
        >
          <Sidebar
            onToggle={handleSidebarToggle}
            setProjectname={setProjectname}
            projectName={projectName}
            onOpenProjectModal={handleOpenProjectModal}
            allSavedViews={allSavedViews}
          
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