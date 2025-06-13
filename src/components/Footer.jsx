import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faGlobe } from '@fortawesome/free-solid-svg-icons';

function Footer() {
  return (
    <footer style={{
      backgroundColor: '#000',
      color: '#fff',
      display: 'flex',
      height:'30px',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
  
      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{ fontSize: '12px' }}>
        Developed by Poul Consult AS, Norway
      </div>
      
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <a href="mailto:jpo@poulconsult.com" style={{
          color: '#fff',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          fontSize: '12px',
          gap: '0.5rem',
          transition: 'color 0.2s ease',
          ':hover': {
            color: '#4dabf7'
          }
        }}>
          <FontAwesomeIcon icon={faEnvelope} />
          jpo@poulconsult.com
        </a>
        
        <a href="http://www.poulconsult.com" target="_blank" rel="noopener noreferrer" style={{
          color: '#fff',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '12px',
          transition: 'color 0.2s ease',
          ':hover': {
            color: '#4dabf7'
          }
        }}>
          <FontAwesomeIcon icon={faGlobe} />
          www.poulconsult.com
        </a>
      </div>
    </footer>
  );
}

export default Footer;