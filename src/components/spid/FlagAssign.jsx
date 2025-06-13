import React, { useState, useEffect } from "react";
import { getDocumentsdetails } from "../../services/CommonApis";
import { SaveassignedFlag } from "../../services/SpidApi";
import "../../styles/FlagAssign.css"; // 👈 Use this to import styles (add below)

function FlagAssign({ FlagText, fileId, uniqueIds, setContextMenu }) {
  const [documents, setDocuments] = useState([]);
  const [matchingDocs, setMatchingDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchDocuments = async () => {
      const projectString = sessionStorage.getItem("selectedProject");
      const project = projectString ? JSON.parse(projectString) : null;
      const projectId = project?.projectId;

      try {
        const response = await getDocumentsdetails(projectId);
        setDocuments(response.data || []);
      } catch (error) {
        console.error("Error fetching documents:", error);
        setDocuments([]);
      }
    };

    fetchDocuments();
  }, []);

  const handleAssignClick = () => {
    const searchText = FlagText?.text?.toLowerCase() || "";
    const matches = documents.filter((doc) =>
      doc.filename?.toLowerCase().includes(searchText)
    );

    setMatchingDocs(matches.length > 0 ? matches : documents);
    setShowModal(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedDoc) return;

    const AssignFlagData = {
      fileId,
      AssigneddocumentId: selectedDoc.documentId,
      uniqueIds,
      documentTitle: selectedDoc.title,
      flagText: FlagText?.text || "Manual selection",
    };

    const response = await SaveassignedFlag(AssignFlagData);
    if (response.status === 200) {
      setContextMenu({ visible: false, x: 0, y: 0 });

      setShowModal(false);
    }

    setShowModal(false);
  };

  const handleDocumentSelect = (doc) => {
    setSelectedDoc(doc);
  };

  return (
    <div className="tag-assign-container">
      <button
        onClick={handleAssignClick}
        className="assign-tag-button"
        disabled={false}
      >
        {selectedDoc ? `Linked to: ${selectedDoc.title}` : "Assign Flag"}
      </button>

      {showModal && (
        <div className="tag-modal-overlay">
          <div className="tag-modal-content">
            <div className="tag-modal-header">
              <h3 className="tag-modal-title">
                {FlagText?.text
                  ? `Matching: "${FlagText.text}"`
                  : "Select a document"}
              </h3>
              <button
                className="close-button"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="tag-modal-body">
              {matchingDocs.length === 0 ? (
                <div className="empty-state">
                  No matching documents found. Showing all.
                </div>
              ) : (
                <ul className="tag-list">
                  {matchingDocs.map((doc) => (
                    <li
                      key={doc.documentId}
                      className="tag-item"
                      aria-selected={selectedDoc?.documentId === doc.documentId}
                      onClick={() => handleDocumentSelect(doc)}
                    >
                      <span>
                        <strong>{doc.title}</strong>
                        <br />
                        <small>
                          {doc.number} • {doc.type} • {doc.filename}
                        </small>
                      </span>
                      {selectedDoc?.documentId === doc.documentId && (
                        <span className="selected-indicator">✓</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "20px",
                  gap: "8px",
                }}
              >
                <button
                  onClick={() => {
                    setShowModal(false);
                    setContextMenu({ visible: false, x: 0, y: 0 });
                  }}
                  className="retry-button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAssign}
                  className="retry-button"
                  disabled={!selectedDoc}
                  style={{
                    backgroundColor: selectedDoc ? "#003087" : "#ccc",
                    color: selectedDoc ? "#fff" : "#666",
                    cursor: selectedDoc ? "pointer" : "not-allowed",
                  }}
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlagAssign;
