import React from 'react';

function FileUploadProgress({ progress }) {
  const getStatus = () => {
    if (progress >= 100) return "Upload Complete";
    if (progress > 0) return "Uploading...";
    return "Waiting to upload";
  };

  return (
    <div className="upload-progress-wrapper">
      <h6 className="text-light mb-2">File Upload Progress</h6>
      <div style={{ width: '100%', backgroundColor: '#3a3f4b', borderRadius: '4px', overflow: 'hidden', height: '12px' }}>
        <div
          style={{
            width: `${progress}%`,
            backgroundColor: '#0d6efd',
            height: '100%',
            transition: 'width 0.3s ease'
          }}
        ></div>
      </div>
      <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.85rem' }}>
        <span>{getStatus()}</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
}

export default FileUploadProgress;
