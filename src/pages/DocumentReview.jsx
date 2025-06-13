import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { getDocumentsdetails } from "../services/CommonApis";

const Review = () => {
  const [documents, setDocuments] = useState([]);
//console.log(documents)
      const projectString = sessionStorage.getItem("selectedProject");
      const project = projectString ? JSON.parse(projectString) : null;
      const projectId = project?.projectId;
  useEffect(() => {
    const fetchData = async () => {


      if (!projectId) return;

      try {
        const response = await getDocumentsdetails(projectId);

        if (response.status === 200) {
          setDocuments(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch documents", error);
      }
    };

    fetchData();
  }, []);

  // Style objects
  const thStyle = {
    backgroundColor: "#4d5dbe",
    color: "white",
    position: "sticky",
    top: 0,
    zIndex: 10,
    textAlign: "center",
  };

  const wrapperStyle = {
    maxHeight: "500px",
    overflowY: "auto",
  };

  return (
    <div className="container-fluid px-0">
      <div style={wrapperStyle} className="rounded shadow-sm">
        <table className="table table-bordered table-hover mb-0">
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Document number</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>File</th>
              <th style={thStyle}>
                <FontAwesomeIcon icon={faDownload} className="me-2" />
              </th>
            </tr>
          </thead>
          <tbody className="text-center">
            {documents.map((doc, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{doc.number}</td>
                <td>{doc.title}</td>
                <td>{doc.descr}</td>
                <td>{doc.type}</td>
                <td>{doc.filename}</td>
                <td>
                  
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center text-muted py-3">
                  No documents available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Review;
