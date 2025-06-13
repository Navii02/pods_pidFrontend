import React, { useEffect, useState } from 'react';

const AlertModal = ({ 
  type = 'success', 
  title, 
  message, 
  onClose, 
  showCloseButton = true,
  closeButtonText = 'OK',
  width = '400px',
  autoCloseDelay = 2000
}) => {
  const [remainingTime, setRemainingTime] = useState(autoCloseDelay);
  
  // Auto-close if delay is specified
  useEffect(() => {
    if (autoCloseDelay) {
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, autoCloseDelay - elapsed);
        setRemainingTime(remaining);
        
        if (remaining <= 0) {
          clearInterval(timer);
          onClose();
        }
      }, 50); // Update frequently for smooth animation
      
      return () => clearInterval(timer);
    }
  }, [autoCloseDelay, onClose]);

  // Configuration for different modal types
  const modalConfig = {
    success: {
      icon: '✓',
      color: '#4CAF50',
      title: title || 'Success!'
    },
    error: {
      icon: '✕',
      color: '#F44336',
      title: title || 'Error!'
    },
    warning: {
      icon: '⚠',
      color: '#FF9800',
      title: title || 'Warning!'
    },
    info: {
      icon: 'ℹ',
      color: '#2196F3',
      title: title || 'Information'
    }
  };

  const config = modalConfig[type] || modalConfig.success;

  // Calculate progress percentage
  const progressPercentage = (remainingTime / autoCloseDelay) * 100;

  // Styles
  const backdropStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  };

  const modalStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    width: '90%',
    maxWidth: width,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    position: 'relative'
  };

  const progressBarStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '4px',
    width: `${progressPercentage}%`,
    backgroundColor: config.color,
    borderRadius: '0 0 0 8px',
    transition: 'width 50ms linear'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px'
  };

  const iconStyle = {
    width: '24px',
    height: '24px',
    backgroundColor: config.color,
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 'bold'
  };

  const titleStyle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    margin: 0
  };

  const messageStyle = {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
    lineHeight: '1.5'
  };

  const footerStyle = {
    display: 'flex',
    justifyContent: 'flex-end'
  };

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: config.color,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={iconStyle}>{config.icon}</div>
          <h3 style={titleStyle}>{config.title}</h3>
        </div>
        <div style={messageStyle}>{message}</div>
        {showCloseButton && (
          <div style={footerStyle}>
            <button style={buttonStyle} onClick={onClose}>
              {closeButtonText}
            </button>
          </div>
        )}
        {autoCloseDelay > 0 && (
          <div style={progressBarStyle} />
        )}
      </div>
    </div>
  );
};

export default AlertModal;