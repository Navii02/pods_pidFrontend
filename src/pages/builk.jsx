import React, { useState, useRef } from "react";
import { uploadFiles, saveConvertedFiles } from "../services/BulkImportApi";
import { url } from "../services/Url";

function BulkModelImport() {
  const [files, setFiles] = useState([]);
  const [convertedFiles, setConvertedFiles] = useState([]);
  const fileInputRef = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selected]);
    setError(null);
  };

  const handleRemoveFile = (index) => {
    const updated = [...files];
    updated.splice(index, 1);
    setFiles(updated);
  };

  const handleClearAll = () => {
    setFiles([]);
    setConvertedFiles([]);
    setError(null);
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      setError("No files selected.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));

      const response = await uploadFiles(formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Check if response and response.data exist
      if (!response || !response.data) {
        throw new Error("Invalid response from server");
      }

      const { data } = response;

      // Check if convertedFiles exists and is an array
      if (!data.convertedFiles || !Array.isArray(data.convertedFiles)) {
        throw new Error("No converted files received");
      }

      setConvertedFiles(data.convertedFiles);
    } catch (err) {
      console.error("Conversion error:", err);
      setError(err.message || "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (convertedFiles.length === 0) {
      setError("No files to save.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      await saveConvertedFiles(convertedFiles);
      alert("Files saved successfully!");
      handleClearAll();
    } catch (err) {
      console.error("Save error:", err);
      setError(err.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract filename from path
  const getFileName = (path) => {
    if (!path) return '';
    // Handle both Windows and Unix paths
    return path.split('\\').pop().split('/').pop();
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "#373a4f", color: "#fff" }}>
      <h4>Bulk Model Import</h4>

      {error && (
        <div style={{ color: "#ff5c5c", marginBottom: "10px" }}>
          Error: {error}
        </div>
      )}

      <input
        type="file"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".fbx,.rvm,.ifc,.dae,.iges,.glb,.obj,.igs"
      />
      <button onClick={() => fileInputRef.current.click()}>Add Files</button>
      <button 
        onClick={handleClearAll} 
        style={{ marginLeft: "10px" }}
        disabled={loading}
      >
        Clear All
      </button>
      <button 
        onClick={handleConvert} 
        style={{ marginLeft: "10px" }}
        disabled={loading || files.length === 0}
      >
        {loading ? "Converting..." : "Convert"}
      </button>

      <div style={{ marginTop: "20px" }}>
        <h5>Selected Files ({files.length})</h5>
        {files.length > 0 ? (
          files.map((file, idx) => (
            <div key={idx} style={{ marginBottom: "5px", display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{file.name}</span>
              <span style={{ color: '#aaa', marginLeft: '10px' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <button
                onClick={() => handleRemoveFile(idx)}
                style={{
                  marginLeft: "10px",
                  background: "transparent",
                  color: "#ff5c5c",
                  border: "none",
                  cursor: "pointer",
                }}
                disabled={loading}
              >
                X
              </button>
            </div>
          ))
        ) : (
          <p>No files selected</p>
        )}
      </div>

      <div style={{ marginTop: "20px" }}>
        <h5>Converted Files ({convertedFiles.length})</h5>
        {convertedFiles.length > 0 ? (
          convertedFiles.map((file, idx) => (
            <div key={idx} style={{ marginBottom: "5px", display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{getFileName(file.path) || file.name}</span>
              <a
                href={`${url}/models/${getFileName(file.path)}`}
                download
                style={{
                  color: "#4dd0e1",
                  marginLeft: "10px",
                  textDecoration: "underline",
                }}
              >
                Download
              </a>
            </div>
          ))
        ) : (
          <p>No converted files yet</p>
        )}
      </div>

      <div style={{ marginTop: "20px" }}>
        <button 
          onClick={handleSave} 
          disabled={loading || convertedFiles.length === 0}
        >
          {loading ? "Saving..." : "Save All"}
        </button>
      </div>
    </div>
  );
}

export default BulkModelImport;