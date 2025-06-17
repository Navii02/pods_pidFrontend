import React from 'react'

function Alert({ message, onAlertClose }) {
  return (
    <div className="custom-alert">
    <div className="custom-alert-content">
      <p>{message}</p>
      <div className="button-container">
        <button onClick={onAlertClose}>OK</button>
      </div>
    </div>
  </div>
  )
}

export default Alert
