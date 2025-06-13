import React, { useEffect, useState } from "react";
import "../styles/spid.css";
import { useNavigate } from "react-router-dom";
import { fetchSvgFiles } from "../services/SpidApi";


const Spid = () => {
  const [files, setFiles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const getSvgFiles = async () => {
      try {
           const projectString = sessionStorage.getItem("selectedProject");
      const project = projectString ? JSON.parse(projectString) : null;
      const projectId = project?.projectId;
      const type='iXB'
      const data ={projectId,type}
      //console.log(data);
      

        const response = await fetchSvgFiles(data);
        if(response.status ===200){
          console.log(response.data.files);
         setFiles(response.data.files) 
        }
      
      } catch {
        setFiles([]); 
      }
    };
    getSvgFiles();
  }, []);

  const handleOpen = (fileId) => {
    navigate(`/canvas/${fileId}`);
  };

  const handleAddNew = () => {
    console.log("Add new SVG file functionality");
  };

  return (
<>
<div className="pid-documents-container">
            <div className="pid-documents-header">
              <h2>Smart P&IDs</h2>
              <button
                className="pid-documents-add-button"
                onClick={handleAddNew}
                title="Add New SVG"
              >
                <div style={{marginTop:'-2px',  fontWeight: '800'
}}>+</div>
                
              </button>
            </div>

            <div className="pid-documents-grid">
              {files.length > 0 ? (
                files.map((file,index) => (
                  <div
                    key={file.id}
                    className="pid-documents-card"
                    onClick={() => handleOpen(file.documentId)}
                    title={file.title}
                  >
                    <h3>{file.title}</h3>
                  </div>
                ))
              ) : (
                <div className="pid-documents-empty-state">
                  <p>No documents available.</p>
                </div>
              )}
            </div>
          </div>
</>
  );
};

export default Spid;
