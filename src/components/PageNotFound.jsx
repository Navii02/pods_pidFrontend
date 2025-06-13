import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '2rem',
    textAlign: 'center'
  };

  const statusCodeStyle = {
    fontSize: '6rem',
    fontWeight: '700',
    color: '#343a40',
    margin: '0',
    lineHeight: '1'
  };

  const titleStyle = {
    fontSize: '2rem',
    fontWeight: '600',
    color: '#495057',
    margin: '1rem 0'
  };

  const messageStyle = {
    fontSize: '1.1rem',
    color: '#6c757d',
    maxWidth: '600px',
    marginBottom: '2rem'
  };

  const buttonStyle = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#7a78e8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  };

  const buttonHoverStyle = {
    backgroundColor: '#0069d9'
  };

  const [buttonCurrentStyle, setButtonCurrentStyle] = React.useState(buttonStyle);

  return (
    <div style={containerStyle}>
      <h1 style={statusCodeStyle}>404</h1>
      <h2 style={titleStyle}>Page Not Found</h2>
      <p style={messageStyle}>
        The page you are looking for might have been removed, had its name changed, 
        or is temporarily unavailable.
      </p>
      <button 
        style={buttonCurrentStyle}
        onMouseEnter={() => setButtonCurrentStyle({...buttonStyle, ...buttonHoverStyle})}
        onMouseLeave={() => setButtonCurrentStyle(buttonStyle)}
        onClick={() => navigate('/')}
      >
        Return to Homepage
      </button>
    </div>
  );
};

export default NotFoundPage;