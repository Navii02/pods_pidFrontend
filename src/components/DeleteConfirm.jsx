import React from 'react'

function DeleteConfirm({message,onConfirm, onCancel }) {
  return (
    <div className="custom-confirm">
    <div className="custom-confirm-content">
      <p><span style={{color:'#D64550',fontSize:'30px'}}><i class="fa-solid fa-triangle-exclamation" ></i></span> {message}</p>
      <div className="delete-button-container">
        <button className="btn btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn btn-confirm" onClick={onConfirm}>OK</button>
      </div>
    </div>
  </div>
  )
}

export default DeleteConfirm
