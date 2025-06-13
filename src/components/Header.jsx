import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from "../assets/images/logo-pd.png";

const Header = () => {
  const navigate = useNavigate();

const projectString = sessionStorage.getItem("selectedProject");
const project = projectString ? JSON.parse(projectString) : null;

//console.log(project?.projectName);




  return (
    <header 
      style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
    
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => navigate('/')}
      >
        <img 
          id="logoPD" 
          src={Logo}
          alt="Company Logo"
          style={{
            height: '20px',
            width: 'auto',
          }}
        />
      </div>
           <span
  style={{
    marginRight: '600px',
    fontSize: '14px',
  }}
>
  Project Name: {project?.projectName || 'No Project Selected'}
</span>

      <nav style={{ display: 'flex', gap: '2rem' }}>
        {/* Add navigation links here if needed */}
     
      </nav>
    </header>
  );
};

Header.propTypes = {
  // Add prop types if needed
};

export default Header;