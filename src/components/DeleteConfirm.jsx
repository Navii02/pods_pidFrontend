import React from 'react'

function DeleteConfirm({message,onConfirm, onCancel }) {
  return (
    <div className="custom-confirm">
    <div className="custom-confirm-content">
      <p><i class="fa-solid fa-triangle-exclamation"></i> {message}</p>
      <div className="delete-button-container">
        <button className="btn btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn btn-confirm" onClick={onConfirm}>OK</button>
      </div>
    </div>
  </div>
  )
}

export default DeleteConfirm
